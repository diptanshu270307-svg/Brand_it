> **Lustro Velvet redesign:** Read [START-HERE.md](START-HERE.md) for current setup, frontend changes, verified checks and compatibility limits. The following is the original prototype documentation.

# BrandLint — Spell-check for your brand, with a human in charge

> **Pitch:** *“BrandLint connects every finding to a rule, every claim to evidence, and every approval to a human.”*

BrandLint is a pre-publication brand governance desk built with **React + TypeScript**, **FastAPI**, and **PostgreSQL** (with zero-setup SQLite fallback for local offline evaluation). Content creators, reviewers, senior reviewers, and brand owners use a single traceable workflow:

**Upload brand rules → Check a draft → Inspect evidence → Accept fixes → Approve through human review.**

---

## Three Flagship USPs

1. **Claim Evidence Passports (`EvidenceRecord` + `SourceModal`)**
   - Every promotional claim (numeric, superlative, guarantee, or security/compliance) links to an approved source document, version, page, exact supporting excerpt, evidence owner, and expiry date.
   - Missing, unapproved, expired, or insufficient evidence **blocks approval on the backend** and cannot be overridden.
   - Retrieval (`backend/app/analysis/evidence.py`) uses PostgreSQL full-text search (`to_tsvector` / `websearch_to_tsquery`) plus lexical/numeric coverage to surface *candidate* evidence; candidate presence alone never proves a claim (`backend/app/analysis/pipeline.py`).
   - Clicking any claim opens its **Evidence Passport** with the exact supporting excerpt highlighted inside the source page.

2. **Intent-Preserving Fixes (`backend/app/analysis/protected.py`)**
   - Captures and protects the draft’s **Audience**, **Purpose**, and **Call to Action (CTA)**.
   - Displays every suggested change as an individual **before / after diff** (`− original` / `+ replacement`) that users accept or reject one by one.
   - Automatically detects if a suggestion alters **product names**, **numbers**, **factual claims**, or the **CTA**, and requires explicit human confirmation (`confirm_protected=True`) before applying (`409 protected_change_needs_confirmation`).

3. **Guideline Health (`backend/app/insights.py`)**
   - Tracks which rules reviewers repeatedly override, their stated reasons, and concrete draft examples.
   - Clearly labels rules with fewer than `MIN_HEALTH_SAMPLE` (5) overrides as **Insufficient History**.
   - Generates a proposed clearer rule wording (`POST /api/brands/{id}/health/{rule_key}/suggest`) with a side-by-side diff (`v1` → `v2`) and rationale.
   - **Never mutates rules automatically** — only a `brand_owner` can approve a proposal (`POST /api/brands/{id}/proposals/{id}/approve`), which creates a new immutable rule version (`KEY@2`) while preserving historical version pins on past analyses.

---

## Five Screens

1. **1. Brand Library (`frontend/src/screens/BrandLibrary.tsx`)** — Upload text-based PDFs (`demo/sample_guidelines.pdf`) or paste guidelines, inspect extracted rules with page/excerpt citations and prompt-injection warnings, and approve proposed rules before activation.
2. **2. Draft Review (`frontend/src/screens/DraftReview.tsx`)** — Draft editor, Audience/Purpose/CTA fields, inline highlighted findings, severity filters, clickable Evidence Passports, and individual intent-preserving before/after fixes.
3. **3. Evidence Vault (`frontend/src/screens/EvidenceVault.tsx`)** — Approved claims, exact source excerpts (verified verbatim against the source page), document/version/page references, evidence owners, and validity dates (`current`, `expired`, `pending`).
4. **4. Review Queue (`frontend/src/screens/ReviewQueue.tsx`)** — Role-based routing (`standard` route for routine edits vs. `senior` route for sensitive/unresolved claims), reviewer comments, backend approval gates, and the full decision & privacy-preserving audit trail.
5. **5. Insights & Health (`frontend/src/screens/Insights.tsx`)** — Recurring issues (separating live checks from clearly labelled `[SEEDED SAMPLE]` history), Guideline Health override patterns & wording proposals, and the live **18-Draft Measured Evaluation Benchmark**.

---

## Quick Start

### Option A: Local One-Command Run (FastAPI + Built React SPA)

```bash
cp .env.example .env
chmod +x scripts/run_demo.sh
./scripts/run_demo.sh
```

Then open **http://127.0.0.1:8000** in your browser.

### Option B: Separate Backend & Frontend Dev Servers

```bash
# Terminal 1 — Backend (port 8000)
cd backend
.venv/bin/python -m app.seed --reset
.venv/bin/uvicorn app.main:app --reload --port 8000

# Terminal 2 — Frontend (port 5173, proxies /api to 127.0.0.1:8000)
cd frontend
npm run dev
```

### Option C: Docker Compose with PostgreSQL 16

```bash
docker compose up --build
```

---

## Demo Accounts (Switchable in One Click from the Top Bar)

All demo accounts share password `demo1234`:

| Persona | Email | Role | Purpose |
|---|---|---|---|
| **Casey Morgan** | `casey@lumina.demo` | `creator` | Edits drafts, runs checks, accepts/rejects fixes, submits for review |
| **Riley Chen** | `riley@lumina.demo` | `reviewer` | Reviews & approves `standard`-route drafts |
| **Sam Patel** | `sam@lumina.demo` | `senior_reviewer` | Reviews & approves `senior`-route drafts (sensitive/claim issues) |
| **Olivia Brooks** | `olivia@lumina.demo` | `brand_owner` | Uploads PDFs, activates proposed rules, approves evidence & Guideline Health wording |
| **Noah Winter** | `noah@northwind.demo` | `brand_owner` (separate tenant) | Demonstrates strict cross-brand access isolation (`404`) |

---

## Repeatable Pitch Demo Walkthrough

You can click **↺ Reset Demo** in the top bar at any time and follow the 5 cards in the **Repeatable Pitch Walkthrough** strip:

1. **Check the Hero Draft (`Casey — Creator`, Screen 2: Draft Review)**
   - Select **“Launch email - productivity claim”** containing:
     `Introducing LuminaFlow, built for operations teams. Our platform guarantees 40% higher productivity. Start your free trial today!`
   - Click **▶ Run BrandLint Checks**.
   - BrandLint flags:
     - `TERM-01@1`: `"LuminaFlow"` → `"Lumina Flow"` (protected product-name change flagged).
     - `CLAIM-01@1`: `"guarantees"` → `"helps deliver"` (prohibited guarantee wording).
     - `CLAIM-03@1`: `"Our platform guarantees 40% higher productivity."` → **PASSPORT: EXPIRED** (`EV-4`, *2023 Pilot Results Memo*, expired 120 days ago).

2. **Inspect Source, Accept Tone Fix & Watch the Claim Block Approval**
   - Click the highlighted 40% claim (or **Inspect Source Proof ↗**) to open the **Evidence Passport** modal showing `EV-4`, owner `Priya Nair (Research)`, the expiry date, and the highlighted excerpt in the source document.
   - Click **✓ Accept Fix** on `CLAIM-01` (`guarantees` → `helps deliver`). Revision #2 is created and re-checked automatically.
   - Click **🛡 Test Approval Gate** (or submit and try approving as `Sam — Senior Reviewer`): the backend **blocks approval (`409 approval_blocked / claim_expired`)** and logs `approval_denied` in the audit trail.

3. **Replace with Evidence-Supported Statement & Rerun Checks**
   - Check the confirmation box on `TERM-01` (`LuminaFlow` → `Lumina Flow`) and click **✓ Accept Fix**.
   - On the expired 40% claim finding, review the intent-preserving rewrite sourced from current approved evidence `EV-1` (*Customer Productivity Study 2025*):
     `Teams using Lumina Flow reported 18% higher task throughput after 90 days.`
   - Check **“I explicitly confirm changing these protected names, numbers or factual statements”** and click **✓ Accept Fix**.
   - BrandLint creates Revision #4, re-runs checks, verifies `EV-1` is **SUPPORTED**, preserves the CTA (`Start your free trial today!`), and clears all blockers (`0 blockers`, route switches to `standard`).
   - Click **Submit for Review (Standard Route) →**.

4. **Approve in Human Review & Inspect the Audit Trail (`Riley — Reviewer`, Screen 4: Review Queue)**
   - Switch to **Riley Chen — Reviewer** in the top bar (or click Step 4 in the walkthrough strip).
   - Enter a reviewer sign-off note and click **✓ Approve Revision #4**.
   - The backend re-runs checks (`triggered_by: pre_approval`), confirms zero blockers, transitions the draft to `approved`, and records the human decision and privacy-preserving audit event (hashes/IDs/rule versions only — never draft text).

5. **Guideline Health Clarification (`Screen 5: Insights & Health`)**
   - Open **5. Insights & Health**.
   - Inspect `TONE-01@1` (*Professional, friendly voice*), which has **6 overrides** (e.g., *“Informal greeting is on-brand for Instagram”* ×3, *“Quoted customer language, not our own voice”* ×2), while `ACC-01` (3 overrides) and `TERM-02` (2 overrides) are badged **⚠️ Insufficient History (< 5 min sample)**.
   - Click **✨ Suggest Clearer Wording for TONE-01** to view the side-by-side `v1` → `v2` diff and rationale.
   - Switch to **Olivia Brooks — Brand Owner** and click **✓ Approve & Publish TONE-01@2**.

---

## Automated Tests & Measured Evaluation

Run the full 26-test backend suite (covering unsupported claims, expired evidence, invalid model citations, prompt injection in PDFs/drafts, unauthorized approval, edits after approval, and Guideline Health):

```bash
cd backend
.venv/bin/python -m pytest -q
```

Run the 18-draft benchmark evaluation (`13` problematic drafts + `5` clean drafts):

```bash
backend/.venv/bin/python scripts/evaluate.py
```

Measured results from `scripts/evaluate.py`:
- **Drafts evaluated:** 18 (13 problematic, 5 clean)
- **False alarms on clean drafts:** `0 / 5`
- **Valid citations (verbatim quote in draft + valid rule/evidence excerpt in source):** `30 / 30 (100.0%)`
- **True positives / Expected issues:** `23 / 25` (the 2 differences are `B15` and `B16`, where unsupported claims are still caught and blocked as `CLAIM:needs_review` and `CLAIM:insufficient` rather than `CLAIM:missing`)
- **Average check latency (local mock provider):** ~4 ms / draft
