"""
LookML AST Parser — backed by the `lkml` Python library
---------------------------------------------------------
Replaces the custom regex-based parser.py when USE_AST_PARSER = True in main.py.

Key differences vs parser.py:
  - Uses lkml.load() for structural parsing instead of regex.
  - Line numbers are NOT available from lkml — all line_number fields are set to 0.
    This will be addressed in Phase 2.
  - SQL strings from lkml include trailing ";;" — stripped during field mapping.
  - Per-file parse errors are caught and logged; the file is skipped rather than
    crashing the whole audit.

Public API (identical to parser.py):
    parse_project(root_path: str) -> LookMLProject
"""
from __future__ import annotations

import logging
import re
from pathlib import Path
from typing import Optional

import lkml

from .models import (
    LookMLField,
    LookMLView,
    LookMLJoin,
    LookMLExplore,
    LookMLProject,
)

# Manifest helpers live in their own module (extracted from the old regex parser)
from .manifest import parse_manifest, resolve_constants

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _strip_sql(value) -> Optional[str]:
    """
    Strip LookML SQL terminator ';;' and surrounding whitespace/quotes.

    lkml returns string attribute values with their surrounding quotes intact,
    e.g. sql_table_name: "public.orders" becomes '"public.orders"'.
    The regex parser strips these — we must do the same for parity.

    Also guards against receiving a non-string (e.g. a list) which can happen
    when lkml misidentifies a repeated key like extends: [...].
    """
    if value is None:
        return None
    if not isinstance(value, str):
        # Safety guard: should not happen for scalar SQL/table attributes
        return None
    v = value.strip().rstrip(";").rstrip(";").strip()
    # Strip surrounding double or single quotes that lkml preserves verbatim
    if len(v) >= 2 and ((v.startswith('"') and v.endswith('"')) or
                         (v.startswith("'") and v.endswith("'"))  ):
        v = v[1:-1]
    return v if v else None


def _bool_attr(value: Optional[str]) -> bool:
    """Convert LookML 'yes'/'no' strings to Python bool."""
    return (value or "").lower().strip() == "yes"


def _parse_tags(raw) -> list[str]:
    """
    lkml can return tags as:
      - a list of strings: ["tag1", "tag2"]
      - a single string:   "tag1"
      - None
    Normalize to list[str].
    """
    if raw is None:
        return []
    if isinstance(raw, list):
        return [str(t).strip() for t in raw if t]
    return [str(raw).strip()] if raw else []


def _parse_filters(raw) -> Optional[str]:
    """
    lkml may return filters as a list of dicts like:
        [{"field": "view.dim", "value": "yes"}]
    Stringify for compatibility with the LookMLField.filters: Optional[str] field.
    """
    if raw is None:
        return None
    if isinstance(raw, list):
        return str(raw)
    return str(raw)


# ---------------------------------------------------------------------------
# LookMLField
# ---------------------------------------------------------------------------

# Maps the pluralized lkml list key → singular field_type string stored in LookMLField
_FIELD_TYPE_MAP: dict[str, str] = {
    "dimensions":       "dimension",
    "measures":         "measure",
    "dimension_groups": "dimension_group",
    "filters":          "filter",
    "parameters":       "parameter",
}


def _parse_fields(view_dict: dict, source_file: str) -> list[LookMLField]:
    """
    Extract all field types from a view dict and return a flat list of LookMLField.
    lkml groups fields by type into pluralized list keys.
    """
    fields: list[LookMLField] = []

    for lkml_key, field_type in _FIELD_TYPE_MAP.items():
        for field_dict in view_dict.get(lkml_key, []):
            name = field_dict.get("name")
            if not name:
                continue

            fields.append(LookMLField(
                name=name,
                field_type=field_type,
                data_type=field_dict.get("type"),
                sql=_strip_sql(field_dict.get("sql")),
                html=_strip_sql(field_dict.get("html")),
                value_format=field_dict.get("value_format"),
                value_format_name=field_dict.get("value_format_name"),
                label=field_dict.get("label"),
                description=field_dict.get("description"),
                hidden=_bool_attr(field_dict.get("hidden")),
                primary_key=_bool_attr(field_dict.get("primary_key")),
                tags=_parse_tags(field_dict.get("tags")),
                filters=_parse_filters(field_dict.get("filters")),
                source_file=source_file,
                line_number=0,  # lkml does not expose line numbers — Phase 2 gap
            ))

    return fields


# ---------------------------------------------------------------------------
# LookMLView
# ---------------------------------------------------------------------------

def _parse_view(view_dict: dict, source_file: str) -> Optional[LookMLView]:
    name = view_dict.get("name")
    if not name:
        return None

    # derived_table is a nested dict: derived_table: { sql: ... ;; }
    dt_dict = view_dict.get("derived_table") or {}
    derived_sql = _strip_sql(dt_dict.get("sql")) if dt_dict else None

    # ── PDT detection ───────────────────────────────────────────────────────
    # A view is a Persistent Derived Table (PDT) if its derived_table block
    # contains at least one persistence key. We inspect the parsed AST dict
    # directly — checking the SQL body would not work because these keys are
    # LookML metadata, not SQL statements.
    _PDT_KEYS = {"persist_for", "datagroup_trigger", "sql_trigger_value", "persist_with"}
    is_pdt = bool(dt_dict and _PDT_KEYS.intersection(dt_dict.keys()))

    # extends: lkml can emit:
    #   - extends__all: [["view_a", "view_b"]]  (list-of-lists for array syntax)
    #   - extends: "view_a"                      (single string)
    #   - extends: ["view_a"]                    (list of strings)
    raw_extends = view_dict.get("extends__all") or view_dict.get("extends") or []
    if isinstance(raw_extends, str):
        raw_extends = [raw_extends]
    # Flatten nested lists: lkml wraps the extends array in an outer list
    flat_extends: list[str] = []
    for item in raw_extends:
        if isinstance(item, list):
            flat_extends.extend(str(i).strip() for i in item if i)
        elif item:
            flat_extends.append(str(item).strip())
    extends = [e for e in flat_extends if e]

    return LookMLView(
        name=name,
        sql_table_name=_strip_sql(view_dict.get("sql_table_name")),
        derived_table_sql=derived_sql,
        is_pdt=is_pdt,
        extends=extends,
        extension_required=_bool_attr(view_dict.get("extension")),
        fields=_parse_fields(view_dict, source_file),
        source_file=source_file,
        line_number=0,  # lkml does not expose line numbers — Phase 2 gap
    )


# ---------------------------------------------------------------------------
# LookMLJoin
# ---------------------------------------------------------------------------

def _parse_join(join_dict: dict, source_file: str) -> Optional[LookMLJoin]:
    name = join_dict.get("name")
    if not name:
        return None

    return LookMLJoin(
        name=name,
        # lkml uses "from" (not "from_view") matching the LookML keyword
        from_view=join_dict.get("from") or join_dict.get("view_name"),
        type=join_dict.get("type"),
        relationship=join_dict.get("relationship"),
        sql_on=_strip_sql(join_dict.get("sql_on")),
        sql_where=_strip_sql(join_dict.get("sql_where")),
        foreign_key=join_dict.get("foreign_key"),
        source_file=source_file,
        line_number=0,  # lkml does not expose line numbers — Phase 2 gap
    )


# ---------------------------------------------------------------------------
# LookMLExplore
# ---------------------------------------------------------------------------

def _parse_explore(explore_dict: dict, source_file: str) -> Optional[LookMLExplore]:
    name = explore_dict.get("name")
    if not name:
        return None

    joins: list[LookMLJoin] = []
    for join_dict in explore_dict.get("joins", []):
        join = _parse_join(join_dict, source_file)
        if join:
            joins.append(join)

    return LookMLExplore(
        name=name,
        from_view=explore_dict.get("from"),
        view_name=explore_dict.get("view_name"),
        label=explore_dict.get("label"),
        description=explore_dict.get("description"),
        joins=joins,
        source_file=source_file,
        line_number=0,  # lkml does not expose line numbers — Phase 2 gap
    )


# ---------------------------------------------------------------------------
# File & Project parser
# ---------------------------------------------------------------------------
# File Parsing
# ---------------------------------------------------------------------------

_RE_VIEW = re.compile(r'^\s*view:\s*(\w+)')
_RE_EXPLORE = re.compile(r'^\s*explore:\s*(\w+)')
_RE_FIELD = re.compile(r'^\s*(dimension|dimension_group|measure|filter|parameter):\s*(\w+)')
_RE_JOIN = re.compile(r'^\s*join:\s*(\w+)')

def build_line_map(raw_text: str) -> dict[tuple[str, str], int]:
    """
    Lightweight regex pre-scan to build a line number lookup dictionary.
    Returns dict mapping (type, name) -> line_number (1-indexed).
    """
    line_map = {}
    for i, line in enumerate(raw_text.splitlines(), start=1):
        m = _RE_VIEW.search(line)
        if m:
            line_map[("view", m.group(1))] = i
            continue
        m = _RE_EXPLORE.search(line)
        if m:
            line_map[("explore", m.group(1))] = i
            continue
        m = _RE_JOIN.search(line)
        if m:
            line_map[("join", m.group(1))] = i
            continue
        m = _RE_FIELD.search(line)
        if m:
            line_map[("field", m.group(2))] = i
            continue
    return line_map

def _parse_file(file_path: str) -> tuple[list[LookMLView], list[LookMLExplore]]:
    """
    Parse a single .lkml file using lkml.load().
    Returns (views, explores) extracted from the file.
    Skips the file silently on parse errors.
    """
    path = Path(file_path)
    if not path.exists() or path.stat().st_size < 10:
        return [], []

    try:
        text = path.read_text(encoding="utf-8", errors="replace")
        parsed = lkml.load(text)
    except SyntaxError as exc:
        logger.warning("lkml parse error in %s: %s — file skipped.", file_path, exc)
        return [], []
    except Exception as exc:  # noqa: BLE001
        logger.warning("Unexpected error parsing %s: %s — file skipped.", file_path, exc)
        return [], []

    if not isinstance(parsed, dict):
        return [], []

    line_map = build_line_map(text)

    views: list[LookMLView] = []
    for view_dict in parsed.get("views", []):
        view = _parse_view(view_dict, file_path)
        if view:
            view.line_number = line_map.get(("view", view.name), 0)
            for field in view.fields:
                field.line_number = line_map.get(("field", field.name), 0)
            views.append(view)

    explores: list[LookMLExplore] = []
    for explore_dict in parsed.get("explores", []):
        explore = _parse_explore(explore_dict, file_path)
        if explore:
            explore.line_number = line_map.get(("explore", explore.name), 0)
            for join in explore.joins:
                join.line_number = line_map.get(("join", join.name), 0)
            explores.append(explore)

    return views, explores


def parse_project(root_path: str) -> LookMLProject:
    """
    Walk the directory recursively, parse all .lkml files using lkml.load().
    Skips hidden directories and files under 10 bytes.
    Preserves ALL view/explore definitions across files (including duplicates)
    so validators like check_duplicates can detect real conflicts.

    Public API is identical to parser.parse_project() — returns LookMLProject.
    """
    root = Path(root_path)
    if not root.exists():
        raise FileNotFoundError(f"Project path does not exist: {root_path}")

    all_views: list[LookMLView] = []
    all_explores: list[LookMLExplore] = []

    for file_path in root.rglob("*.lkml"):
        # Skip hidden directories
        if any(p.name.startswith(".") for p in file_path.parents):
            continue
        if file_path.stat().st_size < 10:
            continue

        views, explores = _parse_file(str(file_path))
        all_views.extend(views)
        all_explores.extend(explores)

    # Resolve @{Constant} references in sql_table_name using manifest.lkml
    # (reuses the existing helper from parser.py)
    constants = parse_manifest(str(root_path))
    if constants:
        for view in all_views:
            if view.sql_table_name and "@{" in view.sql_table_name:
                view.sql_table_name = resolve_constants(view.sql_table_name, constants)

    return LookMLProject(
        name=root.name,
        root_path=str(root_path),
        views=all_views,
        explores=all_explores,
        manifest_constants=constants,
    )
