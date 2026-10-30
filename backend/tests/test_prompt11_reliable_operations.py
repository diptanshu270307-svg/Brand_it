"""Tests for Prompt 11: Reliable SaaS operations.

Covers:
1. Versioned migrations on seeded data, rollback, and production create_all prohibition.
2. Durable tenant-scoped analysis jobs, idempotency, bounded retries, and cancellation.
3. Stale result prevention when drafts are updated concurrently.
4. Workspace usage limits and server-side usage accounting.
5. Readiness and liveness probes, structured logging, request IDs, and operator alerts.
6. Browser security headers and CSP compatibility with Loader.tsx.
7. Database backup and restore into a separate test database.
"""
import os
import shutil
import tempfile
import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect, select, text

from app.config import Settings, get_settings
from app.db import Base, SessionLocal
from app.jobs import cancel_job, create_or_get_job, run_job_execution
from app.migrations.runner import (
    get_migration_status,
    rollback_migration,
    run_migrations,
)
from app.models import AnalysisJob, Brand, Company, Draft, DraftRevision, User, WorkspaceUsageRecord
from app.observability import check_liveness, check_readiness, record_operator_alert, registry
from app.usage import check_workspace_limits, get_workspace_usage_summary, record_workspace_usage
from scripts.backup_restore import backup_database, restore_database, verify_database


# -----------------------------------------------------------------------------
# 1. Versioned Migrations & Production create_all Prohibition
# -----------------------------------------------------------------------------

def test_migrations_on_seeded_data_and_rollback(tmp_path):
    """Demonstrates running versioned migrations on seeded data, and rolling back safely."""
    test_db_file = tmp_path / "migration_test.db"
    test_db_url = f"sqlite:///{test_db_file}"
    engine = create_engine(test_db_url)

    # 1. Apply up to 0004
    run_migrations(engine, target="0004")
    status = get_migration_status(engine)
    assert status["current_revision"] == "0004"
    assert status["is_head"] is False

    # 2. Seed a company and brand into the 0004 schema
    with engine.connect() as conn:
        with conn.begin():
            conn.execute(
                text("INSERT INTO companies (name, slug, created_at, settings) VALUES ('Acme Corp', 'acme-corp', '2026-10-30 00:00:00', '{}')")
            )
            co_id = conn.execute(text("SELECT id FROM companies WHERE slug = 'acme-corp'")).scalar()
            conn.execute(
                text(f"INSERT INTO brands (name, company_id, description, protected_terms, competitors) VALUES ('Acme Flow', {co_id}, 'Acme brand', '[]', '[]')")
            )

    # 3. Apply migration 0005 (analysis_jobs and workspace_usage)
    applied = run_migrations(engine, target="head")
    assert "0005" in applied
    status_head = get_migration_status(engine)
    assert status_head["current_revision"] == "0005"
    assert status_head["is_head"] is True

    # Verify seeded data survived migration 0005
    with engine.connect() as conn:
        saved_co = conn.execute(text("SELECT name FROM companies WHERE slug = 'acme-corp'")).scalar()
        assert saved_co == "Acme Corp"
        # Verify new table exists
        inspector = inspect(conn)
        tables = set(inspector.get_table_names())
        assert "analysis_jobs" in tables
        assert "workspace_usage" in tables

    # 4. Rollback migration 0005
    rolled_back = rollback_migration(engine)
    assert rolled_back == "0005"
    status_after_rollback = get_migration_status(engine)
    assert status_after_rollback["current_revision"] == "0004"

    with engine.connect() as conn:
        inspector = inspect(conn)
        tables = set(inspector.get_table_names())
        assert "analysis_jobs" not in tables
        # Seeded data remains intact after rollback
        saved_co = conn.execute(text("SELECT name FROM companies WHERE slug = 'acme-corp'")).scalar()
        assert saved_co == "Acme Corp"


def test_production_mode_refuses_create_all(monkeypatch):
    """In production mode, Base.metadata.create_all must be strictly forbidden."""
    settings = get_settings()
    monkeypatch.setattr(settings, "app_mode", "production")

    engine = create_engine("sqlite:///:memory:")
    with pytest.raises(RuntimeError, match="create_all is strictly forbidden in production mode"):
        Base.metadata.create_all(engine)


def test_production_mode_requires_postgres(monkeypatch):
    """Production mode refuses to start with SQLite, enforcing PostgreSQL."""
    prod_sqlite = Settings(
        app_mode="production",
        secret_key="prod-secret-" + "x" * 25,
        demo_password="",
        seed_on_startup=False,
        database_url="sqlite:///brandlint.db",
    )
    with pytest.raises(RuntimeError, match="DATABASE_URL must configure a PostgreSQL database"):
        prod_sqlite.validate_production_readiness()

    prod_pg = Settings(
        app_mode="production",
        secret_key="prod-secret-" + "x" * 25,
        demo_password="",
        seed_on_startup=False,
        database_url="postgresql+psycopg://user:pass@localhost:5432/brandlint",
    )
    prod_pg.validate_production_readiness()


# -----------------------------------------------------------------------------
# 2. Durable Analysis Jobs, Idempotency & Bounded Retries
# -----------------------------------------------------------------------------

def test_idempotent_duplicate_requests(api):
    """Duplicate requests with the same Idempotency-Key safely return the same job/result."""
    # Create draft
    draft_res = api.call(
        "casey",
        "POST",
        "/drafts",
        json={"title": "Idempotent Check Draft", "channel": "Blog", "text": "Lumina Flow accelerates response times by 30%."},
    )
    assert draft_res.status_code == 200
    draft = draft_res.json()
    draft_id = draft["id"]

    idempotency_key = f"idemp_{uuid.uuid4().hex}"
    auth_headers = api.login("casey")

    # First check with idempotency key
    res1 = api.c.post(
        f"/api/brands/{api.brand_id}/drafts/{draft_id}/check",
        headers={**auth_headers, "Idempotency-Key": idempotency_key},
    )
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["status"] in ("checked", "in_review", "draft")

    # Second check with identical idempotency key
    res2 = api.c.post(
        f"/api/brands/{api.brand_id}/drafts/{draft_id}/check",
        headers={**auth_headers, "Idempotency-Key": idempotency_key},
    )
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["id"] == draft_id
    assert data2["revision"] == data1["revision"]

    # Verify only one completed job was recorded for this idempotency key
    with SessionLocal() as db:
        jobs = list(db.scalars(select(AnalysisJob).where(AnalysisJob.idempotency_key == idempotency_key)))
        assert len(jobs) == 1
        assert jobs[0].status == "completed"
        assert jobs[0].progress_pct == 100


def test_job_bounded_retries_and_failure(monkeypatch):
    """Jobs retry bounded times on transient failure and transition to failed on exhaustion."""
    with SessionLocal() as db:
        user = db.scalar(select(User))
        brand = db.scalar(select(Brand))
        draft = db.scalar(select(Draft).where(Draft.brand_id == brand.id))
        rev = db.scalar(select(DraftRevision).where(DraftRevision.draft_id == draft.id))

        job, _ = create_or_get_job(db, brand.id, draft.id, rev.id, user, idempotency_key=f"fail_{uuid.uuid4().hex}")
        job.max_retries = 2
        db.commit()

        # Mock run_analysis to fail
        def failing_analysis(*args, **kwargs):
            raise ConnectionError("Simulated LLM upstream timeout")

        import app.analysis.pipeline as pipeline_mod
        monkeypatch.setattr(pipeline_mod, "run_analysis", failing_analysis)

        with pytest.raises(ConnectionError):
            run_job_execution(db, job)

        db.refresh(job)
        assert job.status == "failed"
        assert job.retry_count == 2  # Retried twice
        assert job.error_code == "ConnectionError"
        assert "Simulated LLM upstream timeout" in job.error_message


def test_job_cancellation():
    """Pending/running jobs can be cancelled via API, preventing execution."""
    with SessionLocal() as db:
        user = db.scalar(select(User))
        brand = db.scalar(select(Brand))
        draft = db.scalar(select(Draft).where(Draft.brand_id == brand.id))
        rev = db.scalar(select(DraftRevision).where(DraftRevision.draft_id == draft.id))

        job, _ = create_or_get_job(db, brand.id, draft.id, rev.id, user, idempotency_key=f"cancel_{uuid.uuid4().hex}")
        db.commit()

        # Cancel job
        cancelled = cancel_job(db, brand.id, job.job_id)
        assert cancelled.status == "cancelled"
        assert cancelled.cancelled_at is not None

        # Running execution on a cancelled job aborts early
        res = run_job_execution(db, job)
        assert res is None


# -----------------------------------------------------------------------------
# 3. Stale Result Prevention
# -----------------------------------------------------------------------------

def test_stale_result_prevented_when_draft_edited_concurrently():
    """If draft is edited while job was running on an earlier revision, stale results do not overwrite."""
    with SessionLocal() as db:
        user = db.scalar(select(User))
        brand = db.scalar(select(Brand))
        draft = Draft(brand_id=brand.id, author_id=user.id, title="Concurrent Edit Draft", channel="Blog", status="draft")
        db.add(draft)
        db.flush()

        from app.service import create_revision
        rev1 = create_revision(db, draft, user, "Initial text for rev 1", "", "", "", "Initial")
        db.commit()

        # Job created for rev 1
        job, _ = create_or_get_job(db, brand.id, draft.id, rev1.id, user)
        db.commit()

        # Concurrently, author creates rev 2
        rev2 = create_revision(db, draft, user, "Updated text for rev 2", "", "", "", "Author edit")
        db.commit()

        # Now job finishes for rev 1
        run_job_execution(db, job)
        db.refresh(job)
        db.refresh(draft)

        # Job completed but detected stale revision
        assert job.status == "completed"
        assert job.stale_result_prevented is True
        # Draft is still at rev 2 and not overwritten by rev 1
        assert draft.current_revision_id == rev2.id


# -----------------------------------------------------------------------------
# 4. Workspace Usage Limits & Accounting
# -----------------------------------------------------------------------------

def test_workspace_usage_limits_enforced(api):
    """Enforces workspace monthly quotas, rejecting excess operations with 429."""
    with SessionLocal() as db:
        company = db.scalar(select(Company))
        company_id = company.id
        # Set limit artificially low
        company.settings = {"limits": {"max_monthly_drafts": 2}}
        db.commit()

    # Draft 1: ok
    r1 = api.call("olivia", "POST", "/drafts", json={"title": "Draft 1", "text": "Draft text 1"})
    assert r1.status_code == 200

    # Draft 2: ok
    r2 = api.call("olivia", "POST", "/drafts", json={"title": "Draft 2", "text": "Draft text 2"})
    assert r2.status_code == 200

    # Draft 3: must be rejected with 429
    r3 = api.call("olivia", "POST", "/drafts", json={"title": "Draft 3", "text": "Draft text 3"})
    assert r3.status_code == 429
    err = r3.json()["detail"]
    assert err["code"] == "workspace_draft_limit_exceeded"
    assert "Monthly workspace draft limit reached" in err["message"]

    # Verify usage summary endpoint
    r_usage = api.call("olivia", "GET", "/usage")
    assert r_usage.status_code == 200
    usage = r_usage.json()
    assert usage["drafts"]["used"] >= 2
    assert usage["drafts"]["limit"] == 2
    assert usage["drafts"]["pct"] >= 100.0


# -----------------------------------------------------------------------------
# 5. Readiness, Liveness, Telemetry & Security Headers
# -----------------------------------------------------------------------------

def test_healthz_and_readyz_probes(api):
    """Verifies liveness and readiness probe responses."""
    live_res = api.c.get("/healthz")
    assert live_res.status_code == 200
    live = live_res.json()
    assert live["status"] == "live"
    assert "uptime_seconds" in live

    ready_res = api.c.get("/readyz")
    assert ready_res.status_code == 200
    ready = ready_res.json()
    assert ready["status"] == "ready"
    assert ready["components"]["database"]["status"] == "ok"
    assert ready["components"]["storage"]["status"] == "ok"


def test_metrics_and_request_id_telemetry(api):
    """Requests return X-Request-ID and update measured latency metrics."""
    res = api.c.get("/api/health")
    assert res.status_code == 200
    assert "X-Request-ID" in res.headers
    assert res.headers["X-Request-ID"].startswith("req_")

    metrics_res = api.c.get("/metrics")
    assert metrics_res.status_code == 200
    metrics = metrics_res.json()
    assert metrics["requests"]["total"] > 0
    assert "latency_ms" in metrics
    assert "p95" in metrics["latency_ms"]


def test_browser_security_headers_and_csp(api):
    """Enforces strict security headers while allowing CDN scripts required by Loader.tsx."""
    res = api.c.get("/api/health")
    assert res.status_code == 200
    assert res.headers["X-Frame-Options"] == "DENY"
    assert res.headers["X-Content-Type-Options"] == "nosniff"
    assert res.headers["Referrer-Policy"] == "strict-origin-when-cross-origin"

    csp = res.headers.get("Content-Security-Policy", "")
    assert "cdnjs.cloudflare.com" in csp
    assert "cdn.jsdelivr.net" in csp
    assert "unsafe-eval" in csp
    assert "frame-ancestors 'none'" in csp


def test_operator_alerts_never_contain_secrets():
    """Operator alerts contain actionable context without recording draft text or secrets."""
    record_operator_alert(
        alert_type="TEST_ALERT",
        severity="WARNING",
        message="Simulated component test alert",
        action="Verify upstream connection.",
        context={"tenant_id": 1, "status": "degraded"},
    )
    alerts = registry.get_alerts()
    assert len(alerts) > 0
    latest = alerts[0]
    assert latest["type"] == "TEST_ALERT"
    # Ensure sensitive fields are absent
    for alert in alerts:
        assert "password" not in alert["message"].lower()
        assert "secret" not in alert["message"].lower()


# -----------------------------------------------------------------------------
# 6. Database Backup & Restore into Separate Database
# -----------------------------------------------------------------------------

def test_database_backup_and_restore_cycle(tmp_path):
    """Executes a real backup and restore into a separate test database, verifying data integrity."""
    backup_file = str(tmp_path / "test_backup.db")
    restored_db_file = str(tmp_path / "test_restored.db")
    restored_url = f"sqlite:///{restored_db_file}"

    settings = get_settings()

    # 1. Take backup of active DB
    backup_database(settings.database_url, backup_file)
    assert os.path.exists(backup_file)
    assert os.path.getsize(backup_file) > 0

    # 2. Restore into a new isolated database
    restore_database(backup_file, restored_url)
    assert os.path.exists(restored_db_file)

    # 3. Verify restored tables match
    res = verify_database(restored_url)
    assert len(res["tables"]) >= 26
    assert "users" in res["tables"]
    assert "companies" in res["tables"]
    assert "brands" in res["tables"]
    assert "schema_migrations" in res["tables"]
    assert res["counts"]["users"] > 0
