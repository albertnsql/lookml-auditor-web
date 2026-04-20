"""
test_parser.py — Unit tests for lookml_parser (parser + models).

Covers:
  - parse_file() on raw LookML strings written to temp files
  - parse_project() on temp directories
  - LookMLView / LookMLField / LookMLExplore / LookMLJoin model properties
  - parse_manifest() and resolve_constants()
  - Edge cases: empty files, tiny files (<10 bytes), missing project path,
    files with only comments, nested derived tables, extends
"""
from __future__ import annotations
import os
import sys
import tempfile
import textwrap
from pathlib import Path

import pytest

# Ensure core/ is importable (conftest.py handles sys.path but be explicit here)
_BACKEND_DIR = Path(__file__).parent.parent
_CORE_DIR    = _BACKEND_DIR / "core"
sys.path.insert(0, str(_CORE_DIR))

from lookml_parser.parser import parse_file, parse_project, parse_manifest, resolve_constants
from lookml_parser.models import LookMLProject, LookMLView, LookMLField


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _write_tmp(content: str, suffix=".lkml") -> str:
    """Write content to a named temp file and return its path."""
    fd, path = tempfile.mkstemp(suffix=suffix)
    os.close(fd)
    Path(path).write_text(textwrap.dedent(content), encoding="utf-8")
    return path


def _tmp_project(*files: tuple[str, str]) -> str:
    """
    Create a temp directory with the given (filename, content) pairs.
    Returns the directory path.  Caller is responsible for cleanup.
    """
    tmpdir = tempfile.mkdtemp(prefix="lkml_parser_test_")
    for fname, content in files:
        p = Path(tmpdir) / fname
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(textwrap.dedent(content), encoding="utf-8")
    return tmpdir


# ─────────────────────────────────────────────────────────────────────────────
# parse_file — basic view parsing
# ─────────────────────────────────────────────────────────────────────────────

class TestParseFileViews:

    def test_single_view_returned(self):
        path = _write_tmp("""
            view: orders {
              sql_table_name: "public.orders" ;;
              dimension: id { type: number sql: ${TABLE}.id ;; primary_key: yes }
            }
        """)
        views, explores = parse_file(path)
        assert len(views) == 1
        assert views[0].name == "orders"
        os.remove(path)

    def test_view_sql_table_name_parsed(self):
        path = _write_tmp("""
            view: customers { sql_table_name: "analytics.customers" ;; }
        """)
        views, _ = parse_file(path)
        assert views[0].sql_table_name == "analytics.customers"
        os.remove(path)

    def test_multiple_views_in_one_file(self):
        path = _write_tmp("""
            view: orders { sql_table_name: "public.orders" ;; }
            view: customers { sql_table_name: "public.customers" ;; }
        """)
        views, _ = parse_file(path)
        names = {v.name for v in views}
        assert "orders" in names
        assert "customers" in names
        os.remove(path)

    def test_primary_key_flag_parsed(self):
        path = _write_tmp("""
            view: orders {
              dimension: id { type: number sql: ${TABLE}.id ;; primary_key: yes }
            }
        """)
        views, _ = parse_file(path)
        pk_fields = [f for f in views[0].fields if f.primary_key]
        assert len(pk_fields) == 1
        assert pk_fields[0].name == "id"
        os.remove(path)

    def test_hidden_field_parsed(self):
        path = _write_tmp("""
            view: orders {
              dimension: internal { sql: ${TABLE}.x ;; hidden: yes }
            }
        """)
        views, _ = parse_file(path)
        hidden_fields = [f for f in views[0].fields if f.hidden]
        assert any(f.name == "internal" for f in hidden_fields)
        os.remove(path)

    def test_label_and_description_parsed(self):
        path = _write_tmp("""
            view: orders {
              dimension: id {
                sql: ${TABLE}.id ;;
                label: "Order ID"
                description: "Unique order identifier"
              }
            }
        """)
        views, _ = parse_file(path)
        field = views[0].fields[0]
        assert field.label == "Order ID"
        assert field.description == "Unique order identifier"
        os.remove(path)

    def test_dimension_group_parsed_as_field(self):
        path = _write_tmp("""
            view: orders {
              dimension_group: created {
                type: time
                timeframes: [date, week, month]
                sql: ${TABLE}.created_at ;;
              }
            }
        """)
        views, _ = parse_file(path)
        assert any(f.field_type == "dimension_group" for f in views[0].fields)

    def test_measure_field_type(self):
        path = _write_tmp("""
            view: orders {
              measure: count { type: count }
            }
        """)
        views, _ = parse_file(path)
        assert any(f.field_type == "measure" for f in views[0].fields)
        os.remove(path)

    def test_tags_parsed(self):
        path = _write_tmp("""
            view: orders {
              dimension: id {
                sql: ${TABLE}.id ;;
                tags: ["key", "pii"]
              }
            }
        """)
        views, _ = parse_file(path)
        assert views[0].fields[0].tags == ["key", "pii"]
        os.remove(path)

    def test_derived_table_detected(self):
        path = _write_tmp("""
            view: order_summary {
              derived_table: {
                sql: SELECT customer_id, COUNT(*) FROM orders GROUP BY 1 ;;
              }
            }
        """)
        views, _ = parse_file(path)
        assert views[0].is_derived_table is True
        assert views[0].derived_table_sql is not None
        os.remove(path)

    def test_extends_parsed(self):
        path = _write_tmp("""
            view: orders_extended {
              extends: [orders]
              dimension: extra { sql: ${TABLE}.extra ;; }
            }
        """)
        views, _ = parse_file(path)
        assert "orders" in views[0].extends

    def test_comments_stripped_before_parse(self):
        path = _write_tmp("""
            # This is a comment
            view: orders {
              # Another comment
              sql_table_name: "public.orders" ;;
            }
        """)
        views, _ = parse_file(path)
        assert len(views) == 1
        assert views[0].name == "orders"
        os.remove(path)

    def test_empty_file_returns_empty(self):
        path = _write_tmp("")
        views, explores = parse_file(path)
        assert views == []
        assert explores == []
        os.remove(path)

    def test_nonexistent_file_returns_empty(self):
        views, explores = parse_file("/tmp/does_not_exist_xyz.lkml")
        assert views == []
        assert explores == []


# ─────────────────────────────────────────────────────────────────────────────
# parse_file — explore parsing
# ─────────────────────────────────────────────────────────────────────────────

class TestParseFileExplores:

    def test_explore_name_parsed(self):
        path = _write_tmp("""
            explore: orders {
              label: "Orders"
              description: "Core orders explore"
            }
        """)
        _, explores = parse_file(path)
        assert len(explores) == 1
        assert explores[0].name == "orders"
        os.remove(path)

    def test_explore_label_and_description(self):
        path = _write_tmp("""
            explore: orders {
              label: "My Orders"
              description: "All order data"
            }
        """)
        _, explores = parse_file(path)
        e = explores[0]
        assert e.label == "My Orders"
        assert e.description == "All order data"
        os.remove(path)

    def test_explore_with_from(self):
        path = _write_tmp("""
            explore: order_funnel { from: orders }
        """)
        _, explores = parse_file(path)
        assert explores[0].from_view == "orders"
        assert explores[0].base_view == "orders"
        os.remove(path)

    def test_explore_base_view_defaults_to_name(self):
        path = _write_tmp("explore: orders {}")
        _, explores = parse_file(path)
        assert explores[0].base_view == "orders"
        os.remove(path)

    def test_join_name_parsed(self):
        path = _write_tmp("""
            explore: orders {
              join: customers {
                type: left_outer
                sql_on: ${orders.customer_id} = ${customers.id} ;;
                relationship: many_to_one
              }
            }
        """)
        _, explores = parse_file(path)
        assert len(explores[0].joins) == 1
        assert explores[0].joins[0].name == "customers"
        os.remove(path)

    def test_join_sql_on_parsed(self):
        path = _write_tmp("""
            explore: orders {
              join: customers {
                sql_on: ${orders.customer_id} = ${customers.id} ;;
                relationship: many_to_one
              }
            }
        """)
        _, explores = parse_file(path)
        join = explores[0].joins[0]
        assert join.sql_on is not None
        assert "customer_id" in join.sql_on
        os.remove(path)

    def test_join_relationship_parsed(self):
        path = _write_tmp("""
            explore: orders {
              join: customers {
                sql_on: ${orders.customer_id} = ${customers.id} ;;
                relationship: many_to_one
              }
            }
        """)
        _, explores = parse_file(path)
        assert explores[0].joins[0].relationship == "many_to_one"
        os.remove(path)

    def test_join_from_view_parsed(self):
        path = _write_tmp("""
            explore: orders {
              join: cust_alias {
                from: customers
                sql_on: ${orders.customer_id} = ${cust_alias.id} ;;
                relationship: many_to_one
              }
            }
        """)
        _, explores = parse_file(path)
        j = explores[0].joins[0]
        assert j.name == "cust_alias"
        assert j.from_view == "customers"
        assert j.resolved_view == "customers"   # uses from_view over name
        os.remove(path)

    def test_join_resolved_view_defaults_to_name(self):
        path = _write_tmp("""
            explore: orders {
              join: customers {
                sql_on: ${orders.customer_id} = ${customers.id} ;;
                relationship: many_to_one
              }
            }
        """)
        _, explores = parse_file(path)
        j = explores[0].joins[0]
        assert j.resolved_view == "customers"
        os.remove(path)


# ─────────────────────────────────────────────────────────────────────────────
# parse_project
# ─────────────────────────────────────────────────────────────────────────────

class TestParseProject:

    def test_nonexistent_path_raises(self):
        with pytest.raises(FileNotFoundError):
            parse_project("/tmp/completely_missing_project_12345")

    def test_empty_dir_returns_empty_project(self):
        tmpdir = tempfile.mkdtemp()
        project = parse_project(tmpdir)
        assert project.views == []
        assert project.explores == []
        import shutil; shutil.rmtree(tmpdir)

    def test_project_name_is_directory_basename(self):
        tmpdir = _tmp_project(("orders.view.lkml", "view: orders {}"))
        project = parse_project(tmpdir)
        assert project.name == Path(tmpdir).name
        import shutil; shutil.rmtree(tmpdir)

    def test_recursive_scan_finds_nested_files(self):
        tmpdir = _tmp_project(
            ("views/orders.view.lkml",   "view: orders { sql_table_name: \"pub.orders\" ;; }"),
            ("views/sub/items.view.lkml", "view: items { sql_table_name: \"pub.items\" ;; }"),
        )
        project = parse_project(tmpdir)
        names = {v.name for v in project.views}
        assert "orders" in names
        assert "items" in names
        import shutil; shutil.rmtree(tmpdir)

    def test_tiny_files_skipped(self):
        """Files <10 bytes are skipped per parser spec."""
        tmpdir = _tmp_project(("tiny.lkml", "view: x"))   # 7 bytes — skipped
        project = parse_project(tmpdir)
        assert project.views == []
        import shutil; shutil.rmtree(tmpdir)

    def test_view_map_property(self):
        tmpdir = _tmp_project(
            ("orders.view.lkml", "view: orders { sql_table_name: \"pub.orders\" ;; }"),
        )
        project = parse_project(tmpdir)
        assert "orders" in project.view_map
        import shutil; shutil.rmtree(tmpdir)

    def test_explore_map_property(self):
        tmpdir = _tmp_project(
            ("core.explore.lkml", "explore: orders {}"),
        )
        project = parse_project(tmpdir)
        assert "orders" in project.explore_map
        import shutil; shutil.rmtree(tmpdir)

    def test_derived_table_views_property(self):
        tmpdir = _tmp_project(
            ("summary.view.lkml",
             "view: summary { derived_table: { sql: SELECT 1 ;; } }"),
            ("orders.view.lkml",
             "view: orders { sql_table_name: \"pub.orders\" ;; }"),
        )
        project = parse_project(tmpdir)
        dt_names = {v.name for v in project.derived_table_views}
        assert "summary" in dt_names
        assert "orders" not in dt_names
        import shutil; shutil.rmtree(tmpdir)

    def test_all_files_property_collects_source_files(self):
        tmpdir = _tmp_project(
            ("orders.view.lkml", "view: orders { sql_table_name: \"pub.orders\" ;; }"),
            ("core.explore.lkml", "explore: orders {}"),
        )
        project = parse_project(tmpdir)
        assert len(project.all_files) > 0
        import shutil; shutil.rmtree(tmpdir)


# ─────────────────────────────────────────────────────────────────────────────
# LookMLView model properties
# ─────────────────────────────────────────────────────────────────────────────

class TestViewModelProperties:

    def _make_view(self, fields):
        return LookMLView(name="test", sql_table_name="pub.test", fields=fields)

    def _fld(self, name, ft, pk=False):
        return LookMLField(name=name, field_type=ft, sql="${TABLE}.x", primary_key=pk)

    def test_dimensions_property(self):
        v = self._make_view([
            self._fld("d1", "dimension"),
            self._fld("dg", "dimension_group"),
            self._fld("m1", "measure"),
        ])
        dims = v.dimensions
        assert len(dims) == 2
        assert all(f.field_type in ("dimension", "dimension_group") for f in dims)

    def test_measures_property(self):
        v = self._make_view([
            self._fld("d1", "dimension"),
            self._fld("m1", "measure"),
            self._fld("m2", "measure"),
        ])
        assert len(v.measures) == 2

    def test_field_names_property(self):
        v = self._make_view([self._fld("id", "dimension"), self._fld("count", "measure")])
        assert v.field_names == {"id", "count"}

    def test_has_primary_key_true(self):
        v = self._make_view([self._fld("id", "dimension", pk=True)])
        assert v.has_primary_key is True

    def test_has_primary_key_false(self):
        v = self._make_view([self._fld("id", "dimension", pk=False)])
        assert v.has_primary_key is False

    def test_primary_key_field_returns_correct_field(self):
        v = self._make_view([
            self._fld("name", "dimension"),
            self._fld("id", "dimension", pk=True),
        ])
        pk = v.primary_key_field
        assert pk is not None
        assert pk.name == "id"

    def test_is_derived_table_true(self):
        v = LookMLView(name="dt", derived_table_sql="SELECT 1")
        assert v.is_derived_table is True

    def test_is_derived_table_false(self):
        v = LookMLView(name="t", sql_table_name="pub.t")
        assert v.is_derived_table is False


# ─────────────────────────────────────────────────────────────────────────────
# parse_manifest + resolve_constants
# ─────────────────────────────────────────────────────────────────────────────

class TestManifestAndConstants:

    def test_resolve_constants_no_refs(self):
        result = resolve_constants("schema.table", {"MY_SCHEMA": "prod"})
        assert result == "schema.table"

    def test_resolve_constants_replaces_ref(self):
        result = resolve_constants("@{MY_SCHEMA}.orders", {"MY_SCHEMA": "prod"})
        assert result == "prod.orders"

    def test_resolve_constants_unknown_key_preserved(self):
        result = resolve_constants("@{UNKNOWN}.orders", {"MY_SCHEMA": "prod"})
        assert result == "@{UNKNOWN}.orders"

    def test_resolve_constants_no_constants_dict(self):
        result = resolve_constants("schema.table", {})
        assert result == "schema.table"

    def test_parse_manifest_missing_file_returns_empty(self):
        tmpdir = tempfile.mkdtemp()
        constants = parse_manifest(tmpdir)
        assert constants == {}
        import shutil; shutil.rmtree(tmpdir)

    def test_parse_manifest_reads_constant(self):
        tmpdir = tempfile.mkdtemp()
        manifest = textwrap.dedent("""
            constant: MY_SCHEMA {
              value: "production"
            }
        """)
        (Path(tmpdir) / "manifest.lkml").write_text(manifest, encoding="utf-8")
        constants = parse_manifest(tmpdir)
        assert constants.get("MY_SCHEMA") == "production"
        import shutil; shutil.rmtree(tmpdir)

    def test_parse_project_resolves_constants_in_sql_table(self):
        tmpdir = tempfile.mkdtemp()
        (Path(tmpdir) / "manifest.lkml").write_text(
            textwrap.dedent("""
                constant: SCHEMA {
                  value: "prod"
                }
            """),
            encoding="utf-8"
        )
        (Path(tmpdir) / "orders.view.lkml").write_text(
            textwrap.dedent("""
                view: orders {
                  sql_table_name: "@{SCHEMA}.orders" ;;
                }
            """),
            encoding="utf-8"
        )
        project = parse_project(tmpdir)
        orders_view = project.view_map.get("orders")
        assert orders_view is not None
        assert orders_view.sql_table_name == "prod.orders"
        import shutil; shutil.rmtree(tmpdir)
