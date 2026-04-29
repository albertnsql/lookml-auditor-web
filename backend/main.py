"""
LookML Auditor — FastAPI Backend
Full port of all Streamlit dashboard.py functionality.
"""
from __future__ import annotations
import os, sys, shutil, subprocess, tempfile, zipfile, re
from pathlib import Path
from typing import Optional
from collections import Counter

from fastapi import FastAPI, UploadFile, File, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel

# ── Core module path ────────────────────────────────────────────────────────
current_dir = os.path.dirname(os.path.abspath(__file__))
core_dir = os.path.join(current_dir, "core")
sys.path.insert(0, core_dir)

from lookml_parser import parse_project
from lookml_parser.models import LookMLProject
from validators import run_all_checks, compute_health_score, compute_category_scores
from validators.suppression import load_suppression_rules, apply_suppressions

# ── FastAPI App ─────────────────────────────────────────────────────────────
app = FastAPI(title="LookML Auditor API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173","https://lookml-auditor-web.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── In-memory audit state (reset per audit run) ─────────────────────────────
_audit_state: dict = {}

# ── Pydantic Response Models ────────────────────────────────────────────────

class FieldOut(BaseModel):
    name: str
    field_type: str
    type: Optional[str] = None
    label: Optional[str] = None
    description: Optional[str] = None
    hidden: bool = False
    primary_key: bool = False
    source_file: str = ""
    line_number: int = 0

class JoinOut(BaseModel):
    name: str
    from_view: Optional[str] = None
    type: Optional[str] = None
    relationship: Optional[str] = None
    sql_on: Optional[str] = None
    sql_where: Optional[str] = None
    foreign_key: Optional[str] = None
    resolved_view: str
    source_file: str = ""

class ViewOut(BaseModel):
    name: str
    sql_table_name: Optional[str] = None
    derived_table_sql: Optional[str] = None
    is_derived_table: bool
    has_primary_key: bool
    primary_key_field: Optional[str] = None
    fields: list[FieldOut] = []
    n_dimensions: int
    n_measures: int
    n_fields: int
    source_file: str = ""
    line_number: int = 0

class ExploreOut(BaseModel):
    name: str
    base_view: str
    label: Optional[str] = None
    description: Optional[str] = None
    joins: list[JoinOut] = []
    source_file: str = ""

class IssueOut(BaseModel):
    severity: str
    category: str
    object_name: str
    object_type: str = ""
    message: str
    suggestion: str = ""
    source_file: str = ""
    line_number: Optional[int] = None

class ProjectSummary(BaseModel):
    name: str
    root_path: str
    manifest_constants: dict[str, str] = {}

class CategoryScores(BaseModel):
    broken_reference: int
    duplicate_view_source: int
    duplicate_field_sql: int
    join_integrity: int
    field_quality: int

class AuditResponse(BaseModel):
    project: ProjectSummary
    views: list[ViewOut]
    explores: list[ExploreOut]
    issues: list[IssueOut]
    suppressed: int
    health_score: int
    category_scores: CategoryScores
    tmp_dir: Optional[str] = None
    source_type: str = "local"

# ── Helper: run full audit pipeline ────────────────────────────────────────
def _run_audit_pipeline(path: str, tmp_dir: Optional[str] = None, source_type: str = "local") -> AuditResponse:
    project = parse_project(path)
    issues_raw = run_all_checks(project)
    rules = load_suppression_rules(project.root_path)
    issues_raw, suppressed_count = apply_suppressions(issues_raw, rules, project.root_path)

    health = compute_health_score(issues_raw, project)
    cat_scores = compute_category_scores(issues_raw, project)

    views_out = []
    for v in project.views:
        pk = v.primary_key_field
        views_out.append(ViewOut(
            name=v.name,
            sql_table_name=v.sql_table_name,
            derived_table_sql=v.derived_table_sql,
            is_derived_table=v.is_derived_table,
            has_primary_key=v.has_primary_key,
            primary_key_field=pk.name if pk else None,
            fields=[FieldOut(
                name=f.name, field_type=f.field_type, type=f.data_type, label=f.label,
                description=f.description, hidden=f.hidden, primary_key=f.primary_key,
                source_file=f.source_file, line_number=f.line_number
            ) for f in v.fields],
            n_dimensions=len(v.dimensions),
            n_measures=len(v.measures),
            n_fields=len(v.fields),
            source_file=v.source_file or "",
            line_number=v.line_number or 0,
        ))

    explores_out = []
    for e in project.explores:
        explores_out.append(ExploreOut(
            name=e.name,
            base_view=e.base_view,
            label=e.label,
            description=e.description,
            joins=[JoinOut(
                name=j.name, from_view=j.from_view, type=j.type,
                relationship=j.relationship, sql_on=j.sql_on, sql_where=j.sql_where,
                foreign_key=j.foreign_key,
                resolved_view=j.resolved_view, source_file=j.source_file or "",
            ) for j in e.joins],
            source_file=e.source_file or "",
        ))

    issues_out = []
    for i in issues_raw:
        issues_out.append(IssueOut(
            severity=i.severity if isinstance(i.severity, str) else i.severity.value,
            category=i.category.value if hasattr(i.category, "value") else str(i.category),
            object_name=i.object_name,
            object_type=getattr(i, "object_type", ""),
            message=i.message,
            suggestion=getattr(i, "suggestion", ""),
            source_file=i.source_file or "",
            line_number=getattr(i, "line_number", None),
        ))

    response = AuditResponse(
        project=ProjectSummary(
            name=project.name,
            root_path=project.root_path,
            manifest_constants=project.manifest_constants,
        ),
        views=views_out,
        explores=explores_out,
        issues=issues_out,
        suppressed=suppressed_count,
        health_score=health,
        category_scores=CategoryScores(
            broken_reference=cat_scores.get("Broken Reference", 100),
            duplicate_view_source=cat_scores.get("Duplicate View Source", 100),
            duplicate_field_sql=cat_scores.get("Duplicate Field SQL", 100),
            join_integrity=cat_scores.get("Join Integrity", 100),
            field_quality=cat_scores.get("Field Quality", 100),
        ),
        tmp_dir=tmp_dir,
        source_type=source_type,
    )

    # Store in memory for file access endpoints
    _audit_state["project"] = project
    _audit_state["tmp_dir"] = tmp_dir

    return response


# ── GitHub clone helper ─────────────────────────────────────────────────────
def _clone_repo(url: str, subfolder: str = "") -> tuple[str, str]:
    if not shutil.which("git"):
        raise HTTPException(status_code=500, detail="`git` is not installed or not on PATH.")
    tmp = tempfile.mkdtemp(prefix="lookml_audit_")
    try:
        result = subprocess.run(
            ["git", "clone", "--depth=1", url, tmp],
            capture_output=True, text=True, timeout=120,
        )
        if result.returncode != 0:
            shutil.rmtree(tmp, ignore_errors=True)
            raise HTTPException(status_code=400, detail=f"git clone failed: {result.stderr.strip()}")
    except subprocess.TimeoutExpired:
        shutil.rmtree(tmp, ignore_errors=True)
        raise HTTPException(status_code=408, detail="git clone timed out after 120s.")

    local_path = tmp
    if subfolder:
        sub = Path(tmp) / subfolder.strip("/")
        if sub.is_dir():
            local_path = str(sub)
        else:
            shutil.rmtree(tmp, ignore_errors=True)
            raise HTTPException(status_code=404, detail=f"Subfolder '{subfolder}' not found in cloned repo.")
    return local_path, tmp


# ══════════════════════════════════════════════════════════════
# ENDPOINTS
# ══════════════════════════════════════════════════════════════

@app.get("/api/health")
def health_check():
    return {"status": "ok", "message": "LookML Auditor API v2.0 is running."}


@app.post("/api/audit/github", response_model=AuditResponse)
def audit_github(body: dict):
    url = body.get("url", "").strip()
    subfolder = body.get("subfolder", "").strip()
    if not url:
        raise HTTPException(status_code=400, detail="GitHub URL is required.")
    local_path, tmp_root = _clone_repo(url, subfolder)
    try:
        return _run_audit_pipeline(local_path, tmp_dir=tmp_root, source_type="github")
    except Exception as e:
        shutil.rmtree(tmp_root, ignore_errors=True)
        raise HTTPException(status_code=500, detail=str(e))


class LocalAuditRequest(BaseModel):
    path: str

@app.post("/api/audit/local", response_model=AuditResponse)
def audit_local(body: LocalAuditRequest):
    local_path = body.path.strip()
    if not local_path or not os.path.isdir(local_path):
        raise HTTPException(status_code=400, detail="Valid local directory path is required.")
    try:
        return _run_audit_pipeline(local_path, tmp_dir=None, source_type="local")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/audit/upload", response_model=AuditResponse)
async def audit_upload(file: UploadFile = File(...)):
    if not file.filename.endswith(".zip"):
        raise HTTPException(status_code=400, detail="Only .zip files are accepted.")
    tmp_root = tempfile.mkdtemp(prefix="lookml_audit_zip_")
    try:
        zip_path = os.path.join(tmp_root, "upload.zip")
        with open(zip_path, "wb") as f:
            content = await file.read()
            f.write(content)
        with zipfile.ZipFile(zip_path, "r") as zf:
            zf.extractall(tmp_root)
        os.remove(zip_path)
        items = [i for i in os.listdir(tmp_root)]
        if len(items) == 1 and Path(tmp_root, items[0]).is_dir():
            extracted_path = str(Path(tmp_root, items[0]))
        else:
            extracted_path = tmp_root
        return _run_audit_pipeline(extracted_path, tmp_dir=tmp_root, source_type="zip")
    except Exception as e:
        shutil.rmtree(tmp_root, ignore_errors=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/audit/files")
def get_file_list():
    project = _audit_state.get("project")
    if not project:
        raise HTTPException(status_code=404, detail="No audit has been run yet.")
    files = sorted(project.all_files)
    root = Path(project.root_path)
    result = []
    for f in files:
        try:
            rel = str(Path(f).relative_to(root))
        except ValueError:
            rel = Path(f).name
        result.append({"path": f, "relative": rel})
    return {"files": result}


@app.get("/api/audit/file")
def get_file_content(path: str = Query(...)):
    project = _audit_state.get("project")
    if not project:
        raise HTTPException(status_code=404, detail="No audit has been run yet.")
    p = Path(path)
    if not p.exists():
        raise HTTPException(status_code=404, detail=f"File not found: {path}")
    try:
        content = p.read_text(encoding="utf-8", errors="replace")
        return {"content": content, "path": path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/audit/cleanup")
def cleanup_clone():
    tmp_dir = _audit_state.get("tmp_dir")
    if not tmp_dir or not Path(tmp_dir).exists():
        return {"status": "nothing_to_clean"}
    shutil.rmtree(tmp_dir, ignore_errors=True)
    _audit_state["tmp_dir"] = None
    return {"status": "deleted", "path": tmp_dir}
