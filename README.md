# LookML Auditor

Static analysis for Looker projects. Catch broken references, duplicate definitions, and join integrity issues before they reach production dashboards.

**Live app:** [lookml-auditor-web.vercel.app](https://lookml-auditor-web.vercel.app)

---

## What it does

Looker projects accumulate debt quietly. A view gets defined twice. An explore joins something that no longer exists. A field ships without a label and suddenly half your business users are reading `customer_lifetime_value_usd_30d` in a dropdown. None of this errors loudly — it just silently degrades your project.

LookML Auditor scans your entire project and tells you what's broken, what's redundant, and what's making your dashboards wrong. Point it at a GitHub repo, a local folder, or a ZIP. You get a health score, a ranked issue list with file and line numbers, and enough context to actually fix things.

**What it checks:**

- **Broken References** — explores joining views that don't exist, fields referencing missing dimensions
- **Duplicate Definitions** — the same view or field defined in more than one file (Looker will refuse to load the project)
- **Join Integrity** — joins missing `sql_on` or `foreign_key`, fanout risk from missing `relationship` declarations
- **Field Quality** — missing labels, missing descriptions, views without a primary key

---

## Screenshots

<img width="1919" height="965" alt="image" src="https://github.com/user-attachments/assets/f51be6f5-6eae-41de-ac79-86abbb9aa3d1" />


<img width="1906" height="964" alt="image" src="https://github.com/user-attachments/assets/abdc7489-6a9f-4b82-9601-92085fbe358b" />


<img width="1908" height="967" alt="image" src="https://github.com/user-attachments/assets/eac1e3f3-473e-4bfb-936a-26ae73d1eac4" />

<img width="1918" height="968" alt="image" src="https://github.com/user-attachments/assets/478c3d9e-cc14-4a54-9a34-29ff88368501" />



---

| Overview | Issues | Visualizations |
|----------|--------|----------------|
| Health score, KPI cards, project health gauge | Issue list grouped by file, violation rules ranked by frequency | Explore complexity, field type breakdown, metadata coverage |

---

## Getting started

### Prerequisites

- Node.js 18+
- Python 3.10+
- A LookML project (GitHub URL, local folder, or ZIP)

### Run locally

**Backend:**
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. The frontend expects the backend at `http://localhost:8000`.

### Point it at a project

Three ways in:

1. **GitHub URL** — paste a repo URL and optionally specify a subfolder (e.g. `mock_project/`)
2. **Upload ZIP** — download your repo as a ZIP and upload directly
3. **Local folder** — select a folder from your machine using the browser file picker (Chrome/Edge only)

---

## How scoring works

The health score runs 0–100 across four equally weighted categories: Broken Reference, Duplicate Definition, Join Integrity, and Field Quality.

Errors carry heavier penalties than warnings. More importantly, breaking errors cap the maximum score regardless of how everything else looks. A project with active explore-breaking errors won't score above 88 — a 95/100 with broken references would be misleading.

---

## Project structure

```
lookml-auditor/
├── backend/
│   ├── main.py           # FastAPI app, audit endpoints
│   ├── parser.py         # LookML file parser
│   ├── auditor.py        # Issue detection logic
│   ├── scorer.py         # Health score computation
│   └── tests/            # pytest suite
├── frontend/
│   ├── src/
│   │   ├── components/   # Dashboard, LandingPage, tab views
│   │   ├── api.js        # Backend API calls
│   │   └── App.jsx
│   └── vite.config.js
└── mock_project/         # Sample LookML for testing
```

---

## Tech

- **Frontend:** React, Vite, raw SVG charts — no chart libraries
- **Backend:** Python, FastAPI
- **Parsing:** Custom regex-based LookML parser
- **Hosting:** Vercel (frontend), self-hosted backend

The parser uses regex rather than AST parsing. It handles real-world LookML well but may produce false positives in heavily Jinja-templated projects.

---

## Development

**Run tests:**
```bash
# Backend
cd backend && pytest

# Frontend  
cd frontend && npm run test
```

---

## Known limitations

- Local path mode requires the backend running on the same machine as the browser
- Private GitHub repos aren't supported yet (no token auth)
- The File System Access API (browser folder picker) only works in Chrome and Edge, not Firefox or Safari
- Heavily templated LookML with complex Jinja may trip up the parser

---
