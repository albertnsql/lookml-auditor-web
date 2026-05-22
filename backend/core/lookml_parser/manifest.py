"""
manifest.py — LookML manifest.lkml parser and constant resolver.

Extracted from parser.py as a shared utility so both ast_parser.py
(and any future parser) can use it without importing the full regex parser.

Public API:
    parse_manifest(root_path: str) -> dict[str, str]
    resolve_constants(sql_table: str, constants: dict[str, str]) -> str
"""
from __future__ import annotations

import re
import lkml
from pathlib import Path

_CONST_REF_RE = re.compile(r'@\{(\w+)\}')

def _strip_quotes(value: str) -> str:
    """Strip surrounding double or single quotes."""
    if not isinstance(value, str):
        return str(value)
    v = value.strip()
    if len(v) >= 2 and ((v.startswith('"') and v.endswith('"')) or
                        (v.startswith("'") and v.endswith("'"))):
        v = v[1:-1]
    return v

def parse_manifest(root_path: str) -> dict[str, str]:
    """
    Find and parse manifest.lkml in the project root.
    Returns dict of {constant_name: value}.
    Handles case-insensitive filename matching across platforms.
    """
    root = Path(root_path)
    constants: dict[str, str] = {}

    candidates = [root / "manifest.lkml", root / "Manifest.lkml", root / "MANIFEST.lkml"]
    try:
        for f in root.iterdir():
            if f.name.lower() == "manifest.lkml" and f not in candidates:
                candidates.append(f)
    except Exception:  # noqa: BLE001
        pass

    for candidate in candidates:
        if candidate.exists():
            try:
                text = candidate.read_text(encoding="utf-8", errors="replace")
                parsed = lkml.load(text)
                if isinstance(parsed, dict):
                    for const_dict in parsed.get("constants", []):
                        name = const_dict.get("name")
                        val = const_dict.get("value")
                        if name and val is not None:
                            constants[name] = _strip_quotes(val)
                break
            except Exception:
                pass

    return constants


def resolve_constants(sql_table: str, constants: dict[str, str]) -> str:
    """Replace @{ConstantName} references with their resolved values."""
    if not constants or not sql_table or '@{' not in sql_table:
        return sql_table
    return _CONST_REF_RE.sub(
        lambda m: constants.get(m.group(1), m.group(0)),
        sql_table
    )
