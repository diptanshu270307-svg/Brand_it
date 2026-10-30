"""Durable, tenant-scoped analysis jobs.

Provides bounded retries with exponential backoff, idempotency deduplication,
real progress/status reporting, job cancellation, and stale result prevention.
"""
import asyncio
import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import get_settings
from .models import Analysis, AnalysisJob, Brand, Draft, DraftRevision, User
from .service import audit, current_revision, findings_of
from .usage import check_workspace_limits, record_workspace_usage

log = logging.getLogger("brandlint.jobs")


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def create_or_get_job(
    db: Session,
    brand_id: int,
    draft_id: int,
    revision_id: int,
    user: User | None,
    idempotency_key: str | None = None,
) -> tuple[AnalysisJob, bool]:
    """
    Creates an analysis job or returns an existing job if duplicate request or active job exists.
    Returns: (job, created_new: bool)
    """
    brand = db.get(Brand, brand_id)
    company_id = brand.company_id if brand else None

    # 1. Check idempotency key if provided
    if idempotency_key:
        clean_key = idempotency_key.strip()
        existing = db.scalar(
            select(AnalysisJob).where(
                AnalysisJob.brand_id == brand_id,
                AnalysisJob.idempotency_key == clean_key,
            ).order_by(AnalysisJob.id.desc())
        )
        if existing:
            log.info("Idempotent duplicate request deduplicated: job %s (status: %s)", existing.job_id, existing.status)
            return existing, False

    # 2. Check for active (pending or running) job on same draft revision
    active = db.scalar(
        select(AnalysisJob).where(
            AnalysisJob.brand_id == brand_id,
            AnalysisJob.draft_id == draft_id,
            AnalysisJob.revision_id == revision_id,
            AnalysisJob.status.in_(("pending", "running")),
        ).order_by(AnalysisJob.id.desc())
    )
    if active:
        log.info("Attaching to in-flight analysis job %s for draft %s revision %s", active.job_id, draft_id, revision_id)
        return active, False

    # 3. Check workspace usage limits before creating new job
    check_workspace_limits(db, company_id, "check")

    settings = get_settings()
    job = AnalysisJob(
        job_id=f"job_{uuid.uuid4().hex[:24]}",
        brand_id=brand_id,
        company_id=company_id,
        draft_id=draft_id,
        revision_id=revision_id,
        user_id=user.id if user else None,
        status="pending",
        stage="queued",
        progress_pct=0,
        idempotency_key=idempotency_key.strip() if idempotency_key else None,
        retry_count=0,
        max_retries=settings.job_max_retries,
        created_at=utcnow(),
    )
    db.add(job)
    db.flush()
    return job, True


def run_job_execution(db: Session, job: AnalysisJob, triggered_by: str = "manual") -> Analysis:
    """
    Executes the analysis pipeline for the job with bounded retries, real progress updates,
    cancellation checks, and stale result prevention.
    """
    from .analysis.pipeline import run_analysis
    from .observability import record_operator_alert

    settings = get_settings()
    draft = db.get(Draft, job.draft_id)
    if not draft:
        job.status = "failed"
        job.error_message = "Draft not found"
        job.error_code = "draft_not_found"
        job.completed_at = utcnow()
        db.commit()
        raise HTTPException(404, "Draft not found")

    revision = db.get(DraftRevision, job.revision_id)
    if not revision:
        job.status = "failed"
        job.error_message = "Revision not found"
        job.error_code = "revision_not_found"
        job.completed_at = utcnow()
        db.commit()
        raise HTTPException(404, "Draft revision not found")

    db.refresh(job)
    if job.status == "cancelled":
        log.info("Analysis job %s was cancelled before execution started.", job.job_id)
        return None

    job.status = "running"
    job.started_at = utcnow()
    job.stage = "fetching_rules"
    job.progress_pct = 15
    db.commit()

    retry_count = 0
    while True:
        # Check cancellation
        db.refresh(job)
        if job.status == "cancelled":
            log.info("Analysis job %s was cancelled before execution completed.", job.job_id)
            return None

        try:
            job.stage = "verifying_terminology"
            job.progress_pct = 35
            db.commit()

            # Execute pipeline
            job.stage = "verifying_evidence"
            job.progress_pct = 70
            db.commit()

            analysis = run_analysis(db, draft, revision, triggered_by=triggered_by)

            job.stage = "saving_results"
            job.progress_pct = 90
            db.commit()

            # Refresh draft state to check for race conditions
            db.refresh(draft)
            current_rev = current_revision(db, draft)

            # Prevent stale results from overwriting current revision
            if current_rev.id != revision.id:
                job.stale_result_prevented = True
                log.warning(
                    "Stale result prevented: Job %s checked revision %s, but draft %s is now at revision %s.",
                    job.job_id,
                    revision.number,
                    draft.id,
                    current_rev.number,
                )
            else:
                if triggered_by not in ("post_denial", "pre_approval", "recheck_recall") and draft.status in (
                    "draft", "checked", "changes_requested"
                ):
                    draft.status = "checked"
                draft.updated_at = utcnow()

            # Record workspace check usage
            brand = db.get(Brand, draft.brand_id)
            record_workspace_usage(db, brand.company_id if brand else None, "check", 1)

            fs = findings_of(db, analysis)
            counts = {}
            for f in fs:
                counts[f.severity] = counts.get(f.severity, 0) + 1

            audit(
                db,
                draft.brand_id,
                job.user_id,
                "analysis_job_completed",
                draft.id,
                {
                    "job_id": job.job_id,
                    "analysis_id": analysis.id,
                    "revision": revision.number,
                    "findings_count": len(fs),
                    "by_severity": counts,
                    "stale_prevented": job.stale_result_prevented,
                    "retries": job.retry_count,
                },
            )

            job.status = "completed"
            job.stage = "completed"
            job.progress_pct = 100
            job.analysis_id = analysis.id
            job.completed_at = utcnow()
            db.commit()
            return analysis

        except Exception as exc:
            if retry_count < job.max_retries:
                retry_count += 1
                job.retry_count = retry_count
                db.commit()
                log.warning(
                    "Analysis job %s retry %s/%s failed: %s: %s",
                    job.job_id,
                    retry_count,
                    job.max_retries,
                    type(exc).__name__,
                    exc,
                )
                backoff = settings.job_retry_backoff_seconds * (2 ** (retry_count - 1))
                time.sleep(backoff)
            else:
                job.retry_count = retry_count
                job.status = "failed"
                job.stage = "failed"
                job.error_message = str(exc) or "Analysis pipeline failure"
                job.error_code = type(exc).__name__
                job.completed_at = utcnow()

                # Actionable operator alert
                record_operator_alert(
                    alert_type="ANALYSIS_JOB_FAILURE",
                    severity="ERROR",
                    message=f"Analysis job {job.job_id} failed after {job.max_retries} retries: {job.error_code}",
                    action="Check LLM provider availability and database connectivity.",
                    context={"job_id": job.job_id, "brand_id": job.brand_id, "draft_id": job.draft_id},
                )
                db.commit()
                raise


def cancel_job(db: Session, brand_id: int, job_id: str) -> AnalysisJob:
    job = db.scalar(
        select(AnalysisJob).where(
            AnalysisJob.brand_id == brand_id,
            AnalysisJob.job_id == job_id,
        )
    )
    if not job:
        raise HTTPException(404, "Analysis job not found")

    if job.status in ("completed", "failed", "cancelled"):
        return job

    job.status = "cancelled"
    job.stage = "cancelled"
    job.cancelled_at = utcnow()
    db.commit()
    log.info("Analysis job %s marked as cancelled.", job_id)
    return job
