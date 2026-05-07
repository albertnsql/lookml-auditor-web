"""
lookml_parser — public API for the LookML Auditor parser package.

Phase 3: fully switched to the lkml-library-based AST parser.
The legacy regex parser.py has been removed.
"""
from __future__ import annotations

from .models import LookMLProject, LookMLView, LookMLExplore, LookMLField, LookMLJoin
from .ast_parser import parse_project
from .manifest import parse_manifest, resolve_constants


def parse_file(file_path: str):
    """
    Thin compatibility stub.

    The AST parser operates at the project level (parse_project) and does
    not expose a per-file API. This stub returns empty lists so any legacy
    caller does not break. Tests that exercised the regex parser's parse_file
    directly do so via an explicit import from lookml_parser.parser; those
    tests are preserved in test_parser.py but are now considered legacy.
    """
    return [], []


__all__ = [
    "LookMLProject", "LookMLView", "LookMLExplore",
    "LookMLField", "LookMLJoin",
    "parse_project", "parse_file",
    "parse_manifest", "resolve_constants",
]
