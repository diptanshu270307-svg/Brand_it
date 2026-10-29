# BrandLint — Lustro Velvet frontend

This package contains the complete supplied project with a redesigned React frontend, Tailwind CSS configuration, a reproducible npm lockfile, and a compiled `frontend/dist/` production build. The backend and its API contracts are unchanged. This is a local project ZIP; it has not been deployed.

## Start on Windows

Run these commands in PowerShell from this folder. Python 3.11+ and Node.js 18+ are required. Dependency installation requires internet access.

```powershell
python -m venv backend/.venv
backend/.venv/Scripts/python -m pip install -r backend/requirements.txt
Copy-Item .env.example .env
backend/.venv/Scripts/python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000
```

Open `http://127.0.0.1:8000`. The first startup creates and seeds the local demo database. The prebuilt frontend is served by FastAPI. No npm installation is needed just to run that supplied build.

For frontend development in another terminal:

```powershell
npm --prefix frontend ci
npm --prefix frontend run dev
```

The Vite dev server proxies `/api` to the backend on port 8000. To rebuild:

```powershell
npm --prefix frontend run build
```

On macOS/Linux, use `python3` and `backend/.venv/bin/python` instead of the Windows interpreter path. The original `scripts/run_demo.sh` is also included; it resets demo data each time it runs.

## What changed

- Consistent Lustro Velvet dark theme and persistent Daylight toggle, Space Grotesk/Inter/JetBrains Mono typography, matte glass panels, white primary actions, and semantic evidence states.
- Responsive, scrollable workspace navigation; prominent processing status; collapsible judge walkthrough; independent reviewer handoff.
- Three-column review studio, unfamiliar claim testing, real inline findings, side-by-side edits, explicit protected-change confirmation, and API-derived evidence coverage.
- Two-column evidence passport grid with source inspection, approval/revoke/restore controls, and a live dependency scan of visible approved drafts.
- Role-aware review queue, decision notes, comments, checked-revision metadata, and audit timeline.
- Guideline wording studio, channel guidance drafting, searchable rulebook, source ingestion, and on-demand measured benchmark.
- Source dialogs include keyboard focus trapping, Escape-to-close, source paging, and original-quote highlighting.
- Removed obsolete, unused charts containing fabricated metrics and the static simulated CLI/customer logos.

`Loader.tsx`, `styles.css`, and `theme.css` are byte-for-byte identical to the supplied prototype. Tailwind preflight is disabled to protect the existing loader. New styling is isolated to the workspace. Backend source and `src/api.ts` are unchanged.

## Important compatibility details

The supplied ZIP predates the Round 3 backend described in the redesign brief. Rather than fabricate missing data or introduce unsupported API calls, this frontend handles the available contracts explicitly:

1. **Five-dimension proof:** the comparison lists Product, Metric, Population, Timeframe, and Qualifiers, alongside the actual claim and evidence. Per-dimension verification is marked **Not measured** because the API does not return it. A source quote is not presented as a semantic fact check.
2. **Revision score:** the API has no overall compliance score. The desk shows evidence coverage: detected claims with `supported` status and a current passport divided by detected claims. The denominator and limitation are disclosed. Unchecked revisions and revisions with no detected claims remain unscored. Unsaved edits hide checked metrics and show verification pending.
3. **Recall:** the scan inspects the current passport states linked to approved drafts. It identifies affected drafts in this view and can open them as the demo author. It does not persist a recall state or silently revoke approvals. The author must create a revision to invalidate approval and run checks again. Expired evidence cannot be restored simply by approving it.
4. **Guideline Health:** the older API aggregates events across versions. The UI labels this limitation; it does not invent isolated v1/v2 performance. Channel selections draft proposed wording only. They do not change executable conditions. Behavior-impact measurements require backend support.
5. **Benchmark:** sample size is read from the actual evaluation response (the original benchmark contains 18 drafts), never forced to the brief's example of 26. Quote validity, issue precision/recall, counts and latency are real response fields. Dedicated factual support accuracy and adversarial-pair rejection metrics are **Not measured**.
6. **Offline verification:** the original mock analysis remains available and is clearly labelled. It is not comprehensive semantic claim verification. Configure the existing hosted provider adapter in `.env` for live AI processing. New benchmark runs can make model calls when a hosted provider is active.

## Validation

- `npm --prefix frontend run build`: TypeScript and production bundling completed with zero errors.
- Existing backend suite: **26 tests passed**. One dependency deprecation warning was emitted.
- Loader, legacy loader CSS, backend source, and API client were compared against the supplied archive.
- A browser preview was attempted, but the local sandbox server was unreachable from the preview browser. Interactive browser and visual verification are therefore not confirmed.

Dependencies, caches, `.env` secrets, runtime databases and the original nested ZIP are excluded from this archive. Configure real deployment authentication and secrets before exposing the demo beyond your machine.
