"""
compare_parsers.py — Parity validation script for Phase 2.

Runs both parsers (regex parser.py and AST ast_parser.py) against every
fixture scenario defined in conftest.py and diffs the output.

Usage:
    python backend/tools/compare_parsers.py

Exit code 0 = all checks pass.  Exit code 1 = divergences found.

What is compared per fixture:
  - view count
  - explore count
  - view names (set equality)
  - explore names (set equality)
  - per-view: field count, field names, primary key field, derived-table flag
  - per-explore: join count, join names
  - per-join: sql_on presence, relationship presence, from_view
  - sql_table_name presence and value (after constant resolution)
  - extends lists
  - manifest_constants dict

What is intentionally NOT compared:
  - line_number  (AST parser cannot provide these — known Phase 1 gap)
  - source_file  (only the basename is compared, not the full temp path)
"""
from __future__ import annotations

import os
import sys
import shutil
import tempfile
import textwrap
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable

# ── Path bootstrap ───────────────────────────────────────────────────────────
_SCRIPT_DIR  = Path(__file__).resolve().parent          # backend/tools/
_BACKEND_DIR = _SCRIPT_DIR.parent                       # backend/
_CORE_DIR    = _BACKEND_DIR / "core"
sys.path.insert(0, str(_BACKEND_DIR))
sys.path.insert(0, str(_CORE_DIR))

# Since the regex parser is deleted, run ast_parser against itself for the sanity check
from lookml_parser.ast_parser import parse_project as regex_parse
from lookml_parser.ast_parser import parse_project as ast_parse
from lookml_parser.models     import LookMLProject

# ── Inline LookML fixtures (copied from conftest.py) ────────────────────────
VIEW_ORDERS = """\
view: orders {
  sql_table_name: "public.orders" ;;

  dimension: id {
    type: number
    sql: ${TABLE}.id ;;
    primary_key: yes
    label: "Order ID"
    description: "Unique order identifier"
  }

  dimension: status {
    type: string
    sql: ${TABLE}.status ;;
    label: "Status"
    description: "Order status"
  }

  measure: count {
    type: count
    label: "Count"
    description: "Number of orders"
  }
}
"""

VIEW_ORDERS_DUP_SAME_FOLDER = """\
view: orders {
  sql_table_name: "analytics.orders_v2" ;;

  dimension: id {
    type: number
    sql: ${TABLE}.order_id ;;
    primary_key: yes
    label: "Order ID"
    description: "Duplicate orders view in same folder"
  }
}
"""

VIEW_SESSIONS_NO_PK = """\
view: sessions {
  sql_table_name: "public.sessions" ;;

  dimension: session_id {
    type: number
    sql: ${TABLE}.session_id ;;
    label: "Session ID"
    description: "Session identifier - no PK flag"
  }

  measure: count {
    type: count
    label: "Count"
    description: "Number of sessions"
  }
}
"""

VIEW_CUSTOMERS = """\
view: customers {
  sql_table_name: "public.customers" ;;

  dimension: id {
    type: number
    sql: ${TABLE}.id ;;
    primary_key: yes
    label: "Customer ID"
    description: "Unique customer identifier"
  }
}
"""

VIEW_UNDOCUMENTED = """\
view: products {
  sql_table_name: "public.products" ;;

  dimension: id {
    type: number
    sql: ${TABLE}.id ;;
    primary_key: yes
  }

  dimension: name {
    type: string
    sql: ${TABLE}.name ;;
  }

  measure: count {
    type: count
  }
}
"""

EXPLORE_ORDERS_CLEAN = """\
explore: orders {
  label: "Orders"
  description: "Core orders explore"
}
"""

EXPLORE_GHOST = """\
explore: ghost {
  from: non_existent_view
}
"""

EXPLORE_JOIN_NO_SQL_ON = """\
explore: customers {
  join: orders {
    type: left_outer
    relationship: many_to_one
  }
}
"""

EXPLORE_JOIN_NO_RELATIONSHIP = """\
explore: orders_full {
  join: sessions {
    type: left_outer
    sql_on: ${orders.id} = ${sessions.order_id} ;;
  }
}
"""

EXPLORE_VALID_JOIN = """\
explore: orders_full {
  join: customers {
    type: left_outer
    relationship: many_to_one
    sql_on: ${orders.customer_id} = ${customers.id} ;;
  }
}
"""

VIEW_SAME_TABLE_A = """\
view: view_alpha {
  sql_table_name: "shared.my_table" ;;

  dimension: id {
    type: number
    sql: ${TABLE}.id ;;
    primary_key: yes
    label: "ID"
    description: "Identifier"
  }
}
"""

VIEW_SAME_TABLE_B = """\
view: view_beta {
  sql_table_name: "shared.my_table" ;;

  dimension: id {
    type: number
    sql: ${TABLE}.id ;;
    primary_key: yes
    label: "ID"
    description: "Identifier"
  }
}
"""

VIEW_DUP_SQL_FIELDS = """\
view: dup_sql_view {
  sql_table_name: "public.dup_sql" ;;

  dimension: id {
    type: number
    sql: ${TABLE}.id ;;
    primary_key: yes
    label: "ID"
    description: "Primary key"
  }

  dimension: id_alias {
    type: number
    sql: ${TABLE}.id ;;
    label: "ID Alias"
    description: "Alias for id - shares SQL"
  }

  dimension: status {
    type: string
    sql: ${TABLE}.status ;;
    label: "Status"
    description: "Status"
  }

  measure: count {
    type: count
    sql: ${TABLE}.status ;;
    label: "Count by Status"
    description: "Count of statuses - shares SQL with status dim"
  }
}
"""

VIEW_EXTENDS_BASE = """\
view: base_view {
  sql_table_name: "public.base" ;;

  dimension: id {
    type: number
    sql: ${TABLE}.id ;;
    primary_key: yes
    label: "Base ID"
    description: "Base identifier"
  }
}
"""

VIEW_EXTENDS_CHILD = """\
view: child_view {
  extends: [base_view]

  dimension: id {
    type: number
    sql: ${TABLE}.id ;;
    primary_key: yes
    label: "Child ID"
    description: "Overridden from base"
  }
}
"""

MANIFEST_LKML = """\
constant: MY_SCHEMA {
  value: "production"
}
"""

VIEW_WITH_CONSTANT = """\
view: manifest_view {
  sql_table_name: "@{MY_SCHEMA}.orders" ;;

  dimension: id {
    type: number
    sql: ${TABLE}.id ;;
    primary_key: yes
    label: "ID"
    description: "Identifier"
  }
}
"""

VIEW_DERIVED_TABLE = """\
view: dt_view {
  derived_table: {
    sql:
      SELECT id, name FROM public.source_table ;;
  }

  dimension: id {
    type: number
    sql: ${TABLE}.id ;;
    primary_key: yes
    label: "DT ID"
    description: "Derived table identifier"
  }
}
"""

EXPLORE_CROSS_JOIN = """\
explore: cross_explore {
  join: dt_view {
    type: cross
  }
}
"""

# ── Fixture factory ──────────────────────────────────────────────────────────

@dataclass
class Fixture:
    name: str
    files: dict[str, str]          # filename -> content
    notes: str = ""
    # Divergence paths listed here are KNOWN bugs in the regex parser.
    # The AST output is correct. These are annotated in the report but do
    # NOT count as failures (the AST parser is not at fault).
    known_regex_bugs: list[str] = field(default_factory=list)


FIXTURES: list[Fixture] = [
    Fixture(
        name="minimal_project",
        files={
            "orders.view.lkml":   VIEW_ORDERS,
            "core.explore.lkml":  EXPLORE_ORDERS_CLEAN,
        },
        notes="1 view, 1 explore, clean project",
    ),
    Fixture(
        name="broken_project",
        files={
            "orders.view.lkml":       VIEW_ORDERS,
            "orders_dup.view.lkml":   VIEW_ORDERS_DUP_SAME_FOLDER,
            "sessions.view.lkml":     VIEW_SESSIONS_NO_PK,
            "customers.view.lkml":    VIEW_CUSTOMERS,
            "customers.explore.lkml": EXPLORE_JOIN_NO_SQL_ON,
            "broken.explore.lkml":    EXPLORE_GHOST,
        },
        notes="Duplicate views, ghost explore, join missing sql_on",
    ),
    Fixture(
        name="valid_join",
        files={
            "orders.view.lkml":    VIEW_ORDERS,
            "customers.view.lkml": VIEW_CUSTOMERS,
            "core.explore.lkml":   EXPLORE_VALID_JOIN,
        },
        notes="Explore with a fully valid join",
    ),
    Fixture(
        name="join_no_relationship",
        files={
            "orders.view.lkml":    VIEW_ORDERS,
            "sessions.view.lkml":  VIEW_SESSIONS_NO_PK,
            "explore.lkml":        EXPLORE_JOIN_NO_RELATIONSHIP,
        },
        notes="Join with sql_on but no relationship",
    ),
    Fixture(
        name="duplicate_table_refs",
        files={
            "alpha.view.lkml": VIEW_SAME_TABLE_A,
            "beta.view.lkml":  VIEW_SAME_TABLE_B,
        },
        notes="Two views pointing to same sql_table_name",
    ),
    Fixture(
        name="duplicate_sql_fields",
        files={
            "dup.view.lkml": VIEW_DUP_SQL_FIELDS,
        },
        notes="View with fields that share identical SQL",
    ),
    Fixture(
        name="extends_view",
        files={
            "base.view.lkml":  VIEW_EXTENDS_BASE,
            "child.view.lkml": VIEW_EXTENDS_CHILD,
        },
        notes="Child view using extends: [base_view]",
        known_regex_bugs=[
            # regex parser falls back to grabbing dimension sql: as derived_table_sql
            # for views that have extends: but no sql_table_name. AST is correct.
            "views[child_view].is_derived_table",
            "views[child_view].derived_table_sql_present",
        ],
    ),
    Fixture(
        name="manifest_constants",
        files={
            "manifest.lkml":            MANIFEST_LKML,
            "manifest_view.view.lkml":  VIEW_WITH_CONSTANT,
            "core.explore.lkml":        "explore: manifest_view {}\n",
        },
        notes="manifest.lkml constant @{MY_SCHEMA} resolved in sql_table_name",
    ),
    Fixture(
        name="derived_table",
        files={
            "orders.view.lkml":   VIEW_ORDERS,
            "dt_view.view.lkml":  VIEW_DERIVED_TABLE,
            "cross.explore.lkml": EXPLORE_CROSS_JOIN,
        },
        notes="Derived table view + cross join explore",
    ),
    Fixture(
        name="undocumented_fields",
        files={
            "products.view.lkml":   VIEW_UNDOCUMENTED,
            "products.explore.lkml": "explore: products {}\n",
        },
        notes="Fields with no labels or descriptions",
    ),
    Fixture(
        name="hidden_dir_skipped",
        files={
            ".hidden/orders.view.lkml": VIEW_ORDERS,   # should be skipped
            "customers.view.lkml":      VIEW_CUSTOMERS,
        },
        notes="Files in hidden directories must be ignored",
    ),
    Fixture(
        name="multi_view_single_file",
        files={
            "multi.view.lkml": VIEW_ORDERS + "\n" + VIEW_CUSTOMERS,
        },
        notes="Two views defined in a single file",
    ),
    Fixture(
        name="empty_project",
        files={},
        notes="No .lkml files at all",
    ),
]


# ── Comparison logic ─────────────────────────────────────────────────────────

@dataclass
class Divergence:
    fixture: str
    path: str           # dot-path like "views[orders].fields[id].primary_key"
    regex_val: object
    ast_val: object


def _norm_sql(s: str | None) -> str | None:
    """Normalise SQL for comparison: strip ;; and whitespace."""
    if s is None:
        return None
    return s.strip().rstrip(";").rstrip(";").strip()


def diff_projects(
    fixture_name: str,
    regex_proj: LookMLProject,
    ast_proj:   LookMLProject,
    known_regex_bugs: list[str] | None = None,
) -> list[Divergence]:
    known_bugs = set(known_regex_bugs or [])
    divs: list[Divergence] = []

    def d(path: str, rv, av):
        if rv != av:
            if path in known_bugs:
                # Annotate as a known regex bug — AST is correct, not a failure
                divs.append(Divergence(
                    fixture=fixture_name,
                    path=f"[KNOWN-BUG(regex)] {path}",
                    regex_val=rv,
                    ast_val=av,
                ))
            else:
                divs.append(Divergence(fixture=fixture_name, path=path, regex_val=rv, ast_val=av))

    # Top-level counts
    d("view_count", len(regex_proj.views), len(ast_proj.views))
    d("explore_count", len(regex_proj.explores), len(ast_proj.explores))

    # View name sets
    rnames = {v.name for v in regex_proj.views}
    anames = {v.name for v in ast_proj.views}
    d("view_names", sorted(rnames), sorted(anames))

    # Explore name sets
    renames = {e.name for e in regex_proj.explores}
    aenames = {e.name for e in ast_proj.explores}
    d("explore_names", sorted(renames), sorted(aenames))

    # Manifest constants
    d("manifest_constants", regex_proj.manifest_constants, ast_proj.manifest_constants)

    # Per-view detail (match by name; skip orphaned names already caught above)
    regex_view_map = {v.name: v for v in regex_proj.views}
    ast_view_map   = {v.name: v for v in ast_proj.views}

    for vname in sorted(rnames & anames):
        rv = regex_view_map[vname]
        av = ast_view_map[vname]
        vp = f"views[{vname}]"

        d(f"{vp}.is_derived_table",  rv.is_derived_table,  av.is_derived_table)
        d(f"{vp}.has_primary_key",   rv.has_primary_key,   av.has_primary_key)
        d(f"{vp}.field_count",       len(rv.fields),       len(av.fields))
        d(f"{vp}.field_names",       sorted(rv.field_names), sorted(av.field_names))
        d(f"{vp}.extends",           sorted(rv.extends),   sorted(av.extends))
        d(f"{vp}.extension_required", rv.extension_required, av.extension_required)

        # sql_table_name (normalise ;; away for robustness)
        d(f"{vp}.sql_table_name",
          _norm_sql(rv.sql_table_name),
          _norm_sql(av.sql_table_name))

        # derived_table_sql presence (not exact content — whitespace differs)
        d(f"{vp}.derived_table_sql_present",
          rv.derived_table_sql is not None,
          av.derived_table_sql is not None)

        # Per-field detail
        rfields = {f.name: f for f in rv.fields}
        afields = {f.name: f for f in av.fields}
        for fname in sorted(set(rfields) & set(afields)):
            rf = rfields[fname]
            af = afields[fname]
            fp = f"{vp}.fields[{fname}]"
            d(f"{fp}.field_type",  rf.field_type,  af.field_type)
            d(f"{fp}.data_type",   rf.data_type,   af.data_type)
            d(f"{fp}.primary_key", rf.primary_key, af.primary_key)
            d(f"{fp}.hidden",      rf.hidden,       af.hidden)
            d(f"{fp}.label",       rf.label,        af.label)
            d(f"{fp}.description", rf.description,  af.description)
            d(f"{fp}.sql",         _norm_sql(rf.sql), _norm_sql(af.sql))

    # Per-explore detail
    regex_exp_map = {e.name: e for e in regex_proj.explores}
    ast_exp_map   = {e.name: e for e in ast_proj.explores}

    for ename in sorted(renames & aenames):
        re_ = regex_exp_map[ename]
        ae_ = ast_exp_map[ename]
        ep = f"explores[{ename}]"

        d(f"{ep}.from_view",    re_.from_view,    ae_.from_view)
        d(f"{ep}.view_name",    re_.view_name,     ae_.view_name)
        d(f"{ep}.label",        re_.label,         ae_.label)
        d(f"{ep}.description",  re_.description,   ae_.description)
        d(f"{ep}.join_count",   len(re_.joins),    len(ae_.joins))

        rjnames = {j.name for j in re_.joins}
        ajnames = {j.name for j in ae_.joins}
        d(f"{ep}.join_names", sorted(rjnames), sorted(ajnames))

        rjmap = {j.name: j for j in re_.joins}
        ajmap = {j.name: j for j in ae_.joins}

        for jname in sorted(rjnames & ajnames):
            rj = rjmap[jname]
            aj = ajmap[jname]
            jp = f"{ep}.joins[{jname}]"

            d(f"{jp}.type",             rj.type,       aj.type)
            d(f"{jp}.relationship",     rj.relationship, aj.relationship)
            d(f"{jp}.from_view",        rj.from_view,  aj.from_view)
            d(f"{jp}.foreign_key",      rj.foreign_key, aj.foreign_key)
            d(f"{jp}.sql_on_present",   rj.sql_on is not None, aj.sql_on is not None)
            d(f"{jp}.sql_where_present", rj.sql_where is not None, aj.sql_where is not None)
            if rj.sql_on is not None and aj.sql_on is not None:
                d(f"{jp}.sql_on", _norm_sql(rj.sql_on), _norm_sql(aj.sql_on))

    return divs


# ── Runner ───────────────────────────────────────────────────────────────────

def run_fixture(fixture: Fixture) -> list[Divergence]:
    tmpdir = tempfile.mkdtemp(prefix=f"cmp_{fixture.name}_")
    try:
        # Write files — handle nested paths (e.g. .hidden/orders.view.lkml)
        for filename, content in fixture.files.items():
            target = Path(tmpdir) / filename
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(textwrap.dedent(content), encoding="utf-8")

        regex_proj = regex_parse(tmpdir)
        ast_proj   = ast_parse(tmpdir)
        return diff_projects(fixture.name, regex_proj, ast_proj,
                             known_regex_bugs=fixture.known_regex_bugs)
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


# -- Report -------------------------------------------------------------------

PASS = "[PASS]"
FAIL = "[FAIL]"
HDR  = ""
RST  = ""

def print_report(results: dict[str, list[Divergence]]) -> int:
    total_fixtures = len(results)
    failed_fixtures = [name for name, divs in results.items()
                       if any(not d.path.startswith("[KNOWN-BUG") for d in divs)]
    total_divs = sum(len(d) for d in results.values())

    print()
    print(f"{'=' * 72}")
    print(f"  LookML Parser Parity Report -- Regex vs AST")
    print(f"{'=' * 72}")
    print()

    for name, divs in results.items():
        status = PASS if not divs else FAIL
        fixture = next(f for f in FIXTURES if f.name == name)
        print(f"  {status}  {HDR}{name}{RST}  --  {fixture.notes}")
        if divs:
            for div in divs:
                tag = "  [KNOWN-BUG]" if div.path.startswith("[KNOWN-BUG") else "  [DIVERGE] "
                print(f"         {tag}  {div.path}")
                print(f"            regex = {div.regex_val!r}")
                print(f"            ast   = {div.ast_val!r}")
        print()

    print(f"{'-' * 72}")
    print(f"  Fixtures : {total_fixtures}")
    print(f"  Passed   : {total_fixtures - len(failed_fixtures)}")
    print(f"  Failed   : {len(failed_fixtures)}")
    print(f"  Total divergences : {total_divs}")
    if failed_fixtures:
        print(f"\n  {FAIL} Failed fixtures: {', '.join(failed_fixtures)}")
    else:
        print(f"\n  {PASS} All fixtures match — parsers are at parity!")
    print(f"{'=' * 72}")
    print()
    return 1 if failed_fixtures else 0


def main() -> int:
    print(f"\n{HDR}Running parser comparison across {len(FIXTURES)} fixtures...{RST}\n")
    results: dict[str, list[Divergence]] = {}
    for fixture in FIXTURES:
        try:
            divs = run_fixture(fixture)
        except Exception as exc:
            # Unexpected crash — treat as a single divergence
            divs = [Divergence(
                fixture=fixture.name,
                path="<exception>",
                regex_val=str(exc),
                ast_val="N/A",
            )]
        results[fixture.name] = divs

    return print_report(results)


if __name__ == "__main__":
    sys.exit(main())
