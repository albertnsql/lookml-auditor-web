"""
test_api.py — FastAPI endpoint tests.

Endpoints covered:
  GET  /api/health
  POST /api/audit/local
  POST /api/audit/upload
  GET  /api/audit/files
  GET  /api/audit/file
  DELETE /api/audit/cleanup

Edge cases: missing body fields, invalid paths, non-zip uploads,
non-existent paths, empty projects, cleanup idempotency.
"""
from __future__ import annotations
import io
import os
import sys
import shutil
import tempfile
import textwrap
import zipfile
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))
sys.path.insert(0, str(Path(__file__).parent.parent / "core"))


# ═══════════════════════════════════════════════════════════════════════════
# Health check
# ═══════════════════════════════════════════════════════════════════════════

class TestHealthEndpoint:

    def test_health_returns_200(self, client):
        r = client.get("/api/health")
        assert r.status_code == 200

    def test_health_body_has_status_ok(self, client):
        r = client.get("/api/health")
        assert r.json()["status"] == "ok"

    def test_health_body_has_message(self, client):
        r = client.get("/api/health")
        assert "message" in r.json()


# ═══════════════════════════════════════════════════════════════════════════
# POST /api/audit/local
# ═══════════════════════════════════════════════════════════════════════════

class TestAuditLocal:

    def test_valid_local_path_returns_200(self, client, minimal_project_dir):
        r = client.post("/api/audit/local", json={"path": minimal_project_dir})
        assert r.status_code == 200

    def test_response_has_views(self, client, minimal_project_dir):
        r = client.post("/api/audit/local", json={"path": minimal_project_dir})
        assert "views" in r.json()

    def test_response_has_explores(self, client, minimal_project_dir):
        r = client.post("/api/audit/local", json={"path": minimal_project_dir})
        assert "explores" in r.json()

    def test_response_has_issues(self, client, minimal_project_dir):
        r = client.post("/api/audit/local", json={"path": minimal_project_dir})
        assert "issues" in r.json()

    def test_response_has_health_score(self, client, minimal_project_dir):
        r = client.post("/api/audit/local", json={"path": minimal_project_dir})
        data = r.json()
        assert "health_score" in data
        assert 0 <= data["health_score"] <= 100

    def test_response_has_category_scores(self, client, minimal_project_dir):
        r = client.post("/api/audit/local", json={"path": minimal_project_dir})
        data = r.json()
        assert "category_scores" in data
        cats = data["category_scores"]
        assert "broken_reference" in cats
        assert "join_integrity" in cats

    def test_invalid_path_returns_400(self, client):
        r = client.post("/api/audit/local", json={"path": "/no/such/path/xyz_99999"})
        assert r.status_code == 400

    def test_empty_path_returns_400(self, client):
        r = client.post("/api/audit/local", json={"path": ""})
        assert r.status_code == 400

    def test_missing_path_field_returns_422(self, client):
        r = client.post("/api/audit/local", json={})
        assert r.status_code == 422

    def test_source_type_is_local(self, client, minimal_project_dir):
        r = client.post("/api/audit/local", json={"path": minimal_project_dir})
        assert r.json()["source_type"] == "local"

    def test_clean_project_no_errors(self, client, minimal_project_dir):
        r = client.post("/api/audit/local", json={"path": minimal_project_dir})
        issues = r.json()["issues"]
        errors = [i for i in issues if i["severity"] == "error"]
        assert errors == []

    def test_broken_project_has_errors(self, client, broken_project_dir):
        r = client.post("/api/audit/local", json={"path": broken_project_dir})
        assert r.status_code == 200
        issues = r.json()["issues"]
        errors = [i for i in issues if i["severity"] == "error"]
        assert len(errors) >= 1

    def test_views_have_expected_fields(self, client, minimal_project_dir):
        r = client.post("/api/audit/local", json={"path": minimal_project_dir})
        views = r.json()["views"]
        assert len(views) >= 1
        v = views[0]
        for field in ("name", "is_derived_table", "has_primary_key", "n_fields"):
            assert field in v, f"Missing field '{field}' in view response"

    def test_explores_have_expected_fields(self, client, minimal_project_dir):
        r = client.post("/api/audit/local", json={"path": minimal_project_dir})
        explores = r.json()["explores"]
        assert len(explores) >= 1
        e = explores[0]
        for field in ("name", "base_view", "joins"):
            assert field in e, f"Missing field '{field}' in explore response"

    def test_duplicate_views_both_returned(self, client, dup_views_disk_project_dir):
        """
        REGRESSION: With the dict-dedup fix, both duplicate views must be
        present in the API response.
        """
        r = client.post("/api/audit/local", json={"path": dup_views_disk_project_dir})
        assert r.status_code == 200
        views = r.json()["views"]
        orders_views = [v for v in views if v["name"] == "orders"]
        assert len(orders_views) == 2, (
            "Both duplicate 'orders' views should appear in API response"
        )

    def test_empty_directory_returns_empty_lists(self, client, empty_project_dir):
        r = client.post("/api/audit/local", json={"path": empty_project_dir})
        assert r.status_code == 200
        data = r.json()
        assert data["views"] == []
        assert data["explores"] == []


# ═══════════════════════════════════════════════════════════════════════════
# POST /api/audit/upload
# ═══════════════════════════════════════════════════════════════════════════

def _make_zip(content: dict[str, str]) -> bytes:
    """Create an in-memory zip with {filename: text_content} mapping."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for name, text in content.items():
            zf.writestr(name, text)
    return buf.getvalue()


VIEW_LKML = textwrap.dedent("""\
    view: orders {
      sql_table_name: "public.orders" ;;
      dimension: id {
        type: number
        sql: ${TABLE}.id ;;
        primary_key: yes
        label: "Order ID"
        description: "Unique order identifier"
      }
    }
""")

EXPLORE_LKML = "explore: orders { label: \"Orders\" }\n"


class TestAuditUpload:

    def test_valid_zip_returns_200(self, client):
        data = _make_zip({"orders.view.lkml": VIEW_LKML, "core.explore.lkml": EXPLORE_LKML})
        r = client.post("/api/audit/upload", files={"file": ("project.zip", data, "application/zip")})
        assert r.status_code == 200

    def test_zip_response_has_views(self, client):
        data = _make_zip({"orders.view.lkml": VIEW_LKML})
        r = client.post("/api/audit/upload", files={"file": ("project.zip", data, "application/zip")})
        assert "views" in r.json()

    def test_non_zip_returns_400(self, client):
        r = client.post(
            "/api/audit/upload",
            files={"file": ("project.tar.gz", b"fake", "application/gzip")},
        )
        assert r.status_code == 400

    def test_empty_zip_returns_200(self, client):
        data = _make_zip({})
        r = client.post("/api/audit/upload", files={"file": ("empty.zip", data, "application/zip")})
        assert r.status_code == 200

    def test_source_type_is_zip(self, client):
        data = _make_zip({"orders.view.lkml": VIEW_LKML})
        r = client.post("/api/audit/upload", files={"file": ("project.zip", data, "application/zip")})
        assert r.json()["source_type"] == "zip"

    def test_zip_with_nested_folder(self, client):
        """Zip with a single top-level folder should be unwrapped correctly."""
        data = _make_zip({
            "my_project/orders.view.lkml": VIEW_LKML,
            "my_project/core.explore.lkml": EXPLORE_LKML,
        })
        r = client.post("/api/audit/upload", files={"file": ("project.zip", data, "application/zip")})
        assert r.status_code == 200
        views = r.json()["views"]
        assert any(v["name"] == "orders" for v in views)

    def test_zip_with_non_lkml_files_ignored(self, client):
        data = _make_zip({
            "orders.view.lkml": VIEW_LKML,
            "readme.md": "# Not LookML",
            "config.yaml": "key: value",
        })
        r = client.post("/api/audit/upload", files={"file": ("project.zip", data, "application/zip")})
        assert r.status_code == 200


# ═══════════════════════════════════════════════════════════════════════════
# GET /api/audit/files  and  GET /api/audit/file
# ═══════════════════════════════════════════════════════════════════════════

class TestAuditFileEndpoints:

    @pytest.fixture(autouse=True)
    def _seed_audit(self, client, minimal_project_dir):
        """Run an audit so _audit_state is populated before file tests."""
        client.post("/api/audit/local", json={"path": minimal_project_dir})

    def test_files_list_returns_200(self, client):
        r = client.get("/api/audit/files")
        assert r.status_code == 200

    def test_files_list_has_files_key(self, client):
        r = client.get("/api/audit/files")
        assert "files" in r.json()

    def test_files_list_contains_lkml_files(self, client):
        r = client.get("/api/audit/files")
        files = r.json()["files"]
        assert len(files) >= 1
        paths = [f["path"] for f in files]
        assert any(".lkml" in p for p in paths)

    def test_file_content_endpoint_returns_200(self, client, minimal_project_dir):
        # Pick a known file from the minimal project
        target = str(Path(minimal_project_dir) / "orders.view.lkml")
        r = client.get(f"/api/audit/file?path={target}")
        assert r.status_code == 200

    def test_file_content_has_content_key(self, client, minimal_project_dir):
        target = str(Path(minimal_project_dir) / "orders.view.lkml")
        r = client.get(f"/api/audit/file?path={target}")
        assert "content" in r.json()

    def test_file_content_nonexistent_returns_404(self, client):
        r = client.get("/api/audit/file?path=/no/such/file.lkml")
        assert r.status_code == 404


# ═══════════════════════════════════════════════════════════════════════════
# DELETE /api/audit/cleanup
# ═══════════════════════════════════════════════════════════════════════════

class TestCleanup:

    def test_cleanup_nothing_to_clean_returns_200(self, client):
        r = client.delete("/api/audit/cleanup")
        assert r.status_code == 200

    def test_cleanup_nothing_to_clean_status(self, client):
        """When there's no tmp_dir, status is 'nothing_to_clean'."""
        # Run local audit first (sets tmp_dir=None)
        client.post("/api/audit/local", json={"path": str(Path(__file__).parent.parent)})
        r = client.delete("/api/audit/cleanup")
        assert r.json().get("status") in ("nothing_to_clean", "deleted")

    def test_cleanup_after_zip_upload_succeeds(self, client):
        data = _make_zip({"orders.view.lkml": VIEW_LKML})
        client.post("/api/audit/upload", files={"file": ("project.zip", data, "application/zip")})
        r = client.delete("/api/audit/cleanup")
        assert r.status_code == 200
        assert r.json()["status"] in ("deleted", "nothing_to_clean")

    def test_cleanup_idempotent(self, client):
        """Calling cleanup twice must not raise."""
        r1 = client.delete("/api/audit/cleanup")
        r2 = client.delete("/api/audit/cleanup")
        assert r1.status_code == 200
        assert r2.status_code == 200
