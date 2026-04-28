"""
test_parser.py — Full test suite for the LookML parser.

Covers:
  - parse_project: normal, empty dir, tiny files, hidden dirs, multi-file
  - parse_file: views, explores, derived tables, extends, fields
  - parse_manifest: constant resolution, missing manifest
  - Edge cases: empty files, comments, non-lkml files, unicode
  - BUG REGRESSION: parse_project must preserve ALL views (not deduplicate by name)
"""
from __future__ import annotations

import os
import sys
import shutil
import tempfile
import textwrap
from pathlib import Path

import pytest

_BACKEND_DIR = Path(__file__).parent.parent
_CORE_DIR    = _BACKEND_DIR / "core"
sys.path.insert(0, str(_BACKEND_DIR))
sys.path.insert(0, str(_CORE_DIR))

from lookml_parser.parser import (
    parse_project, parse_file, parse_manifest, resolve_constants,
)
from lookml_parser.models import LookMLProject, LookMLView, LookMLExplore


# ═══════════════════════════════════════════════════════════════════════════
# parse_project — disk-based tests
# ═══════════════════════════════════════════════════════════════════════════

class TestParseProject:

    def test_minimal_project_returns_project_instance(self, minimal_project_dir):
        project = parse_project(minimal_project_dir)
        assert isinstance(project, LookMLProject)

    def test_minimal_project_name_is_dirname(self, minimal_project_dir):
        project = parse_project(minimal_project_dir)
        assert project.name == Path(minimal_project_dir).name

    def test_minimal_project_parses_views(self, minimal_project_dir):
        project = parse_project(minimal_project_dir)
        names = [v.name for v in project.views]
        assert "orders" in names

    def test_minimal_project_parses_explores(self, minimal_project_dir):
        project = parse_project(minimal_project_dir)
        names = [e.name for e in project.explores]
        assert "orders" in names

    def test_empty_directory_returns_empty_project(self, empty_project_dir):
        project = parse_project(empty_project_dir)
        assert project.views == []
        assert project.explores == []

    def test_tiny_files_are_skipped(self, tiny_file_project_dir):
        """Files < 10 bytes must be silently skipped."""
        project = parse_project(tiny_file_project_dir)
        assert project.views == []

    def test_nonexistent_path_raises(self):
        with pytest.raises(FileNotFoundError):
            parse_project("/no/such/path/xyz_12345")

    def test_non_lkml_files_ignored(self):
        tmpdir = tempfile.mkdtemp()
        try:
            (Path(tmpdir) / "readme.md").write_text("# not lkml", encoding="utf-8")
            (Path(tmpdir) / "config.yaml").write_text("key: value", encoding="utf-8")
            project = parse_project(tmpdir)
            assert project.views == []
            assert project.explores == []
        finally:
            shutil.rmtree(tmpdir, ignore_errors=True)

    def test_hidden_dirs_skipped(self):
        """Files inside .hidden directories must be ignored."""
        tmpdir = tempfile.mkdtemp()
        try:
            hidden = Path(tmpdir) / ".hidden_dir"
            hidden.mkdir()
            (hidden / "orders.view.lkml").write_text(
                'view: orders { sql_table_name: "public.orders" ;; }',
                encoding="utf-8"
            )
            project = parse_project(tmpdir)
            assert project.views == []
        finally:
            shutil.rmtree(tmpdir, ignore_errors=True)

    def test_recursive_subdirectories_parsed(self):
        """Views in nested subdirectories must be discovered."""
        tmpdir = tempfile.mkdtemp()
        try:
            sub = Path(tmpdir) / "views" / "core"
            sub.mkdir(parents=True)
            (sub / "orders.view.lkml").write_text(textwrap.dedent("""\
                view: orders {
                  sql_table_name: "public.orders" ;;
                  dimension: id { type: number sql: ${TABLE}.id ;; primary_key: yes label: "ID" description: "ID" }
                }
            """), encoding="utf-8")
            project = parse_project(tmpdir)
            assert any(v.name == "orders" for v in project.views)
        finally:
            shutil.rmtree(tmpdir, ignore_errors=True)

    # ── REGRESSION: the dict-dedup bug ─────────────────────────────────────

    def test_duplicate_view_names_both_preserved(self, dup_views_disk_project_dir):
        """
        REGRESSION TEST: parse_project previously used a dict keyed on view.name,
        meaning the second definition silently overwrote the first.
        Now both must be in project.views so check_duplicates can detect them.
        """
        project = parse_project(dup_views_disk_project_dir)
        orders_views = [v for v in project.views if v.name == "orders"]
        assert len(orders_views) == 2, (
            "Both 'orders' definitions must be in project.views "
            "(was: dict-dedup bug silently dropped one)"
        )

    def test_multiple_explores_across_files_all_preserved(self):
        """Explores from different files must all be collected."""
        tmpdir = tempfile.mkdtemp()
        try:
            (Path(tmpdir) / "orders.view.lkml").write_text(
                'view: orders { sql_table_name: "public.orders" ;;\n'
                '  dimension: id { type: number sql: ${TABLE}.id ;; primary_key: yes label: "ID" description: "ID" }\n}',
                encoding="utf-8",
            )
            (Path(tmpdir) / "a.explore.lkml").write_text(
                "explore: alpha { }\n", encoding="utf-8"
            )
            (Path(tmpdir) / "b.explore.lkml").write_text(
                "explore: beta { }\n", encoding="utf-8"
            )
            project = parse_project(tmpdir)
            names = {e.name for e in project.explores}
            assert "alpha" in names
            assert "beta" in names
        finally:
            shutil.rmtree(tmpdir, ignore_errors=True)

    def test_manifest_constants_resolved(self, manifest_project_dir):
        project = parse_project(manifest_project_dir)
        manifest_view = next((v for v in project.views if v.name == "manifest_view"), None)
        assert manifest_view is not None
        assert manifest_view.sql_table_name is not None
        assert "@{" not in manifest_view.sql_table_name
        assert "production" in manifest_view.sql_table_name


# ═══════════════════════════════════════════════════════════════════════════
# parse_file — unit tests
# ═══════════════════════════════════════════════════════════════════════════

class TestParseFile:

    def _write(self, content: str) -> str:
        fd, path = tempfile.mkstemp(suffix=".view.lkml")
        os.close(fd)
        Path(path).write_text(textwrap.dedent(content), encoding="utf-8")
        return path

    def test_returns_empty_for_nonexistent_file(self):
        views, explores = parse_file("/no/such/file.lkml")
        assert views == []
        assert explores == []

    def test_returns_empty_for_empty_file(self):
        fd, path = tempfile.mkstemp(suffix=".lkml")
        os.close(fd)
        try:
            views, explores = parse_file(path)
            assert views == []
            assert explores == []
        finally:
            os.unlink(path)

    def test_parses_simple_view(self):
        path = self._write("""\
            view: orders {
              sql_table_name: "public.orders" ;;
              dimension: id {
                type: number
                sql: ${TABLE}.id ;;
                primary_key: yes
                label: "Order ID"
                description: "Unique ID"
              }
            }
        """)
        try:
            views, explores = parse_file(path)
            assert len(views) == 1
            assert views[0].name == "orders"
            assert views[0].sql_table_name is not None
        finally:
            os.unlink(path)

    def test_parses_multiple_views_in_one_file(self):
        path = self._write("""\
            view: orders {
              sql_table_name: "public.orders" ;;
              dimension: id { type: number sql: ${TABLE}.id ;; primary_key: yes label: "ID" description: "ID" }
            }
            view: customers {
              sql_table_name: "public.customers" ;;
              dimension: id { type: number sql: ${TABLE}.id ;; primary_key: yes label: "ID" description: "ID" }
            }
        """)
        try:
            views, _ = parse_file(path)
            names = {v.name for v in views}
            assert "orders" in names
            assert "customers" in names
        finally:
            os.unlink(path)

    def test_parses_explore(self):
        fd, path = tempfile.mkstemp(suffix=".explore.lkml")
        os.close(fd)
        Path(path).write_text("explore: orders {\n  label: \"Orders\"\n}\n", encoding="utf-8")
        try:
            _, explores = parse_file(path)
            assert len(explores) == 1
            assert explores[0].name == "orders"
        finally:
            os.unlink(path)

    def test_parses_explore_with_join(self):
        fd, path = tempfile.mkstemp(suffix=".explore.lkml")
        os.close(fd)
        Path(path).write_text(textwrap.dedent("""\
            explore: orders {
              join: customers {
                type: left_outer
                relationship: many_to_one
                sql_on: ${orders.customer_id} = ${customers.id} ;;
              }
            }
        """), encoding="utf-8")
        try:
            _, explores = parse_file(path)
            assert len(explores) == 1
            assert len(explores[0].joins) == 1
            assert explores[0].joins[0].name == "customers"
        finally:
            os.unlink(path)

    def test_parses_derived_table(self):
        path = self._write("""\
            view: dt_orders {
              derived_table: {
                sql: SELECT id FROM public.orders ;;
              }
              dimension: id {
                type: number
                sql: ${TABLE}.id ;;
                primary_key: yes
                label: "ID"
                description: "Derived table ID"
              }
            }
        """)
        try:
            views, _ = parse_file(path)
            assert len(views) == 1
            v = views[0]
            assert v.is_derived_table
            assert v.derived_table_sql is not None
        finally:
            os.unlink(path)

    def test_parses_extends(self):
        path = self._write("""\
            view: child_view {
              extends: [base_view]
              dimension: id {
                type: number
                sql: ${TABLE}.id ;;
                primary_key: yes
                label: "ID"
                description: "ID"
              }
            }
        """)
        try:
            views, _ = parse_file(path)
            assert len(views) == 1
            assert "base_view" in views[0].extends
        finally:
            os.unlink(path)

    def test_parses_primary_key_flag(self):
        path = self._write("""\
            view: orders {
              sql_table_name: "public.orders" ;;
              dimension: id {
                type: number
                sql: ${TABLE}.id ;;
                primary_key: yes
                label: "ID"
                description: "ID"
              }
            }
        """)
        try:
            views, _ = parse_file(path)
            pk_field = next((f for f in views[0].fields if f.primary_key), None)
            assert pk_field is not None
            assert pk_field.name == "id"
        finally:
            os.unlink(path)

    def test_parses_hidden_field(self):
        path = self._write("""\
            view: orders {
              sql_table_name: "public.orders" ;;
              dimension: id {
                type: number
                sql: ${TABLE}.id ;;
                primary_key: yes
                label: "ID"
                description: "ID"
              }
              dimension: internal_id {
                type: number
                sql: ${TABLE}.internal_id ;;
                hidden: yes
                label: "Internal"
                description: "Internal only"
              }
            }
        """)
        try:
            views, _ = parse_file(path)
            hidden = next((f for f in views[0].fields if f.name == "internal_id"), None)
            assert hidden is not None
            assert hidden.hidden is True
        finally:
            os.unlink(path)

    def test_comments_stripped_before_parsing(self):
        path = self._write("""\
            # This is a comment
            view: orders {
              # sql_table_name: "this.should.be.ignored" ;;
              sql_table_name: "public.orders" ;;
              dimension: id {
                type: number
                sql: ${TABLE}.id ;; # inline comment
                primary_key: yes
                label: "ID"
                description: "ID"
              }
            }
        """)
        try:
            views, _ = parse_file(path)
            assert len(views) == 1
            assert views[0].sql_table_name == "public.orders"
        finally:
            os.unlink(path)

    def test_parses_measure_field(self):
        path = self._write("""\
            view: orders {
              sql_table_name: "public.orders" ;;
              dimension: id { type: number sql: ${TABLE}.id ;; primary_key: yes label: "ID" description: "ID" }
              measure: count {
                type: count
                label: "Count"
                description: "Count of orders"
              }
            }
        """)
        try:
            views, _ = parse_file(path)
            measures = [f for f in views[0].fields if f.field_type == "measure"]
            assert len(measures) == 1
            assert measures[0].name == "count"
        finally:
            os.unlink(path)

    def test_parses_dimension_group(self):
        path = self._write("""\
            view: orders {
              sql_table_name: "public.orders" ;;
              dimension: id { type: number sql: ${TABLE}.id ;; primary_key: yes label: "ID" description: "ID" }
              dimension_group: created {
                type: time
                sql: ${TABLE}.created_at ;;
                label: "Created"
                description: "Creation timestamp"
              }
            }
        """)
        try:
            views, _ = parse_file(path)
            dgs = [f for f in views[0].fields if f.field_type == "dimension_group"]
            assert len(dgs) == 1
            assert dgs[0].name == "created"
        finally:
            os.unlink(path)

    def test_unicode_content_handled(self):
        path = self._write("""\
            view: orders {
              sql_table_name: "public.orders" ;;
              dimension: id {
                type: number
                sql: ${TABLE}.id ;;
                primary_key: yes
                label: "ID — Identifiant"
                description: "Champs clé primaire — données sensibles"
              }
            }
        """)
        try:
            views, _ = parse_file(path)
            assert len(views) == 1
            assert views[0].name == "orders"
        finally:
            os.unlink(path)

    def test_view_with_no_fields(self):
        path = self._write("""\
            view: empty_view {
              sql_table_name: "public.empty" ;;
            }
        """)
        try:
            views, _ = parse_file(path)
            assert len(views) == 1
            assert views[0].fields == []
        finally:
            os.unlink(path)

    def test_source_file_recorded_correctly(self):
        path = self._write("""\
            view: orders {
              sql_table_name: "public.orders" ;;
              dimension: id { type: number sql: ${TABLE}.id ;; primary_key: yes label: "ID" description: "ID" }
            }
        """)
        try:
            views, _ = parse_file(path)
            assert views[0].source_file == path
        finally:
            os.unlink(path)


# ═══════════════════════════════════════════════════════════════════════════
# parse_manifest + resolve_constants
# ═══════════════════════════════════════════════════════════════════════════

class TestParseManifest:

    def test_missing_manifest_returns_empty(self):
        tmpdir = tempfile.mkdtemp()
        try:
            constants = parse_manifest(tmpdir)
            assert constants == {}
        finally:
            shutil.rmtree(tmpdir, ignore_errors=True)

    def test_parses_constant_from_manifest(self):
        tmpdir = tempfile.mkdtemp()
        try:
            (Path(tmpdir) / "manifest.lkml").write_text(textwrap.dedent("""\
                constant: MY_SCHEMA {
                  value: "production"
                }
            """), encoding="utf-8")
            constants = parse_manifest(tmpdir)
            assert constants.get("MY_SCHEMA") == "production"
        finally:
            shutil.rmtree(tmpdir, ignore_errors=True)

    def test_parses_multiple_constants(self):
        tmpdir = tempfile.mkdtemp()
        try:
            (Path(tmpdir) / "manifest.lkml").write_text(textwrap.dedent("""\
                constant: SCHEMA {
                  value: "prod"
                }
                constant: DB {
                  value: "analytics"
                }
            """), encoding="utf-8")
            constants = parse_manifest(tmpdir)
            assert constants.get("SCHEMA") == "prod"
            assert constants.get("DB") == "analytics"
        finally:
            shutil.rmtree(tmpdir, ignore_errors=True)

    def test_resolve_constants_replaces_reference(self):
        sql = "@{MY_SCHEMA}.orders"
        result = resolve_constants(sql, {"MY_SCHEMA": "production"})
        assert result == "production.orders"

    def test_resolve_constants_noop_when_no_at(self):
        sql = "public.orders"
        result = resolve_constants(sql, {"MY_SCHEMA": "production"})
        assert result == "public.orders"

    def test_resolve_constants_noop_when_empty_constants(self):
        sql = "@{MY_SCHEMA}.orders"
        result = resolve_constants(sql, {})
        assert result == sql

    def test_resolve_constants_leaves_unknown_refs(self):
        sql = "@{UNKNOWN}.orders"
        result = resolve_constants(sql, {"MY_SCHEMA": "production"})
        assert result == "@{UNKNOWN}.orders"

    def test_resolve_constants_multiple_refs(self):
        sql = "@{DB}.@{SCHEMA}.orders"
        result = resolve_constants(sql, {"DB": "analytics", "SCHEMA": "prod"})
        assert result == "analytics.prod.orders"


# ═══════════════════════════════════════════════════════════════════════════
# Model property tests (LookMLView / LookMLExplore)
# ═══════════════════════════════════════════════════════════════════════════

class TestModelProperties:

    def test_view_is_derived_table_when_sql_set(self, make_view):
        v = make_view("dt_view", derived_sql="SELECT 1", sql_table=None)
        assert v.is_derived_table is True

    def test_view_not_derived_table_when_sql_table(self, make_view):
        v = make_view("normal_view", sql_table="public.orders")
        assert v.is_derived_table is False

    def test_view_has_primary_key(self, make_view, make_field):
        v = make_view("orders", fields=[make_field("id", primary_key=True)])
        assert v.has_primary_key is True

    def test_view_no_primary_key(self, make_view, make_field):
        v = make_view("orders", fields=[make_field("status")])
        assert v.has_primary_key is False

    def test_view_primary_key_field_returns_correct_field(self, make_view, make_field):
        pk = make_field("id", primary_key=True)
        v = make_view("orders", fields=[pk, make_field("status")])
        assert v.primary_key_field == pk

    def test_view_dimensions_property(self, make_view, make_field):
        v = make_view("orders", fields=[
            make_field("id", field_type="dimension"),
            make_field("count", field_type="measure"),
            make_field("created", field_type="dimension_group"),
        ])
        dim_names = {f.name for f in v.dimensions}
        assert "id" in dim_names
        assert "created" in dim_names
        assert "count" not in dim_names

    def test_view_measures_property(self, make_view, make_field):
        v = make_view("orders", fields=[
            make_field("id", field_type="dimension"),
            make_field("count", field_type="measure"),
        ])
        assert len(v.measures) == 1
        assert v.measures[0].name == "count"

    def test_explore_base_view_defaults_to_name(self, make_explore):
        e = make_explore("orders")
        assert e.base_view == "orders"

    def test_explore_base_view_uses_from(self, make_explore):
        e = make_explore("alias", from_view="actual_view")
        assert e.base_view == "actual_view"

    def test_explore_base_view_uses_view_name(self, make_explore):
        e = make_explore("alias", view_name="real_view")
        assert e.base_view == "real_view"

    def test_join_resolved_view_uses_from(self, make_join):
        j = make_join("j", from_view="actual_view")
        assert j.resolved_view == "actual_view"

    def test_join_resolved_view_defaults_to_name(self, make_join):
        j = make_join("orders")
        assert j.resolved_view == "orders"

    def test_project_view_map(self, make_view, make_project):
        v = make_view("orders")
        p = make_project(views=[v])
        assert "orders" in p.view_map

    def test_project_derived_table_views(self, make_view, make_project):
        dt = make_view("dt", derived_sql="SELECT 1", sql_table=None)
        normal = make_view("normal")
        p = make_project(views=[dt, normal])
        assert len(p.derived_table_views) == 1
        assert p.derived_table_views[0].name == "dt"

    def test_project_all_files(self, make_view, make_explore, make_project):
        v = make_view("orders", source_file="orders.view.lkml")
        e = make_explore("orders", source_file="core.explore.lkml")
        p = make_project(views=[v], explores=[e])
        files = p.all_files
        assert "orders.view.lkml" in files
        assert "core.explore.lkml" in files
