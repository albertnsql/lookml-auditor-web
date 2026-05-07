"""
test_ast_parser.py — Comprehensive tests for the lkml-backed AST parser.
Covers basic parsing, edge cases, and parser robustness.
"""
from __future__ import annotations

import os
import shutil
import tempfile
import textwrap
from pathlib import Path

import pytest

from lookml_parser.ast_parser import parse_project
from validators import run_all_checks, compute_health_score

class TestASTParser:
    @pytest.fixture
    def temp_project(self):
        tmpdir = tempfile.mkdtemp()
        yield Path(tmpdir)
        shutil.rmtree(tmpdir, ignore_errors=True)

    def write_file(self, path: Path, name: str, content: str):
        file_path = path / name
        file_path.write_text(textwrap.dedent(content), encoding="utf-8")
        return file_path

    # ── Basic Parsing ────────────────────────────────────────────────────────
    
    def test_basic_view_dimensions_measures(self, temp_project):
        self.write_file(temp_project, "orders.view.lkml", """
            view: orders {
              sql_table_name: "public.orders" ;;
              dimension: id {
                type: number
                primary_key: yes
                sql: ${TABLE}.id ;;
              }
              measure: count {
                type: count
              }
            }
        """)
        project = parse_project(str(temp_project))
        assert len(project.views) == 1
        view = project.views[0]
        assert view.name == "orders"
        assert view.sql_table_name == "public.orders"
        assert view.has_primary_key is True
        
        dims = [f for f in view.fields if f.field_type == "dimension"]
        measures = [f for f in view.fields if f.field_type == "measure"]
        assert len(dims) == 1
        assert len(measures) == 1
        assert dims[0].name == "id"
        assert dims[0].primary_key is True
        assert measures[0].name == "count"

    def test_basic_explore_with_joins(self, temp_project):
        self.write_file(temp_project, "core.explore.lkml", """
            explore: orders {
              join: users {
                type: left_outer
                sql_on: ${orders.user_id} = ${users.id} ;;
                relationship: many_to_one
              }
            }
        """)
        project = parse_project(str(temp_project))
        assert len(project.explores) == 1
        explore = project.explores[0]
        assert explore.name == "orders"
        assert len(explore.joins) == 1
        join = explore.joins[0]
        assert join.name == "users"
        assert join.type == "left_outer"
        assert join.sql_on == "${orders.user_id} = ${users.id}"

    # ── Edge Cases ───────────────────────────────────────────────────────────
    
    def test_jinja_in_sql(self, temp_project):
        self.write_file(temp_project, "jinja.view.lkml", """
            view: jinja_view {
              dimension: status {
                type: string
                sql: {% if condition %} ${TABLE}.status {% else %} 'unknown' {% endif %} ;;
              }
            }
        """)
        project = parse_project(str(temp_project))
        field = project.views[0].fields[0]
        assert "if condition" in field.sql
        assert "${TABLE}.status" in field.sql

    def test_multiline_sql_blocks(self, temp_project):
        self.write_file(temp_project, "multi.view.lkml", """
            view: dt {
              derived_table: {
                sql:
                  SELECT
                    id,
                    name
                  FROM public.users
                ;;
              }
            }
        """)
        project = parse_project(str(temp_project))
        assert project.views[0].is_derived_table is True
        assert "SELECT" in project.views[0].derived_table_sql
        assert "FROM public.users" in project.views[0].derived_table_sql

    def test_manifest_constant_references(self, temp_project):
        self.write_file(temp_project, "manifest.lkml", """
            constant: SCHEMA_NAME {
              value: "production"
            }
        """)
        self.write_file(temp_project, "orders.view.lkml", """
            view: orders {
              sql_table_name: "@{SCHEMA_NAME}.orders" ;;
            }
        """)
        project = parse_project(str(temp_project))
        assert project.views[0].sql_table_name == "production.orders"

    def test_explore_multiple_joins_missing_sql_on(self, temp_project):
        self.write_file(temp_project, "broken.explore.lkml", """
            explore: orders {
              join: users { type: left_outer }
              join: products { type: inner sql_on: ${orders.pid} = ${products.id} ;;}
            }
        """)
        project = parse_project(str(temp_project))
        explore = project.explores[0]
        assert len(explore.joins) == 2
        assert explore.joins[0].sql_on is None
        assert explore.joins[1].sql_on == "${orders.pid} = ${products.id}"

    def test_identical_sql_table_name(self, temp_project):
        self.write_file(temp_project, "a.view.lkml", 'view: a { sql_table_name: "public.table" ;;}')
        self.write_file(temp_project, "b.view.lkml", 'view: b { sql_table_name: "public.table" ;;}')
        project = parse_project(str(temp_project))
        assert len(project.views) == 2
        assert project.views[0].sql_table_name == "public.table"
        assert project.views[1].sql_table_name == "public.table"
        
        # Trigger duplicate table refs rule
        issues = run_all_checks(project)
        duplicate_issues = [i for i in issues if i.category.value == "Duplicate View Source"]
        assert len(duplicate_issues) > 0

    def test_view_no_primary_key(self, temp_project):
        self.write_file(temp_project, "no_pk.view.lkml", """
            view: no_pk {
              dimension: id { type: number sql: ${TABLE}.id ;; }
            }
        """)
        project = parse_project(str(temp_project))
        assert project.views[0].has_primary_key is False
        
        issues = run_all_checks(project)
        pk_issues = [i for i in issues if "no primary key defined" in i.message]
        assert len(pk_issues) == 1

    def test_orphan_view(self, temp_project):
        self.write_file(temp_project, "orphan.view.lkml", 'view: orphan {}')
        project = parse_project(str(temp_project))
        issues = run_all_checks(project)
        orphan_issues = [i for i in issues if "not referenced by any explore" in i.message]
        assert len(orphan_issues) == 1

    def test_empty_file_does_not_crash(self, temp_project):
        self.write_file(temp_project, "empty.view.lkml", "")
        project = parse_project(str(temp_project))
        assert len(project.views) == 0
        assert len(project.explores) == 0

    def test_malformed_block_skipped_gracefully(self, temp_project):
        self.write_file(temp_project, "valid.view.lkml", 'view: valid {}')
        self.write_file(temp_project, "broken.view.lkml", 'view: broken { this is invalid syntax }')
        
        project = parse_project(str(temp_project))
        # Broken view should be skipped, valid view should remain
        assert len(project.views) == 1
        assert project.views[0].name == "valid"

    # ── Line Number Tests ────────────────────────────────────────────────────
    
    def test_line_number_view_and_field(self, temp_project):
        self.write_file(temp_project, "lines.view.lkml", """
            # line 2
            view: tracked_view {
              # line 4
              dimension: tracked_dim {
                type: string
                sql: ${TABLE}.name ;;
              }
            }
        """)
        project = parse_project(str(temp_project))
        assert project.views[0].line_number == 3
        assert project.views[0].fields[0].line_number == 5

    def test_line_number_explore_and_join(self, temp_project):
        self.write_file(temp_project, "lines.explore.lkml", """
            # line 2
            explore: tracked_explore {
              # line 4
              join: tracked_join {
                type: left_outer
                sql_on: ${tracked_explore.id} = ${tracked_join.id} ;;
              }
            }
        """)
        project = parse_project(str(temp_project))
        assert project.explores[0].line_number == 3
        assert project.explores[0].joins[0].line_number == 5

    def test_line_number_name_not_found(self, temp_project):
        # Even if the text has missing labels, lkml might parse it differently, 
        # but our map shouldn't crash. We'll simulate by putting an empty string.
        # It's a pure fallback test. The parser handles it, our line map shouldn't crash.
        self.write_file(temp_project, "empty_lines.view.lkml", "view: {}")
        project = parse_project(str(temp_project))
        # No views parsed successfully by lkml (it needs a name), so no crash is good enough.
        # Let's verify line_number defaults to 0 if lkml parses a view but regex doesn't match
        # (e.g. by using a space before the colon which our simple regex doesn't catch)
        self.write_file(temp_project, "weird.view.lkml", 'view : weird { dimension: id { sql: 1 ;; } }')
        project = parse_project(str(temp_project))
        assert len(project.views) == 1
        assert project.views[0].line_number == 0

    def test_line_number_jinja_no_false_match(self, temp_project):
        self.write_file(temp_project, "jinja_lines.view.lkml", """
            view: jinja_view {
              dimension: name {
                type: string
                sql: {% if view == 'explore' %} ${TABLE}.id {% endif %} ;;
              }
            }
        """)
        project = parse_project(str(temp_project))
        # jinja contains the word 'explore' but shouldn't trigger regex
        assert len(project.explores) == 0
        assert project.views[0].line_number == 2
        assert project.views[0].fields[0].line_number == 3

    # ── Validator Integration Tests ──────────────────────────────────────────

    def test_validator_integration_health_score(self, temp_project):
        self.write_file(temp_project, "orders.view.lkml", """
            view: orders {
              sql_table_name: "public.orders" ;;
              dimension: id { 
                type: number 
                primary_key: yes 
                sql: ${TABLE}.id ;; 
                label: "ID"
                description: "Unique ID"
              }
            }
        """)
        self.write_file(temp_project, "orders.explore.lkml", """
            explore: orders {}
        """)
        project = parse_project(str(temp_project))
        issues = run_all_checks(project)
        # Should be a clean project
        assert len(issues) == 0
        
        score = compute_health_score(issues)["final_score"]
        assert score == 100


# ── PDT Classification Tests ─────────────────────────────────────────────────

class TestPDTClassification:
    """
    Verify that the parser correctly classifies PDTs vs NDTs.

    A view is a PDT if its derived_table block contains at least one of:
      persist_for, datagroup_trigger, sql_trigger_value, persist_with.
    If none are present, it is an NDT (is_pdt=False).
    """

    @pytest.fixture
    def temp_project(self):
        tmpdir = tempfile.mkdtemp()
        yield Path(tmpdir)
        shutil.rmtree(tmpdir, ignore_errors=True)

    def write_file(self, path: Path, name: str, content: str):
        file_path = path / name
        file_path.write_text(textwrap.dedent(content), encoding="utf-8")
        return file_path

    def test_ndt_is_not_pdt(self, temp_project):
        """A plain SQL derived table with no persistence key → is_pdt=False."""
        self.write_file(temp_project, "ndt.view.lkml", """
            view: ndt_view {
              derived_table: {
                sql:
                  SELECT id, name FROM public.users ;;
              }
            }
        """)
        project = parse_project(str(temp_project))
        assert len(project.views) == 1
        view = project.views[0]
        assert view.is_derived_table is True
        assert view.is_pdt is False, "Plain NDT should NOT be classified as PDT"

    def test_persist_for_triggers_pdt(self, temp_project):
        """persist_for is a canonical PDT key → is_pdt=True."""
        self.write_file(temp_project, "pdt_persist_for.view.lkml", """
            view: pdt_persist_for {
              derived_table: {
                sql: SELECT id FROM public.orders ;;
                persist_for: "24 hours"
              }
            }
        """)
        project = parse_project(str(temp_project))
        assert len(project.views) == 1
        view = project.views[0]
        assert view.is_derived_table is True
        assert view.is_pdt is True, "persist_for should classify view as PDT"

    def test_datagroup_trigger_triggers_pdt(self, temp_project):
        """datagroup_trigger is a canonical PDT key → is_pdt=True."""
        self.write_file(temp_project, "pdt_datagroup.view.lkml", """
            view: pdt_datagroup {
              derived_table: {
                sql: SELECT id FROM public.orders ;;
                datagroup_trigger: daily_datagroup
              }
            }
        """)
        project = parse_project(str(temp_project))
        assert len(project.views) == 1
        view = project.views[0]
        assert view.is_pdt is True, "datagroup_trigger should classify view as PDT"

    def test_sql_trigger_value_triggers_pdt(self, temp_project):
        """sql_trigger_value is a canonical PDT key → is_pdt=True."""
        self.write_file(temp_project, "pdt_sql_trigger.view.lkml", """
            view: pdt_sql_trigger {
              derived_table: {
                sql: SELECT id FROM public.orders ;;
                sql_trigger_value: SELECT MAX(updated_at) FROM public.orders ;;
              }
            }
        """)
        project = parse_project(str(temp_project))
        assert len(project.views) == 1
        view = project.views[0]
        assert view.is_pdt is True, "sql_trigger_value should classify view as PDT"

    def test_persist_with_triggers_pdt(self, temp_project):
        """persist_with is a canonical PDT key → is_pdt=True."""
        self.write_file(temp_project, "pdt_persist_with.view.lkml", """
            view: pdt_persist_with {
              derived_table: {
                sql: SELECT id FROM public.orders ;;
                persist_with: weekly_datagroup
              }
            }
        """)
        project = parse_project(str(temp_project))
        assert len(project.views) == 1
        view = project.views[0]
        assert view.is_pdt is True, "persist_with should classify view as PDT"

    def test_sql_table_view_is_not_pdt(self, temp_project):
        """A regular sql_table_name view is not a derived table at all."""
        self.write_file(temp_project, "plain.view.lkml", """
            view: plain_view {
              sql_table_name: "public.orders" ;;
            }
        """)
        project = parse_project(str(temp_project))
        assert len(project.views) == 1
        view = project.views[0]
        assert view.is_derived_table is False
        assert view.is_pdt is False

    def test_mixed_pdt_and_ndt_in_project(self, temp_project):
        """
        Before fix: pdtCount=0, ndtCount=2 (both counted as NDT)
        After fix:  pdtCount=1, ndtCount=1
        """
        self.write_file(temp_project, "ndt.view.lkml", """
            view: ndt_view {
              derived_table: {
                sql: SELECT id FROM public.source ;;
              }
            }
        """)
        self.write_file(temp_project, "pdt.view.lkml", """
            view: pdt_view {
              derived_table: {
                sql: SELECT id FROM public.source ;;
                persist_for: "1 hour"
              }
            }
        """)
        project = parse_project(str(temp_project))
        assert len(project.views) == 2

        pdt_views = [v for v in project.views if v.is_pdt]
        ndt_views  = [v for v in project.views if v.is_derived_table and not v.is_pdt]

        assert len(pdt_views) == 1, f"Expected 1 PDT, got {len(pdt_views)}"
        assert pdt_views[0].name == "pdt_view"

        assert len(ndt_views) == 1, f"Expected 1 NDT, got {len(ndt_views)}"
        assert ndt_views[0].name == "ndt_view"

    def test_pdt_count_before_after_summary(self, temp_project):
        """
        Regression test matching the National Pen fixture scenario:
        Multiple PDTs and NDTs in the same project — verify the counts are correct.

        BEFORE fix: All DTs classified as NDT (is_pdt always False).
        AFTER fix:  Only DTs with persistence keys classified as PDT.
        """
        # 2 PDTs: one with persist_for, one with datagroup_trigger
        self.write_file(temp_project, "pdt1.view.lkml", """
            view: mcp_claims_summary {
              derived_table: {
                sql: SELECT claim_id, amount FROM public.claims ;;
                persist_for: "24 hours"
              }
            }
        """)
        self.write_file(temp_project, "pdt2.view.lkml", """
            view: np_contact_center_gross_margin {
              derived_table: {
                sql: SELECT order_id, margin FROM public.orders ;;
                datagroup_trigger: daily_datagroup
              }
            }
        """)
        # 1 NDT: plain SQL, no persistence key
        self.write_file(temp_project, "ndt1.view.lkml", """
            view: temp_session_data {
              derived_table: {
                sql: SELECT session_id, user_id FROM public.sessions ;;
              }
            }
        """)

        project = parse_project(str(temp_project))
        assert len(project.views) == 3

        pdt_views = [v for v in project.views if v.is_pdt]
        ndt_views  = [v for v in project.views if v.is_derived_table and not v.is_pdt]

        # BEFORE fix these would both be 0 and 3 respectively.
        # AFTER fix, should be 2 and 1.
        assert len(pdt_views) == 2, (
            f"BEFORE fix would give 0 PDTs. AFTER fix expects 2. Got: {len(pdt_views)}"
        )
        assert len(ndt_views) == 1, (
            f"Expected 1 NDT. Got: {len(ndt_views)}"
        )
        pdt_names = {v.name for v in pdt_views}
        assert "mcp_claims_summary" in pdt_names
        assert "np_contact_center_gross_margin" in pdt_names

