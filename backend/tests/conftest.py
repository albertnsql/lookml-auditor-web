"""
conftest.py — Shared pytest fixtures for LookML Auditor Web Backend.

Provides:
  - sys.path wiring so 'core/' modules resolve correctly
  - FastAPI TestClient (session-scoped)
  - In-memory model factories (_field, _view, _join, _explore, _project)
  - Disk-backed project fixtures (tmpdir with real .lkml files)
  - Pre-built LookMLProject fixtures for every major scenario
"""
from __future__ import annotations

import os
import sys
import shutil
import tempfile
import textwrap
from pathlib import Path
from typing import Generator

import pytest

# ── Path setup ───────────────────────────────────────────────────────────────
_BACKEND_DIR = Path(__file__).parent.parent          # .../backend/
_CORE_DIR    = _BACKEND_DIR / "core"

sys.path.insert(0, str(_BACKEND_DIR))
sys.path.insert(0, str(_CORE_DIR))

from lookml_parser.models import (
    LookMLProject, LookMLView, LookMLField, LookMLExplore, LookMLJoin,
)

# ═══════════════════════════════════════════════════════════════════════════
# Raw LookML template strings (used by disk-backed fixtures)
# ═══════════════════════════════════════════════════════════════════════════

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

SUPPRESSION_YAML = """\
suppress:
  - check: join_integrity
    pattern: "legacy_*"
  - check: duplicate
    object: "orders"
  - file: "legacy.model.lkml"
    check: "*"
suppress_checks:
  - field_documentation
"""

# ═══════════════════════════════════════════════════════════════════════════
# FastAPI TestClient (session-scoped — created once per test session)
# ═══════════════════════════════════════════════════════════════════════════

@pytest.fixture(scope="session")
def client():
    """HTTPX-backed TestClient for the FastAPI app."""
    from fastapi.testclient import TestClient
    from main import app
    with TestClient(app) as c:
        yield c


# ═══════════════════════════════════════════════════════════════════════════
# In-memory model factories
# ═══════════════════════════════════════════════════════════════════════════

def _field(
    name: str,
    field_type: str = "dimension",
    sql: str | None = None,
    label: str | None = None,
    description: str | None = None,
    primary_key: bool = False,
    hidden: bool = False,
    data_type: str | None = None,
    tags: list[str] | None = None,
    filters: str | None = None,
    source_file: str = "test.view.lkml",
    line_number: int = 1,
) -> LookMLField:
    return LookMLField(
        name=name,
        field_type=field_type,
        sql=sql or f"${{TABLE}}.{name}",
        label=label,
        description=description,
        primary_key=primary_key,
        hidden=hidden,
        data_type=data_type,
        tags=tags or [],
        filters=filters,
        source_file=source_file,
        line_number=line_number,
    )


def _view(
    name: str,
    fields: list[LookMLField] | None = None,
    sql_table: str | None = None,
    derived_sql: str | None = None,
    extends: list[str] | None = None,
    source_file: str = "test.view.lkml",
    line_number: int = 1,
) -> LookMLView:
    return LookMLView(
        name=name,
        fields=fields or [],
        sql_table_name=sql_table if (sql_table is not None or derived_sql is not None)
                       else f"public.{name}",
        derived_table_sql=derived_sql,
        extends=extends or [],
        source_file=source_file,
        line_number=line_number,
    )


def _join(
    name: str,
    sql_on: str | None = None,
    relationship: str | None = "many_to_one",
    from_view: str | None = None,
    join_type: str | None = "left_outer",
    sql_where: str | None = None,
    foreign_key: str | None = None,
    source_file: str = "test.explore.lkml",
    line_number: int = 1,
) -> LookMLJoin:
    return LookMLJoin(
        name=name,
        sql_on=sql_on,
        relationship=relationship,
        from_view=from_view,
        type=join_type,
        sql_where=sql_where,
        foreign_key=foreign_key,
        source_file=source_file,
        line_number=line_number,
    )


def _explore(
    name: str,
    joins: list[LookMLJoin] | None = None,
    from_view: str | None = None,
    view_name: str | None = None,
    label: str | None = None,
    description: str | None = None,
    source_file: str = "test.explore.lkml",
    line_number: int = 1,
) -> LookMLExplore:
    return LookMLExplore(
        name=name,
        joins=joins or [],
        from_view=from_view,
        view_name=view_name,
        label=label,
        description=description,
        source_file=source_file,
        line_number=line_number,
    )


def _project(
    views: list[LookMLView] | None = None,
    explores: list[LookMLExplore] | None = None,
    name: str = "test_project",
    root_path: str = "/tmp/test",
    manifest_constants: dict | None = None,
) -> LookMLProject:
    return LookMLProject(
        name=name,
        root_path=root_path,
        views=views or [],
        explores=explores or [],
        manifest_constants=manifest_constants or {},
    )


# ── pytest fixture wrappers ──────────────────────────────────────────────────

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


# ═══════════════════════════════════════════════════════════════════════════
# Pre-built in-memory project fixtures
# ═══════════════════════════════════════════════════════════════════════════

@pytest.fixture
def clean_project() -> LookMLProject:
    """Perfect project: 2 views, 1 explore, no issues expected."""
    orders = _view("orders", fields=[
        _field("id", primary_key=True, label="Order ID", description="Unique ID"),
        _field("status", label="Status", description="Order status"),
        _field("count", field_type="measure", label="Count", description="Orders count"),
    ])
    customers = _view("customers", fields=[
        _field("id", primary_key=True, label="Customer ID", description="Unique customer ID"),
        _field("name", label="Name", description="Customer name"),
    ])
    explore = _explore(
        "orders",
        joins=[_join("customers", sql_on="${orders.customer_id} = ${customers.id}")],
        label="Orders",
        description="Core orders explore",
    )
    return _project(views=[orders, customers], explores=[explore])


@pytest.fixture
def empty_project() -> LookMLProject:
    """Completely empty project — no views, no explores."""
    return _project()


@pytest.fixture
def broken_refs_project() -> LookMLProject:
    """Explore with base view and join that reference non-existent views."""
    explore = _explore(
        "ghost",
        from_view="non_existent_view",
        joins=[_join("also_missing")],
    )
    return _project(views=[], explores=[explore])


@pytest.fixture
def dup_views_same_folder_project() -> LookMLProject:
    """Two views with same name from the same folder → ERROR duplicate."""
    v1 = _view("orders", source_file="/repo/views/orders.view.lkml")
    v2 = _view("orders", source_file="/repo/views/orders_dup.view.lkml")
    return _project(views=[v1, v2])


@pytest.fixture
def dup_views_diff_folder_project() -> LookMLProject:
    """Two views with same name from different folders → WARNING duplicate."""
    v1 = _view("orders", source_file="/repo/dev/orders.view.lkml")
    v2 = _view("orders", source_file="/repo/prod/orders.view.lkml")
    return _project(views=[v1, v2])


@pytest.fixture
def missing_pk_project() -> LookMLProject:
    """View with no primary_key: yes field."""
    view = _view("sessions", fields=[
        _field("session_id", label="Session ID", description="Session identifier"),
        _field("count", field_type="measure", label="Count", description="Count"),
    ])
    return _project(views=[view])


@pytest.fixture
def join_no_sql_on_project() -> LookMLProject:
    """Explore with join that has no sql_on and no foreign_key → ERROR."""
    orders = _view("orders", fields=[_field("id", primary_key=True, label="ID", description="ID")])
    customers = _view("customers", fields=[_field("id", primary_key=True, label="ID", description="ID")])
    explore = _explore("customers", joins=[
        _join("orders", sql_on=None, relationship="many_to_one", join_type="left_outer"),
    ])
    return _project(views=[orders, customers], explores=[explore])


@pytest.fixture
def join_no_relationship_project() -> LookMLProject:
    """Explore with join that has sql_on but no relationship → WARNING."""
    orders = _view("orders", fields=[
        _field("id", primary_key=True, label="ID", description="ID"),
        _field("customer_id", label="Customer ID", description="FK"),
    ])
    customers = _view("customers", fields=[
        _field("id", primary_key=True, label="ID", description="ID"),
    ])
    explore = _explore("orders", joins=[
        _join("customers", sql_on="${orders.customer_id} = ${customers.id}", relationship=None),
    ])
    return _project(views=[orders, customers], explores=[explore])


@pytest.fixture
def orphan_view_project() -> LookMLProject:
    """A view that is not referenced by any explore → INFO orphan."""
    referenced = _view("orders", fields=[_field("id", primary_key=True, label="ID", description="ID")])
    orphan = _view("unused_view", fields=[_field("id", primary_key=True, label="ID", description="ID")])
    explore = _explore("orders")
    return _project(views=[referenced, orphan], explores=[explore])


@pytest.fixture
def undocumented_fields_project() -> LookMLProject:
    """View with fields missing labels and descriptions → INFO field quality."""
    view = _view("products", fields=[
        _field("id", primary_key=True),          # no label, no description
        _field("name", label=None, description=None),
        _field("count", field_type="measure"),   # no label, no description
    ])
    explore = _explore("products")
    return _project(views=[view], explores=[explore])


@pytest.fixture
def dup_sql_project() -> LookMLProject:
    """View where two non-PK fields share identical SQL → WARNING duplicate SQL."""
    view = _view("dup_sql", fields=[
        _field("id", primary_key=True, sql="${TABLE}.id", label="ID", description="ID"),
        _field("status", sql="${TABLE}.status", label="Status", description="Status"),
        _field("state",  sql="${TABLE}.status", label="State",  description="State alias"),
    ])
    return _project(views=[view])


@pytest.fixture
def dup_sql_diff_filters_project() -> LookMLProject:
    """View where two measures share identical SQL but have different filters → No issue."""
    view = _view("dup_sql_filters", fields=[
        _field("id", primary_key=True, sql="${TABLE}.id", label="ID", description="ID"),
        _field("customers_npc", field_type="measure", sql="${TABLE}.customers", filters='[org: "NPC"]', label="Customers NPC"),
        _field("customers_npl", field_type="measure", sql="${TABLE}.customers", filters='[org: "NPL"]', label="Customers NPL"),
    ])
    return _project(views=[view])


@pytest.fixture
def dup_table_refs_project() -> LookMLProject:
    """Two views pointing to same sql_table_name → WARNING duplicate table ref."""
    v1 = _view("alpha", sql_table="shared.my_table",
               fields=[_field("id", primary_key=True, label="ID", description="ID")])
    v2 = _view("beta",  sql_table="shared.my_table",
               fields=[_field("id", primary_key=True, label="ID", description="ID")])
    return _project(views=[v1, v2])


@pytest.fixture
def extends_project() -> LookMLProject:
    """Child view that extends base — duplicate fields should NOT be flagged."""
    base = _view("base_view", fields=[
        _field("id", primary_key=True, label="ID", description="ID"),
    ])
    child = _view("child_view", extends=["base_view"], fields=[
        _field("id", primary_key=True, label="Child ID", description="Override"),
    ])
    explore = _explore("child_view")
    return _project(views=[base, child], explores=[explore])


@pytest.fixture
def cross_join_project() -> LookMLProject:
    """Cross join — should NOT flag missing sql_on."""
    base = _view("orders", fields=[_field("id", primary_key=True, label="ID", description="ID")])
    dim = _view("dim_table", fields=[_field("id", primary_key=True, label="ID", description="ID")])
    explore = _explore("orders", joins=[
        _join("dim_table", sql_on=None, relationship=None, join_type="cross"),
    ])
    return _project(views=[base, dim], explores=[explore])


@pytest.fixture
def explore_with_from_alias_project() -> LookMLProject:
    """Explore using 'from:' alias — base view lookup must use resolved name."""
    actual_view = _view("sales_data", fields=[
        _field("id", primary_key=True, label="ID", description="ID"),
    ])
    explore = _explore("sales_alias", from_view="sales_data")
    return _project(views=[actual_view], explores=[explore])


# ═══════════════════════════════════════════════════════════════════════════
# Disk-backed project fixtures (real .lkml files on disk)
# ═══════════════════════════════════════════════════════════════════════════

@pytest.fixture(scope="session")
def minimal_project_dir() -> Generator[str, None, None]:
    """
    Clean project on disk:
      - orders.view.lkml     (has PK, labels, descriptions)
      - core.explore.lkml    (clean explore referencing orders)
    """
    tmpdir = tempfile.mkdtemp(prefix="lookml_web_minimal_")
    p = Path(tmpdir)
    (p / "orders.view.lkml").write_text(textwrap.dedent(VIEW_ORDERS), encoding="utf-8")
    (p / "core.explore.lkml").write_text(textwrap.dedent(EXPLORE_ORDERS_CLEAN), encoding="utf-8")
    yield tmpdir
    shutil.rmtree(tmpdir, ignore_errors=True)


@pytest.fixture
def broken_project_dir() -> Generator[str, None, None]:
    """
    Project with intentional issues on disk:
      - ghost explore with non-existent base view
      - duplicate orders view in same folder → ERROR
      - sessions view with no PK → WARNING
      - customers explore with join missing sql_on → ERROR
    """
    tmpdir = tempfile.mkdtemp(prefix="lookml_web_broken_")
    p = Path(tmpdir)
    (p / "orders.view.lkml").write_text(textwrap.dedent(VIEW_ORDERS), encoding="utf-8")
    (p / "orders_dup.view.lkml").write_text(textwrap.dedent(VIEW_ORDERS_DUP_SAME_FOLDER), encoding="utf-8")
    (p / "sessions.view.lkml").write_text(textwrap.dedent(VIEW_SESSIONS_NO_PK), encoding="utf-8")
    (p / "customers.view.lkml").write_text(textwrap.dedent(VIEW_CUSTOMERS), encoding="utf-8")
    (p / "customers.explore.lkml").write_text(textwrap.dedent(EXPLORE_JOIN_NO_SQL_ON), encoding="utf-8")
    (p / "broken.explore.lkml").write_text(textwrap.dedent(EXPLORE_GHOST), encoding="utf-8")
    yield tmpdir
    shutil.rmtree(tmpdir, ignore_errors=True)


@pytest.fixture
def empty_project_dir() -> Generator[str, None, None]:
    """A directory with no .lkml files at all."""
    tmpdir = tempfile.mkdtemp(prefix="lookml_web_empty_")
    yield tmpdir
    shutil.rmtree(tmpdir, ignore_errors=True)


@pytest.fixture
def tiny_file_project_dir() -> Generator[str, None, None]:
    """A .lkml file under the 10-byte threshold — should be skipped."""
    tmpdir = tempfile.mkdtemp(prefix="lookml_web_tiny_")
    (Path(tmpdir) / "tiny.view.lkml").write_text("view:", encoding="utf-8")  # 5 bytes
    yield tmpdir
    shutil.rmtree(tmpdir, ignore_errors=True)


@pytest.fixture
def dup_views_disk_project_dir() -> Generator[str, None, None]:
    """Two files in the same folder defining the same view name → ERROR."""
    tmpdir = tempfile.mkdtemp(prefix="lookml_web_dupviews_")
    p = Path(tmpdir)
    (p / "orders.view.lkml").write_text(textwrap.dedent(VIEW_ORDERS), encoding="utf-8")
    (p / "orders_copy.view.lkml").write_text(textwrap.dedent(VIEW_ORDERS_DUP_SAME_FOLDER), encoding="utf-8")
    yield tmpdir
    shutil.rmtree(tmpdir, ignore_errors=True)


@pytest.fixture
def manifest_project_dir() -> Generator[str, None, None]:
    """Project with manifest.lkml containing a constant used in sql_table_name."""
    tmpdir = tempfile.mkdtemp(prefix="lookml_web_manifest_")
    p = Path(tmpdir)
    (p / "manifest.lkml").write_text(textwrap.dedent(MANIFEST_LKML), encoding="utf-8")
    (p / "manifest_view.view.lkml").write_text(textwrap.dedent(VIEW_WITH_CONSTANT), encoding="utf-8")
    (p / "core.explore.lkml").write_text("explore: manifest_view {}\n", encoding="utf-8")
    yield tmpdir
    shutil.rmtree(tmpdir, ignore_errors=True)


@pytest.fixture
def suppression_project_dir() -> Generator[str, None, None]:
    """Project dir with lookml_auditor.yaml suppression config."""
    tmpdir = tempfile.mkdtemp(prefix="lookml_web_suppress_")
    p = Path(tmpdir)
    (p / "orders.view.lkml").write_text(textwrap.dedent(VIEW_ORDERS), encoding="utf-8")
    (p / "orders_dup.view.lkml").write_text(textwrap.dedent(VIEW_ORDERS_DUP_SAME_FOLDER), encoding="utf-8")
    (p / "sessions.view.lkml").write_text(textwrap.dedent(VIEW_SESSIONS_NO_PK), encoding="utf-8")
    (p / "core.explore.lkml").write_text(textwrap.dedent(EXPLORE_ORDERS_CLEAN), encoding="utf-8")
    (p / "lookml_auditor.yaml").write_text(textwrap.dedent(SUPPRESSION_YAML), encoding="utf-8")
    yield tmpdir
    shutil.rmtree(tmpdir, ignore_errors=True)


@pytest.fixture
def derived_table_project_dir() -> Generator[str, None, None]:
    """Project with a derived table view and a cross join explore."""
    tmpdir = tempfile.mkdtemp(prefix="lookml_web_dt_")
    p = Path(tmpdir)
    (p / "orders.view.lkml").write_text(textwrap.dedent(VIEW_ORDERS), encoding="utf-8")
    (p / "dt_view.view.lkml").write_text(textwrap.dedent(VIEW_DERIVED_TABLE), encoding="utf-8")
    (p / "cross.explore.lkml").write_text(textwrap.dedent(EXPLORE_CROSS_JOIN), encoding="utf-8")
    yield tmpdir
    shutil.rmtree(tmpdir, ignore_errors=True)


@pytest.fixture
def undocumented_project_dir() -> Generator[str, None, None]:
    """Project where fields lack labels/descriptions → INFO field quality issues."""
    tmpdir = tempfile.mkdtemp(prefix="lookml_web_undoc_")
    p = Path(tmpdir)
    (p / "products.view.lkml").write_text(textwrap.dedent(VIEW_UNDOCUMENTED), encoding="utf-8")
    (p / "products.explore.lkml").write_text("explore: products {}\n", encoding="utf-8")
    yield tmpdir
    shutil.rmtree(tmpdir, ignore_errors=True)
