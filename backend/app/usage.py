"""Workspace usage accounting and enforcement.

Enforces tenant-scoped monthly draft and check quotas, storage volume caps,
and team size limits while maintaining an auditable server-side usage ledger.
"""
from datetime import datetime, timezone
import logging
from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .config import get_settings
from .models import Company, CompanyMembership, Draft, SourceDocument, WorkspaceUsageRecord

log = logging.getLogger("brandlint.usage")


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def get_current_period() -> str:
    """Returns period string in format YYYY-MM."""
    return utcnow().strftime("%Y-%m")


def get_or_create_usage(db: Session, company_id: int, period: str | None = None) -> WorkspaceUsageRecord:
    p = period or get_current_period()
    rec = db.scalar(
        select(WorkspaceUsageRecord).where(
            WorkspaceUsageRecord.company_id == company_id,
            WorkspaceUsageRecord.period == p,
        )
    )
    if not rec:
        # Calculate existing baseline storage if available
        existing_storage = db.scalar(
            select(func.coalesce(func.sum(func.length(SourceDocument.title)), 0)).where(
                SourceDocument.brand_id.in_(
                    select(Company.id).where(Company.id == company_id)  # fallback
                )
            )
        ) or 0
        rec = WorkspaceUsageRecord(
            company_id=company_id,
            period=p,
            drafts_created=0,
            checks_run=0,
            storage_bytes=int(existing_storage),
            last_updated_at=utcnow(),
        )
        db.add(rec)
        db.flush()
    return rec


def check_workspace_limits(db: Session, company_id: int | None, action: str, delta: int = 1) -> None:
    """
    Validates workspace limits prior to mutating action.
    Raises HTTPException(429) if quota is exceeded.
    """
    if not company_id:
        return

    company = db.get(Company, company_id)
    if not company:
        return

    settings = get_settings()
    custom_limits = company.settings.get("limits", {}) if isinstance(company.settings, dict) else {}

    max_drafts = int(custom_limits.get("max_monthly_drafts", settings.workspace_max_monthly_drafts))
    max_checks = int(custom_limits.get("max_monthly_checks", settings.workspace_max_monthly_checks))
    max_storage = int(custom_limits.get("max_storage_bytes", settings.workspace_max_storage_bytes))
    max_members = int(custom_limits.get("max_members", settings.workspace_max_members))

    usage = get_or_create_usage(db, company_id)

    if action == "draft":
        if usage.drafts_created + delta > max_drafts:
            log.warning("Company %s hit monthly draft limit (%s / %s)", company_id, usage.drafts_created, max_drafts)
            raise HTTPException(
                status_code=429,
                detail={
                    "code": "workspace_draft_limit_exceeded",
                    "message": f"Monthly workspace draft limit reached ({max_drafts} drafts). Contact workspace administrator.",
                    "used": usage.drafts_created,
                    "limit": max_drafts,
                },
            )

    elif action == "check":
        if usage.checks_run + delta > max_checks:
            log.warning("Company %s hit monthly check limit (%s / %s)", company_id, usage.checks_run, max_checks)
            raise HTTPException(
                status_code=429,
                detail={
                    "code": "workspace_check_limit_exceeded",
                    "message": f"Monthly workspace analysis check limit reached ({max_checks} checks). Contact workspace administrator.",
                    "used": usage.checks_run,
                    "limit": max_checks,
                },
            )

    elif action == "storage":
        if usage.storage_bytes + delta > max_storage:
            log.warning("Company %s hit storage limit (%s / %s bytes)", company_id, usage.storage_bytes, max_storage)
            raise HTTPException(
                status_code=429,
                detail={
                    "code": "workspace_storage_limit_exceeded",
                    "message": f"Workspace storage capacity limit reached ({max_storage // (1024 * 1024)} MB).",
                    "used_bytes": usage.storage_bytes,
                    "limit_bytes": max_storage,
                },
            )

    elif action == "member":
        current_members = db.scalar(
            select(func.count(CompanyMembership.id)).where(CompanyMembership.company_id == company_id)
        ) or 0
        if current_members + delta > max_members:
            log.warning("Company %s hit member limit (%s / %s)", company_id, current_members, max_members)
            raise HTTPException(
                status_code=429,
                detail={
                    "code": "workspace_member_limit_exceeded",
                    "message": f"Workspace seat limit reached ({max_members} members).",
                    "used": current_members,
                    "limit": max_members,
                },
            )


def record_workspace_usage(db: Session, company_id: int | None, action: str, delta: int = 1) -> None:
    if not company_id:
        return
    usage = get_or_create_usage(db, company_id)
    if action == "draft":
        usage.drafts_created += delta
    elif action == "check":
        usage.checks_run += delta
    elif action == "storage":
        usage.storage_bytes += delta
    usage.last_updated_at = utcnow()
    db.flush()


def get_workspace_usage_summary(db: Session, company_id: int) -> dict:
    company = db.get(Company, company_id)
    if not company:
        raise HTTPException(404, "Company workspace not found")

    settings = get_settings()
    custom_limits = company.settings.get("limits", {}) if isinstance(company.settings, dict) else {}

    max_drafts = int(custom_limits.get("max_monthly_drafts", settings.workspace_max_monthly_drafts))
    max_checks = int(custom_limits.get("max_monthly_checks", settings.workspace_max_monthly_checks))
    max_storage = int(custom_limits.get("max_storage_bytes", settings.workspace_max_storage_bytes))
    max_members = int(custom_limits.get("max_members", settings.workspace_max_members))

    period = get_current_period()
    usage = get_or_create_usage(db, company_id, period)
    current_members = db.scalar(
        select(func.count(CompanyMembership.id)).where(CompanyMembership.company_id == company_id)
    ) or 0

    return {
        "company_id": company.id,
        "company_name": company.name,
        "period": period,
        "drafts": {
            "used": usage.drafts_created,
            "limit": max_drafts,
            "pct": round((usage.drafts_created / max_drafts) * 100, 1) if max_drafts > 0 else 0.0,
        },
        "checks": {
            "used": usage.checks_run,
            "limit": max_checks,
            "pct": round((usage.checks_run / max_checks) * 100, 1) if max_checks > 0 else 0.0,
        },
        "storage": {
            "used_bytes": usage.storage_bytes,
            "limit_bytes": max_storage,
            "used_mb": round(usage.storage_bytes / (1024 * 1024), 2),
            "limit_mb": round(max_storage / (1024 * 1024), 2),
            "pct": round((usage.storage_bytes / max_storage) * 100, 1) if max_storage > 0 else 0.0,
        },
        "members": {
            "used": current_members,
            "limit": max_members,
            "pct": round((current_members / max_members) * 100, 1) if max_members > 0 else 0.0,
        },
        "last_updated_at": usage.last_updated_at.isoformat(),
    }
