"""Session & token retention cleanup worker and utilities for BrandLint.

Purges revoked or expired sessions and consumed password reset tokens
older than the configured retention threshold (default 30 days), preventing
unbounded growth of authentication tables.
"""
import asyncio
import logging
from datetime import timedelta
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from .config import get_settings
from .db import SessionLocal
from .models import AuthSession, PasswordResetToken, RateLimitEvent, utcnow

log = logging.getLogger("brandlint.cleanup")


def purge_stale_auth_records(db: Session, older_than_days: int = 30) -> dict[str, int]:
    """
    Purge expired/revoked sessions, consumed reset tokens, and old rate limit events.
    Returns counts of deleted records.
    """
    now = utcnow()
    cutoff = now - timedelta(days=older_than_days)
    rl_cutoff = now - timedelta(hours=2)  # Rate limit window is 15 minutes; 2 hours is safe to prune

    # 1. Purge AuthSession records that were revoked or expired past the retention window
    sess_stmt = delete(AuthSession).where(
        (AuthSession.revoked_at.is_not(None) & (AuthSession.revoked_at < cutoff))
        | (AuthSession.expires_at < cutoff)
    )
    sess_res = db.execute(sess_stmt)
    purged_sessions = sess_res.rowcount or 0

    # 2. Purge PasswordResetToken records that were used or expired past the retention window
    token_stmt = delete(PasswordResetToken).where(
        (PasswordResetToken.used_at.is_not(None) & (PasswordResetToken.used_at < cutoff))
        | (PasswordResetToken.expires_at < cutoff)
    )
    token_res = db.execute(token_stmt)
    purged_tokens = token_res.rowcount or 0

    # 3. Purge RateLimitEvent records older than 2 hours
    rl_stmt = delete(RateLimitEvent).where(RateLimitEvent.created_at < rl_cutoff)
    rl_res = db.execute(rl_stmt)
    purged_rate_limits = rl_res.rowcount or 0

    db.commit()

    log.info(
        "Purged stale auth records (retention %dd): %d sessions, %d reset tokens, %d rate limit events",
        older_than_days,
        purged_sessions,
        purged_tokens,
        purged_rate_limits,
    )
    return {
        "purged_sessions": purged_sessions,
        "purged_reset_tokens": purged_tokens,
        "purged_rate_limit_events": purged_rate_limits,
    }


async def start_periodic_cleanup_loop(interval_seconds: int = 21600) -> None:
    """Background daemon task running inside FastAPI lifespan."""
    log.info("Starting background session cleanup daemon (interval %ds)", interval_seconds)
    while True:
        try:
            await asyncio.sleep(interval_seconds)
            settings = get_settings()
            if settings.session_cleanup_enabled:
                with SessionLocal() as db:
                    purge_stale_auth_records(db, older_than_days=settings.session_retention_days)
        except asyncio.CancelledError:
            log.info("Session cleanup daemon cancelled.")
            break
        except Exception as exc:
            log.error("Session cleanup daemon encountered error: %s", exc)
