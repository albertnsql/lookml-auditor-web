"""
test_api.py — Integration tests for the FastAPI backend endpoints.

Uses FastAPI's TestClient (httpx-backed) to call every endpoint:
  GET  /api/health
  POST /api/audit/local
  POST /api/audit/github   (mocked — no real git)
  POST /api/audit/upload
  GET  /api/audit/files
  GET  /api/audit/file
  DELETE /api/audit/cleanup
"""
from __future__ import annotations
import io
import os
import sys
import json
import zipfile
import tempfile
import textwrap
from pathlib import Path

import pytest

_BACKEND_DIR = Path(__file__).parent.parent
_CORE_DIR    = _BACKEND_DIR / "core"
sys.path.insert(0, str(_BACKEND_DIR))
sys.path.insert(0, str(_CORE_DIR))

# ── Helpers ──────────────────────────────────────────────────────────────────

CLEAN_VIEW = textwrap.dedent("""\
    view: orders {
      sql_table_name: "public.orders" ;;
      dimension: id {
        type: number
        sql: ${TABLE}.id ;;
        primary_key: yes
        label: "Order ID"
        description: "Unique order identifier"
      }
      measure: count {
        type: count
        label: "Count"
        description: "Number of orders"
      }
    }
""")

CLEAN_EXPLORE = textwrap.dedent("""\
    explore: orders {
      label: "Orders"
      description: "Core orders explore"
    }
""")


def _make_lkml_dir(view_content=CLEAN_VIEW, explore_content=CLEAN_EXPLORE):
    """Create a temporary LookML project directory and return its path."""
    tmpdir = tempfile.mkdtemp(prefix="lkml_api_test_")
    (Path(tmpdir) / "orders.view.lkml").write_text(view_content, encoding="utf-8")
    if explore_content:
        (Path(tmpdir) / "core.explore.lkml").write_text(explore_content, encoding="utf-8")
    return tmpdir


def _make_zip(view_content=CLEAN_VIEW) -> bytes:
    """Return in-memory .zip bytes containing a minimal LookML project."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("project/orders.view.lkml", view_content)
        zf.writestr("project/core.explore.lkml", CLEAN_EXPLORE)
    return buf.getvalue()


# ─────────────────────────────────────────────────────────────────────────────
# Health endpoint
# ─────────────────────────────────────────────────────────────────────────────

class TestHealthEndpoint:

    def test_health_returns_200(self, client):
        resp = client.get("/api/health")
        assert resp.status_code == 200

    def test_health_body_has_status_ok(self, client):
        body = client.get("/api/health").json()
        assert body["status"] == "ok"

    def test_health_body_has_message(self, client):
        body = client.get("/api/health").json()
        assert "message" in body


# ─────────────────────────────────────────────────────────────────────────────
# POST /api/audit/local
# ─────────────────────────────────────────────────────────────────────────────

class TestAuditLocal:

    def test_missing_path_returns_400(self, client):
        resp = client.post("/api/audit/local", json={"path": ""})
        assert resp.status_code == 400

    def test_invalid_path_returns_400(self, client):
        resp = client.post("/api/audit/local",
                           json={"path": "/completely/nonexistent/path/xyz123"})
        assert resp.status_code == 400

    def test_valid_project_returns_200(self, client, minimal_project_dir):
        resp = client.post("/api/audit/local", json={"path": minimal_project_dir})
        assert resp.status_code == 200

    def test_response_has_health_score(self, client, minimal_project_dir):
        body = client.post("/api/audit/local", json={"path": minimal_project_dir}).json()
        assert "health_score" in body
        assert 0 <= body["health_score"] <= 100

    def test_response_has_views(self, client, minimal_project_dir):
        body = client.post("/api/audit/local", json={"path": minimal_project_dir}).json()
        assert "views" in body
        assert len(body["views"]) >= 1

    def test_response_has_explores(self, client, minimal_project_dir):
        body = client.post("/api/audit/local", json={"path": minimal_project_dir}).json()
        assert "explores" in body
        assert len(body["explores"]) >= 1

    def test_response_has_issues_list(self, client, minimal_project_dir):
        body = client.post("/api/audit/local", json={"path": minimal_project_dir}).json()
        assert "issues" in body
        assert isinstance(body["issues"], list)

    def test_response_has_category_scores(self, client, minimal_project_dir):
        body = client.post("/api/audit/local", json={"path": minimal_project_dir}).json()
        cs = body.get("category_scores", {})
        assert "broken_reference" in cs
        assert "duplicate_def"    in cs
        assert "join_integrity"   in cs
        assert "field_quality"    in cs

    def test_response_project_name_matches_dir(self, client, minimal_project_dir):
        body = client.post("/api/audit/local", json={"path": minimal_project_dir}).json()
        assert body["project"]["name"] == Path(minimal_project_dir).name

    def test_view_shape_fields(self, client, minimal_project_dir):
        body = client.post("/api/audit/local", json={"path": minimal_project_dir}).json()
        view = body["views"][0]
        for key in ("name", "is_derived_table", "has_primary_key", "n_dimensions",
                    "n_measures", "n_fields", "fields"):
            assert key in view, f"Missing key: {key}"

    def test_issue_shape_fields(self, client, broken_project_dir):
        body = client.post("/api/audit/local", json={"path": broken_project_dir}).json()
        if body["issues"]:
            issue = body["issues"][0]
            for key in ("severity", "category", "message", "object_name"):
                assert key in issue, f"Missing issue key: {key}"

    def test_broken_project_has_errors(self, client, broken_project_dir):
        body = client.post("/api/audit/local", json={"path": broken_project_dir}).json()
        severities = {i["severity"] for i in body["issues"]}
        assert "error" in severities

    def test_broken_project_score_less_than_100(self, client, broken_project_dir):
        body = client.post("/api/audit/local", json={"path": broken_project_dir}).json()
        assert body["health_score"] < 100

    def test_source_type_is_local(self, client, minimal_project_dir):
        body = client.post("/api/audit/local", json={"path": minimal_project_dir}).json()
        assert body["source_type"] == "local"

    def test_suppressed_count_present(self, client, minimal_project_dir):
        body = client.post("/api/audit/local", json={"path": minimal_project_dir}).json()
        assert "suppressed" in body
        assert isinstance(body["suppressed"], int)


# ─────────────────────────────────────────────────────────────────────────────
# POST /api/audit/upload  (ZIP)
# ─────────────────────────────────────────────────────────────────────────────

class TestAuditUpload:

    def test_non_zip_returns_400(self, client):
        resp = client.post(
            "/api/audit/upload",
            files={"file": ("project.txt", b"not a zip", "text/plain")},
        )
        assert resp.status_code == 400

    def test_valid_zip_returns_200(self, client):
        zip_bytes = _make_zip()
        resp = client.post(
            "/api/audit/upload",
            files={"file": ("project.zip", zip_bytes, "application/zip")},
        )
        assert resp.status_code == 200

    def test_zip_response_has_health_score(self, client):
        zip_bytes = _make_zip()
        body = client.post(
            "/api/audit/upload",
            files={"file": ("project.zip", zip_bytes, "application/zip")},
        ).json()
        assert 0 <= body["health_score"] <= 100

    def test_zip_source_type_is_zip(self, client):
        zip_bytes = _make_zip()
        body = client.post(
            "/api/audit/upload",
            files={"file": ("project.zip", zip_bytes, "application/zip")},
        ).json()
        assert body["source_type"] == "zip"

    def test_zip_response_has_views(self, client):
        zip_bytes = _make_zip()
        body = client.post(
            "/api/audit/upload",
            files={"file": ("project.zip", zip_bytes, "application/zip")},
        ).json()
        assert len(body["views"]) >= 1


# ─────────────────────────────────────────────────────────────────────────────
# POST /api/audit/github  (mocked)
# ─────────────────────────────────────────────────────────────────────────────

class TestAuditGithub:

    def test_missing_url_returns_400(self, client):
        resp = client.post("/api/audit/github", json={"url": ""})
        assert resp.status_code == 400

    def test_invalid_url_returns_error(self, client, monkeypatch):
        """Patch git so it always fails — verifies error propagation."""
        import shutil
        monkeypatch.setattr(shutil, "which", lambda _: None)
        resp = client.post("/api/audit/github",
                           json={"url": "https://github.com/fake/repo"})
        assert resp.status_code in (400, 500)

    def test_no_url_key_returns_400(self, client):
        resp = client.post("/api/audit/github", json={})
        assert resp.status_code == 400


# ─────────────────────────────────────────────────────────────────────────────
# GET /api/audit/files  and  GET /api/audit/file
# ─────────────────────────────────────────────────────────────────────────────

class TestFileEndpoints:

    @pytest.fixture(autouse=True)
    def run_audit(self, client, minimal_project_dir):
        """Run a local audit first so the server has state."""
        client.post("/api/audit/local", json={"path": minimal_project_dir})

    def test_files_endpoint_returns_list(self, client):
        body = client.get("/api/audit/files").json()
        assert "files" in body
        assert isinstance(body["files"], list)

    def test_files_list_contains_relative_paths(self, client):
        body = client.get("/api/audit/files").json()
        assert all("relative" in f for f in body["files"])

    def test_file_content_returns_200_for_valid_file(self, client, minimal_project_dir):
        # Get the path of the first file from the list
        files = client.get("/api/audit/files").json()["files"]
        if not files:
            pytest.skip("No files returned from audit state")
        path = files[0]["path"]
        resp = client.get(f"/api/audit/file?path={path}")
        assert resp.status_code == 200

    def test_file_content_has_content_key(self, client, minimal_project_dir):
        files = client.get("/api/audit/files").json()["files"]
        if not files:
            pytest.skip("No files returned")
        path = files[0]["path"]
        body = client.get(f"/api/audit/file?path={path}").json()
        assert "content" in body

    def test_file_content_nonexistent_returns_404(self, client):
        resp = client.get("/api/audit/file?path=/tmp/does_not_exist_xyz.lkml")
        assert resp.status_code == 404

    def test_files_endpoint_before_audit_returns_404(self):
        """Fresh client with no state yet."""
        from fastapi.testclient import TestClient
        from main import app, _audit_state
        _audit_state.clear()
        with TestClient(app) as fresh_client:
            resp = fresh_client.get("/api/audit/files")
            assert resp.status_code == 404


# ─────────────────────────────────────────────────────────────────────────────
# DELETE /api/audit/cleanup
# ─────────────────────────────────────────────────────────────────────────────

class TestCleanup:

    def test_cleanup_nothing_to_clean(self, client):
        from main import _audit_state
        _audit_state["tmp_dir"] = None
        resp = client.delete("/api/audit/cleanup")
        assert resp.status_code == 200
        assert resp.json()["status"] == "nothing_to_clean"

    def test_cleanup_deletes_tmp_dir(self, client, tmp_path):
        """Create a real temp dir, set it in state, verify cleanup removes it."""
        from main import _audit_state
        fake_tmp = tmp_path / "fake_clone"
        fake_tmp.mkdir()
        _audit_state["tmp_dir"] = str(fake_tmp)
        resp = client.delete("/api/audit/cleanup")
        assert resp.status_code == 200
        assert not fake_tmp.exists()


# ─────────────────────────────────────────────────────────────────────────────
# Audit pipeline — data integrity checks
# ─────────────────────────────────────────────────────────────────────────────

class TestAuditPipelineIntegrity:

    def test_view_fields_have_correct_types(self, client, minimal_project_dir):
        body = client.post("/api/audit/local", json={"path": minimal_project_dir}).json()
        for view in body["views"]:
            assert isinstance(view["n_fields"], int)
            assert isinstance(view["n_dimensions"], int)
            assert isinstance(view["n_measures"], int)
            assert isinstance(view["is_derived_table"], bool)
            assert isinstance(view["has_primary_key"], bool)

    def test_explore_joins_have_resolved_view(self, client, minimal_project_dir):
        """Every join in the API response must have a resolved_view key."""
        body = client.post("/api/audit/local", json={"path": minimal_project_dir}).json()
        for exp in body["explores"]:
            for j in exp.get("joins", []):
                assert "resolved_view" in j

    def test_issue_severity_values_valid(self, client, broken_project_dir):
        body = client.post("/api/audit/local", json={"path": broken_project_dir}).json()
        valid = {"error", "warning", "info"}
        for issue in body["issues"]:
            assert issue["severity"] in valid, f"Bad severity: {issue['severity']}"

    def test_issue_category_values_valid(self, client, broken_project_dir):
        body = client.post("/api/audit/local", json={"path": broken_project_dir}).json()
        valid = {"Broken Reference", "Duplicate Definition", "Join Integrity", "Field Quality"}
        for issue in body["issues"]:
            assert issue["category"] in valid, f"Bad category: {issue['category']}"

    def test_manifest_constants_in_response(self, client, minimal_project_dir):
        body = client.post("/api/audit/local", json={"path": minimal_project_dir}).json()
        assert "manifest_constants" in body["project"]
        assert isinstance(body["project"]["manifest_constants"], dict)
