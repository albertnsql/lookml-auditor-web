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
from pathlib import Path

# ---------------------------------------------------------------------------
# Compiled patterns (module-level — compiled once)
# ---------------------------------------------------------------------------

_RE_COMMENT = re.compile(r'#[^\n]*')

_CONSTANT_RE = re.compile(
    r'constant\s*:\s*(\w+)\s*\{[^}]*?value\s*:\s*["\']([^"\']+)["\']',
    re.DOTALL
)
_CONST_REF_RE = re.compile(r'@\{(\w+)\}')


# ---------------------------------------------------------------------------
# Public functions
# ---------------------------------------------------------------------------

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
            text = _RE_COMMENT.sub('', candidate.read_text(encoding="utf-8", errors="replace"))
            for name, value in _CONSTANT_RE.findall(text):
                constants[name] = value
            break

    return constants


def resolve_constants(sql_table: str, constants: dict[str, str]) -> str:
    """Replace @{ConstantName} references with their resolved values."""
    if not constants or not sql_table or '@{' not in sql_table:
        return sql_table
    return _CONST_REF_RE.sub(
        lambda m: constants.get(m.group(1), m.group(0)),
        sql_table
    )
