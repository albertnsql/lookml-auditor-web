"""
test_validators.py — Unit tests for all validator modules in the web backend.

Tests each check function in isolation using in-memory LookMLProject objects.
"""
from __future__ import annotations
import sys
from pathlib import Path

import pytest

_CORE_DIR = Path(__file__).parent.parent / "core"
sys.path.insert(0, str(_CORE_DIR))

from lookml_parser.models import LookMLProject, LookMLView, LookMLField, LookMLExplore, LookMLJoin
from validators.issue import IssueCategory, Severity
from validators.broken_references import check_broken_references
from validators.duplicates import check_duplicates
from validators.duplicate_tables import check_duplicate_table_refs
from validators.duplicate_sql import check_duplicate_sql
from validators.join_integrity import check_join_integrity
from validators.primary_keys import check_primary_keys
from validators.field_documentation import check_field_documentation
from validators.orphans import check_orphans
from validators import run_all_checks, compute_health_score, compute_category_scores


# ── Helpers ──────────────────────────────────────────────────────────────────

def _field(name, ft="dimension", sql=None, label=None, desc=None, pk=False, hidden=False):
    return LookMLField(
        name=name, field_type=ft,
        sql=sql or f"${{TABLE}}.{name}",
        label=label, description=desc,
        primary_key=pk, hidden=hidden,
        source_file="test.view.lkml",
    )


def _view(name, fields=None, sql_table=None, derived_sql=None, extends=None, src="a.view.lkml"):
    return LookMLView(
        name=name, fields=fields or [],
        sql_table_name=sql_table or f"public.{name}",
        derived_table_sql=derived_sql,
        extends=extends or [],
        source_file=src,
    )


def _join(name, sql_on=None, rel="many_to_one", from_view=None,
          jtype="left_outer", sql_where=None, fk=None):
    return LookMLJoin(
        name=name, sql_on=sql_on, relationship=rel,
        from_view=from_view, type=jtype,
        sql_where=sql_where, foreign_key=fk,
        source_file="test.explore.lkml",
    )


def _explore(name, joins=None, from_view=None):
    return LookMLExplore(name=name, joins=joins or [], from_view=from_view,
                         source_file="test.explore.lkml")


def _project(views=None, explores=None):
    return LookMLProject(name="test", root_path="", views=views or [], explores=explores or [])


# ─────────────────────────────────────────────────────────────────────────────
# Broken References
# ─────────────────────────────────────────────────────────────────────────────

class TestBrokenReferences:

    def test_no_issues_when_all_views_exist(self):
        orders = _view("orders")
        explore = _explore("orders")
        proj = _project(views=[orders], explores=[explore])
        assert check_broken_references(proj) == []

    def test_flags_missing_base_view(self):
        explore = _explore("ghost", from_view="missing_view")
        proj = _project(views=[], explores=[explore])
        issues = check_broken_references(proj)
        assert any(i.category == IssueCategory.BROKEN_REFERENCE for i in issues)
        assert any("missing_view" in i.message for i in issues)

    def test_flags_missing_join_view(self):
        orders = _view("orders")
        join = _join("missing_table", sql_on="${orders.id} = ${missing_table.order_id}", rel="many_to_one")
        explore = _explore("orders", joins=[join])
        proj = _project(views=[orders], explores=[explore])
        issues = check_broken_references(proj)
        assert any("missing_table" in i.message for i in issues)

    def test_valid_join_alias_not_flagged(self):
        """join alias used in sql_on should not be flagged as broken."""
        orders = _view("orders")
        customers = _view("customers")
        join = _join("cust_alias", sql_on="${orders.customer_id} = ${cust_alias.id}",
                     from_view="customers", rel="many_to_one")
        explore = _explore("orders", joins=[join])
        proj = _project(views=[orders, customers], explores=[explore])
        issues = check_broken_references(proj)
        ref_issues = [i for i in issues if "cust_alias" in i.message]
        assert ref_issues == []

    def test_case_insensitive_view_lookup(self):
        orders = _view("Orders")
        explore = _explore("orders_explore", from_view="orders")
        proj = _project(views=[orders], explores=[explore])
        issues = check_broken_references(proj)
        assert issues == []

    def test_severity_is_error(self):
        explore = _explore("ghost", from_view="nonexistent")
        proj = _project(views=[], explores=[explore])
        issues = check_broken_references(proj)
        assert all(i.severity == Severity.ERROR for i in issues)

    def test_suggestion_present(self):
        explore = _explore("ghost", from_view="nonexistent")
        proj = _project(views=[], explores=[explore])
        issues = check_broken_references(proj)
        assert all(i.suggestion for i in issues)


# ─────────────────────────────────────────────────────────────────────────────
# Duplicates
# ─────────────────────────────────────────────────────────────────────────────

class TestDuplicates:

    def test_no_issues_on_unique_views(self):
        proj = _project(views=[_view("orders"), _view("customers")])
        assert check_duplicates(proj) == []

    def test_same_folder_duplicate_view_is_error(self):
        v1 = _view("orders", src="views/orders.view.lkml")
        v2 = _view("orders", src="views/orders_dup.view.lkml")
        proj = _project(views=[v1, v2])
        issues = check_duplicates(proj)
        assert any(i.severity == Severity.ERROR and i.object_type == "view" for i in issues)

    def test_different_folder_duplicate_view_is_warning(self):
        v1 = _view("orders", src="prod/orders.view.lkml")
        v2 = _view("orders", src="staging/orders.view.lkml")
        proj = _project(views=[v1, v2])
        issues = check_duplicates(proj)
        assert any(i.severity == Severity.WARNING and i.object_type == "view" for i in issues)

    def test_duplicate_fields_in_same_view_flagged(self):
        view = _view("orders", fields=[
            _field("status", ft="dimension"),
            _field("status", ft="dimension"),  # true duplicate
        ])
        proj = _project(views=[view])
        issues = check_duplicates(proj)
        assert any(i.object_type == "field" for i in issues)

    def test_dim_group_plus_dimension_same_name_is_warning(self):
        view = _view("orders", fields=[
            _field("created", ft="dimension_group"),
            _field("created", ft="dimension"),
        ])
        proj = _project(views=[view])
        issues = check_duplicates(proj)
        dup_issues = [i for i in issues if "dimension_group" in i.message or "dimension" in i.message]
        assert any(i.severity == Severity.WARNING for i in issues if i.object_type == "field")

    def test_extends_view_skipped_for_field_duplicates(self):
        """Views using extends: should not flag field overrides."""
        view = _view("orders_extended", fields=[
            _field("status", ft="dimension"),
            _field("status", ft="dimension"),
        ], extends=["orders"])
        proj = _project(views=[view])
        issues = check_duplicates(proj)
        assert all(i.object_type != "field" for i in issues)


# ─────────────────────────────────────────────────────────────────────────────
# Duplicate SQL Tables
# ─────────────────────────────────────────────────────────────────────────────

class TestDuplicateTables:

    def test_no_issues_unique_tables(self):
        proj = _project(views=[
            _view("orders",    sql_table="public.orders"),
            _view("customers", sql_table="public.customers"),
        ])
        assert check_duplicate_table_refs(proj) == []

    def test_same_table_in_two_views_flagged(self):
        proj = _project(views=[
            _view("orders_v1", sql_table="public.orders"),
            _view("orders_v2", sql_table="public.orders"),
        ])
        issues = check_duplicate_table_refs(proj)
        assert len(issues) == 1
        assert "public.orders" in issues[0].message.lower()

    def test_severity_is_warning(self):
        proj = _project(views=[
            _view("a", sql_table="public.shared"),
            _view("b", sql_table="public.shared"),
        ])
        issues = check_duplicate_table_refs(proj)
        assert all(i.severity == Severity.WARNING for i in issues)

    def test_case_insensitive_table_comparison(self):
        proj = _project(views=[
            _view("a", sql_table="Public.Orders"),
            _view("b", sql_table="public.orders"),
        ])
        issues = check_duplicate_table_refs(proj)
        assert len(issues) == 1

    def test_derived_tables_skipped(self):
        proj = _project(views=[
            _view("dt", sql_table=None, derived_sql="SELECT 1"),
        ])
        assert check_duplicate_table_refs(proj) == []


# ─────────────────────────────────────────────────────────────────────────────
# Duplicate SQL Expressions
# ─────────────────────────────────────────────────────────────────────────────

class TestDuplicateSQL:

    def test_no_issues_unique_sql(self):
        view = _view("orders", fields=[
            _field("id",     sql='${TABLE}.id'),
            _field("status", sql='${TABLE}.status'),
        ])
        assert check_duplicate_sql(_project(views=[view])) == []

    def test_same_sql_two_non_pk_fields_is_warning(self):
        view = _view("orders", fields=[
            _field("field_a", sql='${TABLE}."CUSTOMER_NUMBER"'),
            _field("field_b", sql='${TABLE}."CUSTOMER_NUMBER"'),
        ])
        issues = check_duplicate_sql(_project(views=[view]))
        assert len(issues) == 1
        assert issues[0].severity == Severity.WARNING

    def test_pk_sharing_sql_is_info(self):
        view = _view("orders", fields=[
            _field("id",       sql='${TABLE}.id', pk=True),
            _field("order_id", sql='${TABLE}.id'),
        ])
        issues = check_duplicate_sql(_project(views=[view]))
        assert len(issues) == 1
        assert issues[0].severity == Severity.INFO

    def test_trivial_sql_skipped(self):
        """Short SQL like '1' or '${table}' should not be flagged."""
        view = _view("orders", fields=[
            _field("a", sql="1"),
            _field("b", sql="1"),
        ])
        assert check_duplicate_sql(_project(views=[view])) == []


# ─────────────────────────────────────────────────────────────────────────────
# Join Integrity
# ─────────────────────────────────────────────────────────────────────────────

class TestJoinIntegrity:

    def test_valid_join_no_issues(self):
        orders = _view("orders", fields=[_field("id", pk=True), _field("customer_id")])
        customers = _view("customers", fields=[_field("id", pk=True)])
        join = _join("customers",
                     sql_on="${orders.customer_id} = ${customers.id}",
                     rel="many_to_one")
        explore = _explore("orders", joins=[join])
        proj = _project(views=[orders, customers], explores=[explore])
        issues = check_join_integrity(proj)
        assert issues == []

    def test_missing_sql_on_and_fk_is_error(self):
        orders = _view("orders")
        payments = _view("payments")
        join = _join("payments", sql_on=None, rel="many_to_one")
        explore = _explore("orders", joins=[join])
        proj = _project(views=[orders, payments], explores=[explore])
        issues = check_join_integrity(proj)
        assert any(i.severity == Severity.ERROR for i in issues)
        assert any("no sql_on or foreign_key" in i.message for i in issues)

    def test_missing_relationship_is_warning(self):
        orders = _view("orders")
        customers = _view("customers")
        join = _join("customers",
                     sql_on="${orders.customer_id} = ${customers.id}",
                     rel=None)
        explore = _explore("orders", joins=[join])
        proj = _project(views=[orders, customers], explores=[explore])
        issues = check_join_integrity(proj)
        assert any(i.severity == Severity.WARNING and "relationship" in i.message for i in issues)

    def test_sql_where_instead_of_sql_on_is_warning(self):
        orders = _view("orders")
        payments = _view("payments")
        join = _join("payments", sql_on=None, rel="many_to_one",
                     sql_where="${orders.id} = ${payments.order_id}")
        explore = _explore("orders", joins=[join])
        proj = _project(views=[orders, payments], explores=[explore])
        issues = check_join_integrity(proj)
        assert any(i.severity == Severity.WARNING and "sql_where" in i.message for i in issues)

    def test_cross_join_no_condition_not_flagged(self):
        orders = _view("orders")
        dim = _view("dim_date")
        join = _join("dim_date", sql_on=None, rel="many_to_many", jtype="cross")
        explore = _explore("orders", joins=[join])
        proj = _project(views=[orders, dim], explores=[explore])
        issues = [i for i in check_join_integrity(proj)
                  if "no sql_on or foreign_key" in i.message]
        assert issues == []

    def test_foreign_key_satisfies_condition(self):
        orders = _view("orders")
        customers = _view("customers")
        join = _join("customers", sql_on=None, rel="many_to_one", fk="customer_id")
        explore = _explore("orders", joins=[join])
        proj = _project(views=[orders, customers], explores=[explore])
        issues = [i for i in check_join_integrity(proj)
                  if "no sql_on or foreign_key" in i.message]
        assert issues == []

    def test_explore_alias_valid_in_sql_on(self):
        """explore: funnel { from: orders } — ${funnel.id} is a valid alias."""
        orders = _view("orders", fields=[_field("id", pk=True), _field("customer_id")])
        customers = _view("customers")
        join = _join("customers",
                     sql_on="${funnel.customer_id} = ${customers.id}",
                     rel="many_to_one")
        explore = _explore("funnel", joins=[join], from_view="orders")
        proj = _project(views=[orders, customers], explores=[explore])
        issues = check_join_integrity(proj)
        errors = [i for i in issues if i.severity == Severity.ERROR]
        assert errors == []


# ─────────────────────────────────────────────────────────────────────────────
# Primary Keys
# ─────────────────────────────────────────────────────────────────────────────

class TestPrimaryKeys:

    def test_no_issue_when_pk_defined(self):
        view = _view("orders", fields=[_field("id", pk=True)])
        proj = _project(views=[view])
        assert check_primary_keys(proj) == []

    def test_flags_view_without_pk(self):
        view = _view("sessions", fields=[_field("session_id")])
        proj = _project(views=[view])
        issues = check_primary_keys(proj)
        assert len(issues) == 1
        assert issues[0].object_name == "sessions"
        assert issues[0].severity == Severity.WARNING

    def test_flags_multiple_views_missing_pk(self):
        proj = _project(views=[
            _view("a", fields=[_field("x")]),
            _view("b", fields=[_field("y")]),
            _view("c", fields=[_field("z", pk=True)]),
        ])
        issues = check_primary_keys(proj)
        flagged = {i.object_name for i in issues}
        assert "a" in flagged
        assert "b" in flagged
        assert "c" not in flagged

    def test_category_is_field_quality(self):
        view = _view("sessions", fields=[_field("session_id")])
        issues = check_primary_keys(_project(views=[view]))
        assert all(i.category == IssueCategory.FIELD_QUALITY for i in issues)


# ─────────────────────────────────────────────────────────────────────────────
# Field Documentation
# ─────────────────────────────────────────────────────────────────────────────

class TestFieldDocumentation:

    def test_no_issues_when_all_documented(self):
        view = _view("orders", fields=[
            _field("id", label="ID", desc="Unique ID"),
        ])
        assert check_field_documentation(_project(views=[view])) == []

    def test_flags_view_with_missing_label(self):
        view = _view("orders", fields=[
            _field("id", label=None, desc="Some desc"),
        ])
        issues = check_field_documentation(_project(views=[view]))
        assert any("missing label" in i.message for i in issues)

    def test_flags_view_with_missing_description(self):
        view = _view("orders", fields=[
            _field("id", label="ID", desc=None),
        ])
        issues = check_field_documentation(_project(views=[view]))
        assert any("missing description" in i.message for i in issues)

    def test_hidden_fields_excluded(self):
        view = _view("orders", fields=[
            _field("internal", hidden=True, label=None, desc=None),
        ])
        assert check_field_documentation(_project(views=[view])) == []

    def test_filter_fields_excluded(self):
        view = _view("orders", fields=[
            LookMLField(name="f", field_type="filter", sql="${TABLE}.f",
                        label=None, description=None, source_file="x"),
        ])
        assert check_field_documentation(_project(views=[view])) == []

    def test_one_issue_per_view_not_per_field(self):
        """check_field_documentation returns one summary Issue per view."""
        view = _view("orders", fields=[
            _field(f"field_{i}", label=None, desc=None) for i in range(10)
        ])
        issues = check_field_documentation(_project(views=[view]))
        assert len(issues) == 1

    def test_severity_is_info(self):
        view = _view("orders", fields=[_field("id", label=None)])
        issues = check_field_documentation(_project(views=[view]))
        assert all(i.severity == Severity.INFO for i in issues)


# ─────────────────────────────────────────────────────────────────────────────
# Orphans
# ─────────────────────────────────────────────────────────────────────────────

class TestOrphans:

    def test_no_issues_when_all_views_referenced(self):
        orders = _view("orders")
        customers = _view("customers")
        join = _join("customers", sql_on="${orders.id} = ${customers.order_id}", rel="many_to_one")
        explore = _explore("orders", joins=[join])
        proj = _project(views=[orders, customers], explores=[explore])
        orphan_issues = [i for i in check_orphans(proj) if "not referenced" in i.message]
        assert orphan_issues == []

    def test_unreferenced_view_flagged(self):
        orders = _view("orders")
        staging = _view("staging_temp")
        explore = _explore("orders")
        proj = _project(views=[orders, staging], explores=[explore])
        issues = check_orphans(proj)
        orphan_names = {i.object_name for i in issues if "not referenced" in i.message}
        assert "staging_temp" in orphan_names

    def test_zombie_explore_flagged(self):
        orders = _view("orders")
        zombie = _explore("ghost", from_view="nonexistent")
        proj = _project(views=[orders], explores=[zombie])
        issues = check_orphans(proj)
        assert any(i.category == IssueCategory.BROKEN_REFERENCE for i in issues)

    def test_extended_view_not_flagged_as_orphan(self):
        base = _view("orders_base")
        child = _view("orders_ext", extends=["orders_base"])
        explore = _explore("orders_ext")
        proj = _project(views=[base, child], explores=[explore])
        orphan_issues = [i for i in check_orphans(proj)
                         if "not referenced" in i.message and i.object_name == "orders_base"]
        assert orphan_issues == []


# ─────────────────────────────────────────────────────────────────────────────
# Health Score
# ─────────────────────────────────────────────────────────────────────────────

class TestHealthScore:

    def test_perfect_score_no_issues(self, clean_project):
        issues = run_all_checks(clean_project)
        score = compute_health_score(issues, clean_project)
        assert score == 100

    def test_score_range(self):
        from validators.issue import Issue
        issues = [
            Issue(category=IssueCategory.BROKEN_REFERENCE, severity=Severity.ERROR,
                  message="err", object_type="explore", object_name="x")
        ] * 5
        proj = _project(
            views=[_view("v1"), _view("v2")],
            explores=[_explore("e1"), _explore("e2")],
        )
        score = compute_health_score(issues, proj)
        assert 0 <= score <= 100

    def test_errors_reduce_score_more_than_infos(self):
        from validators.issue import Issue
        err_issues = [
            Issue(category=IssueCategory.BROKEN_REFERENCE, severity=Severity.ERROR,
                  message="err", object_type="explore", object_name="x")
        ] * 3
        info_issues = [
            Issue(category=IssueCategory.FIELD_QUALITY, severity=Severity.INFO,
                  message="info", object_type="view", object_name="y")
        ] * 50
        score_errors = compute_health_score(err_issues)
        score_infos  = compute_health_score(info_issues)
        assert score_errors < score_infos

    def test_fallback_score_without_project(self):
        from validators.issue import Issue
        issues = [
            Issue(category=IssueCategory.BROKEN_REFERENCE, severity=Severity.ERROR,
                  message="err", object_type="explore", object_name="x")
        ]
        score = compute_health_score(issues)
        assert score < 100

    def test_category_scores_keys(self, clean_project):
        issues = run_all_checks(clean_project)
        scores = compute_category_scores(issues, clean_project)
        assert set(scores.keys()) == {
            "Broken Reference", "Duplicate Def", "Join Integrity", "Field Quality"
        }

    def test_category_scores_range(self, clean_project):
        issues = run_all_checks(clean_project)
        scores = compute_category_scores(issues, clean_project)
        for k, v in scores.items():
            assert 0 <= v <= 100, f"{k} score out of range: {v}"

    def test_run_all_checks_returns_list(self, clean_project):
        issues = run_all_checks(clean_project)
        assert isinstance(issues, list)

    def test_clean_project_no_errors(self, clean_project):
        issues = run_all_checks(clean_project)
        errors = [i for i in issues if i.severity == Severity.ERROR]
        assert errors == []
