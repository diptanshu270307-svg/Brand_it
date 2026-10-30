# BrandLint Release Checklist

This release checklist outlines the quality gates, operational prerequisites, and verification steps required before deploying BrandLint to production.

---

## Phase 1: Pre-Deployment Quality Gates

- [x] **Backend Integration & Unit Tests**
  - Run `backend/.venv/bin/pytest backend/tests/`
  - Verify all 128 tests pass with 0 errors across security, auth, tenant isolation, analysis pipeline, approvals, recall, and reliable operations.
- [x] **Frontend Production Build**
  - Run `npm --prefix frontend run build`
  - Verify TypeScript compilation passes (`tsc --noEmit`) and Vite generates assets into `frontend/dist/` without warnings or bundle errors.
- [x] **Dependency Integrity**
  - `pip check` in the virtualenv reports no broken requirements.
  - `frontend/package-lock.json` is committed.
- [ ] **Dependency Advisory Audit** (NOT yet run — needs network)
  - Run `npm --prefix frontend audit --omit=dev` and `pip-audit -r backend/requirements.txt`.
  - Note: `backend/requirements.txt` uses `>=` ranges; generate a pinned lock (`pip freeze > backend/requirements.lock`) from the tested venv for reproducible builds.
- [ ] **UI & Accessibility Verification** (NOT yet performed)
  - Responsive layouts at phone (375px), tablet (768px), desktop (1280px+).
  - Keyboard-only navigation: tab order, visible focus, Escape closes dialogs.
  - Screen reader labels and live-region announcements.
  - `prefers-reduced-motion: reduce` disables decorative motion (CSS rules exist in `theme.css`/`lustro.css`; not inspected in a browser).
- [x] **Production Configuration Guardrails**
  - Confirm `APP_MODE=production`.
  - Confirm `SECRET_KEY` is set to an unguessable 32+ character random string (never default).
  - Confirm `DEMO_PASSWORD` is unset or blank.
  - Confirm `SEED_ON_STARTUP=false`.
  - Confirm `DATABASE_URL` specifies PostgreSQL (`postgresql+psycopg://...`).
  - Confirm `PUBLIC_BASE_URL` uses `https://`.
  - Confirm `CORS_ORIGINS` specifies exact authorized domains (no wildcards `*`).

---

## Phase 2: Database & Migration Verification

- [ ] **Pre-Deployment Database Backup**
  - Execute automated database backup:
    ```bash
    python backend/scripts/backup_restore.py backup --output data/backups/brandlint_pre_release.sql
    ```
  - Verify backup SQL dump and checksum exist on durable external storage (e.g. S3 / GCS).
- [ ] **Migration Status Check**
  - Inspect pending migrations:
    ```bash
    python backend/scripts/migrate.py status
    ```
  - Confirm target migration version matches expected release milestone (e.g. `0005`).
- [ ] **Execute Forward Migration**
  - Apply migrations:
    ```bash
    python backend/scripts/migrate.py upgrade
    ```
  - Verify migration status confirms all migrations applied cleanly.

---

## Phase 3: Deployment & Service Startup

- [ ] **Deploy Application Artifact**
  - Deploy container image or package release ZIP containing `backend/`, `frontend/dist/`, and migrations.
  - Verify private document storage volume is mounted with restricted permissions (`chmod 700`).
- [ ] **Liveness & Readiness Verification**
  - Query container liveness:
    ```bash
    curl -f http://127.0.0.1:8000/healthz
    ```
  - Query readiness probe:
    ```bash
    curl -f http://127.0.0.1:8000/readyz
    ```
    Confirm response indicates `status: "ready"` with database, migrations, storage volume, and LLM provider all reporting `status: "ok"`.

---

## Phase 4: Post-Deployment Smoke Tests

- [ ] **Authentication & CSRF**
  - Sign in with administrative account.
  - Confirm `brandlint_session` (HttpOnly, Secure, SameSite=Lax) and `brandlint_csrf` cookies are set.
  - Verify mutating requests include matching `X-CSRF-Token` header.
- [ ] **Brand Guideline & Fact Inspection**
  - View **Brand rules** and inspect active rules.
  - View **Approved facts** and verify Evidence Passports load accurately.
- [ ] **Content Checking & Rewrite Safeguards**
  - Paste test copy and run **Check content**.
  - Confirm **Must fix**, **Needs review**, and **Suggestions** render with clear plain-language descriptions.
  - Accept a suggestion; confirm protected product names, numbers, disclaimers, and CTAs remain intact.
- [ ] **Submission & Independent Review**
  - Submit draft for review.
  - Confirm author is blocked from self-approval.
  - Log in as eligible reviewer and approve the draft with a recorded reason.
- [ ] **Observability & Alerting**
  - Query `/metrics` and confirm request counter and latency histograms are recording.
  - Query `/api/system/alerts` and confirm no critical operator alerts are firing.
  - Inspect application access logs to verify request IDs are present and draft text is strictly scrubbed.

---

## Phase 5: Sign-Off

- **Release Version**: `v1.0.0`
- **Deployment Engineer**: __________________________
- **Reviewing Administrator**: __________________________
- **Deployment Date**: __________________________
- **Rollback Plan Verified**: [ ] Yes
