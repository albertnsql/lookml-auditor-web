"""
conftest.py — Shared fixtures for LookML Auditor Web Backend tests.

Sets up:
  - sys.path so 'core/' modules resolve correctly
  - TestClient for the FastAPI app
  - A reusable minimal mock project in a temp directory
  - In-memory LookMLProject factories (no disk I/O)
"""
from __future__ import annotations
import os
import sys
import tempfile
import textwrap
import shutil
from pathlib import Path
from typing import Generator

import pytest

# ── Resolve paths ────────────────────────────────────────────────────────────
_BACKEND_DIR = Path(__file__).parent.parent          # lookml-auditor-web/backend/
_CORE_DIR    = _BACKEND_DIR / "core"

sys.path.insert(0, str(_BACKEND_DIR))
sys.path.insert(0, str(_CORE_DIR))

from lookml_parser.models import (
    LookMLProject, LookMLView, LookMLField, LookMLExplore, LookMLJoin,
)


# ── FastAPI TestClient ───────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def client():
    """HTTPX-backed TestClient for the FastAPI app (session-scoped)."""
    from fastapi.testclient import TestClient
    from main import app
    with TestClient(app) as c:
        yield c


# ── Temp LookML project on disk ──────────────────────────────────────────────

MINIMAL_VIEW_LKML = """\
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

MINIMAL_EXPLORE_LKML = """\
explore: orders {
  label: "Orders"
  description: "Core orders explore"
}
"""

BROKEN_EXPLORE_LKML = """\
explore: ghost {
  from: non_existent_view
}
"""

DUP_VIEW_LKML = """\
view: orders {
  sql_table_name: "analytics.orders_v2" ;;

  dimension: id {
    type: number
    sql: ${TABLE}.order_id ;;
    primary_key: yes
  }
}
"""

MISSING_PK_VIEW_LKML = """\
view: sessions {
  sql_table_name: "public.sessions" ;;

  dimension: session_id {
    type: number
    sql: ${TABLE}.session_id ;;
    label: "Session ID"
    description: "Session identifier — no PK flag"
  }
}
"""

JOIN_NO_SQL_ON_LKML = """\
explore: customers {
  join: orders {
    type: left_outer
    relationship: many_to_one
  }
}
"""


@pytest.fixture(scope="session")
def minimal_project_dir() -> Generator[str, None, None]:
    """
    Creates a minimal LookML project on disk with:
      - orders.view.lkml     (clean view, has PK, label, description)
      - core.explore.lkml    (clean explore referencing orders)
    Yields the path; tears down after all tests.
    """
    tmpdir = tempfile.mkdtemp(prefix="lookml_web_test_")
    (Path(tmpdir) / "orders.view.lkml").write_text(
        textwrap.dedent(MINIMAL_VIEW_LKML), encoding="utf-8"
    )
    (Path(tmpdir) / "core.explore.lkml").write_text(
        textwrap.dedent(MINIMAL_EXPLORE_LKML), encoding="utf-8"
    )
    yield tmpdir
    shutil.rmtree(tmpdir, ignore_errors=True)


@pytest.fixture
def broken_project_dir() -> Generator[str, None, None]:
    """
    A project with intentional issues:
      - ghost explore referencing a non-existent view
      - duplicate orders view (in same folder → ERROR)
      - sessions view missing primary key
      - customers explore with join having no sql_on
    """
    tmpdir = tempfile.mkdtemp(prefix="lookml_broken_test_")
    p = Path(tmpdir)
    (p / "orders.view.lkml").write_text(textwrap.dedent(MINIMAL_VIEW_LKML), encoding="utf-8")
    (p / "orders_dup.view.lkml").write_text(textwrap.dedent(DUP_VIEW_LKML), encoding="utf-8")
    (p / "sessions.view.lkml").write_text(textwrap.dedent(MISSING_PK_VIEW_LKML), encoding="utf-8")
    (p / "customers.explore.lkml").write_text(textwrap.dedent(JOIN_NO_SQL_ON_LKML), encoding="utf-8")
    (p / "broken.explore.lkml").write_text(textwrap.dedent(BROKEN_EXPLORE_LKML), encoding="utf-8")
    yield tmpdir
    shutil.rmtree(tmpdir, ignore_errors=True)


# ── In-memory model factories ────────────────────────────────────────────────

def _field(name, field_type="dimension", sql=None, label=None,
           description=None, primary_key=False, hidden=False) -> LookMLField:
    return LookMLField(
        name=name, field_type=field_type,
        sql=sql or f"${{TABLE}}.{name}",
        label=label, description=description,
        primary_key=primary_key, hidden=hidden,
        source_file="test.view.lkml",
    )


def _view(name, fields=None, sql_table=None, derived_sql=None,
          source_file="test.view.lkml") -> LookMLView:
    return LookMLView(
        name=name,
        fields=fields or [],
        sql_table_name=sql_table or f"public.{name}",
        derived_table_sql=derived_sql,
        source_file=source_file,
    )


def _join(name, sql_on=None, relationship="many_to_one",
          from_view=None, join_type="left_outer") -> LookMLJoin:
    return LookMLJoin(
        name=name, sql_on=sql_on,
        relationship=relationship,
        from_view=from_view, type=join_type,
        source_file="test.explore.lkml",
    )


def _explore(name, joins=None, from_view=None) -> LookMLExplore:
    return LookMLExplore(
        name=name, joins=joins or [],
        from_view=from_view,
        source_file="test.explore.lkml",
    )


def _project(views=None, explores=None, name="test") -> LookMLProject:
    return LookMLProject(
        name=name, root_path="",
        views=views or [],
        explores=explores or [],
    )


@pytest.fixture
def make_field():
    return _field


@pytest.fixture
def make_view():
    return _view


@pytest.fixture
def make_join():
    return _join


@pytest.fixture
def make_explore():
    return _explore


@pytest.fixture
def make_project():
    return _project


@pytest.fixture
def clean_project() -> LookMLProject:
    """Perfect clean project — no issues expected."""
    view = _view("orders", fields=[
        _field("id", primary_key=True, label="Order ID", description="Unique ID"),
        _field("status", label="Status", description="Order status"),
        _field("count", field_type="measure", label="Count", description="Orders count"),
    ])
    explore = _explore("orders")
    return _project(views=[view], explores=[explore])
