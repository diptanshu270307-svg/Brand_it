from pathlib import Path
import subprocess
import sys
from datetime import timedelta
from unittest.mock import MagicMock
import pytest
from sqlalchemy import select

from app.cleanup import purge_stale_auth_records
from app.config import Settings, get_settings
from app.db import SessionLocal, init_db
from app.models import AuthSession, PasswordResetToken, RateLimitEvent, User, utcnow
from app.security import hash_token
from app.seed import reset_and_seed
from app.throttling import DatabaseThrottler, InMemoryThrottler, RedisThrottler, reset_throttling


@pytest.fixture(autouse=True)
def clean_all():
    init_db()
    reset_throttling()
    yield
    reset_throttling()


# ------------------------------------------------------------------ 1. Database-Backed Clustered Throttling
def test_database_throttler_synchronizes_across_instances():
    """Simulates two distinct backend server replicas sharing the same database."""
    reset_and_seed()
    db = SessionLocal()
    try:
        # Replica A uses throttler_a
        throttler_a = DatabaseThrottler()
        # Replica B uses throttler_b
        throttler_b = DatabaseThrottler()

        key = "ip:198.51.100.77"
        limit = 3
        window = 300

        # Initial check: not throttled
        assert throttler_a.is_throttled(key, limit, window, db=db) is False
        assert throttler_b.is_throttled(key, limit, window, db=db) is False

        # Replica A records attempt 1
        throttler_a.record_attempt(key, window, db=db)
        db.commit()

        # Replica B records attempt 2
        throttler_b.record_attempt(key, window, db=db)
        db.commit()

        # Replica A records attempt 3 (reaches limit)
        throttler_a.record_attempt(key, window, db=db)
        db.commit()

        # Both Replica A and Replica B immediately see the client as throttled!
        assert throttler_a.is_throttled(key, limit, window, db=db) is True
        assert throttler_b.is_throttled(key, limit, window, db=db) is True

        # Replica A clears the failed attempts on successful login
        throttler_a.clear(key, db=db)
        db.commit()

        # Both replicas now see the client unblocked
        assert throttler_a.is_throttled(key, limit, window, db=db) is False
        assert throttler_b.is_throttled(key, limit, window, db=db) is False
    finally:
        db.close()


# ------------------------------------------------------------------ 2. Redis-Backed Distributed Throttling
def test_redis_throttler_pipeline_and_fallback(monkeypatch):
    throttler = RedisThrottler("redis://localhost:6379/0")

    # Mock Redis client
    mock_redis = MagicMock()
    mock_pipe = MagicMock()
    mock_redis.pipeline.return_value = mock_pipe

    # Simulate: zremrangebyscore, zcard = 5, expire
    mock_pipe.execute.return_value = [0, 5, True]
    monkeypatch.setattr(throttler, "_client", mock_redis)

    # 1. Check is_throttled
    is_throttled = throttler.is_throttled("email:alice@company.com", limit=5, window_seconds=900)
    assert is_throttled is True
    mock_pipe.zremrangebyscore.assert_called_once()
    mock_pipe.zcard.assert_called_once()

    # 2. Check record_attempt
    mock_pipe.reset_mock()
    throttler.record_attempt("email:alice@company.com", window_seconds=900)
    mock_pipe.zadd.assert_called_once()
    mock_pipe.execute.assert_called_once()

    # 3. Check clear
    throttler.clear("email:alice@company.com")
    mock_redis.delete.assert_called_with("brandlint:rate:email:alice@company.com")


def test_redis_throttler_falls_back_gracefully_when_redis_down():
    # Invalid redis host triggers fallback without raising an unhandled exception
    throttler = RedisThrottler("redis://invalid-unreachable-host:6379/9")
    key = "ip:10.0.0.1"

    # Fallback in-memory behavior works transparently
    assert throttler.is_throttled(key, limit=2, window_seconds=60) is False
    throttler.record_attempt(key, window_seconds=60)
    throttler.record_attempt(key, window_seconds=60)
    assert throttler.is_throttled(key, limit=2, window_seconds=60) is True


# ------------------------------------------------------------------ 3. Stale Session & Token Retention Cleanup
def test_purge_stale_auth_records_cleans_only_old_records():
    reset_and_seed()
    db = SessionLocal()
    try:
        user = db.scalar(select(User).where(User.email == "casey@lumina.demo"))
        assert user is not None
        now = utcnow()

        # 1. Create a stale session: revoked 35 days ago (should be purged)
        old_revoked = AuthSession(
            user_id=user.id,
            token_hash=hash_token("old-revoked-token"),
            created_at=now - timedelta(days=40),
            last_seen_at=now - timedelta(days=35),
            expires_at=now - timedelta(days=34),
            revoked_at=now - timedelta(days=35),
            revoked_reason="logout",
        )
        db.add(old_revoked)

        # 2. Create an expired session: expired 32 days ago without explicit logout (should be purged)
        old_expired = AuthSession(
            user_id=user.id,
            token_hash=hash_token("old-expired-token"),
            created_at=now - timedelta(days=33),
            last_seen_at=now - timedelta(days=32),
            expires_at=now - timedelta(days=32),
            revoked_at=None,
        )
        db.add(old_expired)

        # 3. Create a recent active session (should NOT be purged)
        active_sess = AuthSession(
            user_id=user.id,
            token_hash=hash_token("fresh-active-token"),
            created_at=now - timedelta(hours=1),
            last_seen_at=now,
            expires_at=now + timedelta(hours=11),
            revoked_at=None,
        )
        db.add(active_sess)

        # 4. Create an old consumed password reset token: used 35 days ago (should be purged)
        old_token = PasswordResetToken(
            user_id=user.id,
            token_hash=hash_token("old-reset-token"),
            created_at=now - timedelta(days=35),
            expires_at=now - timedelta(days=35, minutes=-30),
            used_at=now - timedelta(days=35),
        )
        db.add(old_token)

        # 5. Create a recent valid reset token (should NOT be purged)
        recent_token = PasswordResetToken(
            user_id=user.id,
            token_hash=hash_token("recent-reset-token"),
            created_at=now - timedelta(minutes=5),
            expires_at=now + timedelta(minutes=25),
            used_at=None,
        )
        db.add(recent_token)

        # 6. Add old rate limit event (> 2 hours old) and recent one
        old_rl = RateLimitEvent(key="ip:old", created_at=now - timedelta(hours=5))
        recent_rl = RateLimitEvent(key="ip:recent", created_at=now - timedelta(minutes=2))
        db.add(old_rl)
        db.add(recent_rl)
        db.commit()

        # Run purge with 30-day retention window
        stats = purge_stale_auth_records(db, older_than_days=30)

        assert stats["purged_sessions"] == 2
        assert stats["purged_reset_tokens"] == 1
        assert stats["purged_rate_limit_events"] == 1

        # Verify active session is still present
        remaining_sess = db.scalar(select(AuthSession).where(AuthSession.token_hash == hash_token("fresh-active-token")))
        assert remaining_sess is not None

        # Verify recent reset token is still present
        remaining_token = db.scalar(select(PasswordResetToken).where(PasswordResetToken.token_hash == hash_token("recent-reset-token")))
        assert remaining_token is not None

        # Verify recent rate limit event is still present
        remaining_rl = db.scalar(select(RateLimitEvent).where(RateLimitEvent.key == "ip:recent"))
        assert remaining_rl is not None
    finally:
        db.close()


def test_cleanup_sessions_cli_script():
    script_path = str(Path(__file__).resolve().parents[1] / "scripts" / "cleanup_sessions.py")
    res = subprocess.run([sys.executable, script_path, "--days", "30"], capture_output=True, text=True)
    assert res.returncode == 0
    assert "Purged" in res.stdout
    assert "Cleanup completed successfully" in res.stdout
