"""Pluggable rate throttling for BrandLint authentication and recovery endpoints.

Supports three backends:
1. `memory`: Local in-process sliding window (default in development and isolated demo).
2. `database`: Clustered rate limiting using the shared database `rate_limit_events` table
   (zero additional infrastructure required for multi-replica Kubernetes / Docker Swarm deployments).
3. `redis`: Distributed high-throughput Redis sorted set rate limiting when `REDIS_URL` is configured.
"""
import asyncio
from abc import ABC, abstractmethod
from contextlib import asynccontextmanager
from datetime import date, timedelta
import logging
import time
from fastapi import HTTPException
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from .config import get_settings
from .db import SessionLocal
from .models import RateLimitEvent, utcnow

log = logging.getLogger("brandlint.throttling")


class Throttler(ABC):
    @abstractmethod
    def is_throttled(self, key: str, limit: int, window_seconds: int, db: Session | None = None) -> bool:
        pass

    @abstractmethod
    def record_attempt(self, key: str, window_seconds: int, db: Session | None = None) -> None:
        pass

    @abstractmethod
    def clear(self, key: str, db: Session | None = None) -> None:
        pass

    @abstractmethod
    def reset_all(self) -> None:
        pass


class InMemoryThrottler(Throttler):
    """In-memory sliding window throttler."""

    def __init__(self):
        self._events: dict[str, list[float]] = {}

    def _clean(self, key: str, window_seconds: int, now: float) -> list[float]:
        cutoff = now - window_seconds
        records = [t for t in self._events.get(key, []) if t > cutoff]
        self._events[key] = records
        return records

    def is_throttled(self, key: str, limit: int, window_seconds: int, db: Session | None = None) -> bool:
        now = time.monotonic()
        active = self._clean(key, window_seconds, now)
        return len(active) >= limit

    def record_attempt(self, key: str, window_seconds: int, db: Session | None = None) -> None:
        now = time.monotonic()
        self._events.setdefault(key, []).append(now)

    def clear(self, key: str, db: Session | None = None) -> None:
        self._events.pop(key, None)

    def reset_all(self) -> None:
        self._events.clear()


class DatabaseThrottler(Throttler):
    """Clustered rate limiting using shared SQL database table."""

    def _execute(self, callback, db: Session | None = None):
        if db is not None:
            return callback(db)
        with SessionLocal() as local_db:
            res = callback(local_db)
            local_db.commit()
            return res

    def is_throttled(self, key: str, limit: int, window_seconds: int, db: Session | None = None) -> bool:
        cutoff = utcnow() - timedelta(seconds=window_seconds)

        def _check(s: Session) -> bool:
            count = s.scalar(
                select(func.count(RateLimitEvent.id)).where(
                    RateLimitEvent.key == key,
                    RateLimitEvent.created_at > cutoff,
                )
            )
            return (count or 0) >= limit

        return self._execute(_check, db)

    def record_attempt(self, key: str, window_seconds: int, db: Session | None = None) -> None:
        def _add(s: Session) -> None:
            s.add(RateLimitEvent(key=key, created_at=utcnow()))
            if db is None:
                s.commit()

        self._execute(_add, db)

    def clear(self, key: str, db: Session | None = None) -> None:
        def _del(s: Session) -> None:
            s.execute(delete(RateLimitEvent).where(RateLimitEvent.key == key))
            if db is None:
                s.commit()

        self._execute(_del, db)

    def reset_all(self) -> None:
        try:
            with SessionLocal() as s:
                s.execute(delete(RateLimitEvent))
                s.commit()
        except Exception:
            pass


class RedisThrottler(Throttler):
    """High-throughput distributed rate limiting using Redis sorted sets."""

    def __init__(self, redis_url: str):
        self.redis_url = redis_url
        self._client = None
        self._fallback = InMemoryThrottler()

    @property
    def client(self):
        if self._client is None:
            try:
                import redis
                self._client = redis.from_url(self.redis_url, decode_responses=True, socket_timeout=2)
            except Exception as e:
                log.warning("Could not connect to Redis at %s (%s). Using in-memory fallback.", self.redis_url, e)
                return None
        return self._client

    def is_throttled(self, key: str, limit: int, window_seconds: int, db: Session | None = None) -> bool:
        r = self.client
        if r is None:
            return self._fallback.is_throttled(key, limit, window_seconds, db)

        redis_key = f"brandlint:rate:{key}"
        now = time.time()
        cutoff = now - window_seconds
        try:
            pipe = r.pipeline()
            pipe.zremrangebyscore(redis_key, "-inf", cutoff)
            pipe.zcard(redis_key)
            pipe.expire(redis_key, int(window_seconds) * 2)
            _, count, _ = pipe.execute()
            return count >= limit
        except Exception as e:
            log.warning("Redis rate limit check error: %s. Using fallback.", e)
            return self._fallback.is_throttled(key, limit, window_seconds, db)

    def record_attempt(self, key: str, window_seconds: int, db: Session | None = None) -> None:
        r = self.client
        if r is None:
            self._fallback.record_attempt(key, window_seconds, db)
            return

        redis_key = f"brandlint:rate:{key}"
        now = time.time()
        try:
            pipe = r.pipeline()
            pipe.zadd(redis_key, {f"{now}:{time.monotonic()}": now})
            pipe.expire(redis_key, int(window_seconds) * 2)
            pipe.execute()
        except Exception as e:
            log.warning("Redis record attempt error: %s. Using fallback.", e)
            self._fallback.record_attempt(key, window_seconds, db)

    def clear(self, key: str, db: Session | None = None) -> None:
        r = self.client
        if r is None:
            self._fallback.clear(key, db)
            return

        redis_key = f"brandlint:rate:{key}"
        try:
            r.delete(redis_key)
        except Exception as e:
            log.warning("Redis clear error: %s", e)
            self._fallback.clear(key, db)

    def reset_all(self) -> None:
        r = self.client
        if r is not None:
            try:
                for k in r.scan_iter("brandlint:rate:*"):
                    r.delete(k)
            except Exception:
                pass
        self._fallback.reset_all()


# Module-level singletons
_memory_throttler = InMemoryThrottler()
_db_throttler = DatabaseThrottler()
_redis_throttler: RedisThrottler | None = None
_override_throttler: Throttler | None = None


def set_throttler_override(throttler: Throttler | None) -> None:
    global _override_throttler
    _override_throttler = throttler


def get_throttler() -> Throttler:
    if _override_throttler is not None:
        return _override_throttler

    s = get_settings()
    backend = s.resolved_throttling_backend
    if backend == "redis" and s.redis_url.strip():
        global _redis_throttler
        if _redis_throttler is None or _redis_throttler.redis_url != s.redis_url:
            _redis_throttler = RedisThrottler(s.redis_url.strip())
        return _redis_throttler
    elif backend == "database":
        return _db_throttler
    return _memory_throttler


# ------------------------------------------------------------------ Convenience Functions
def is_login_throttled(client_ip: str, email: str, db: Session | None = None) -> bool:
    settings = get_settings()
    throttler = get_throttler()
    window = settings.auth_throttle_window_seconds

    # 1. Check IP limit
    if client_ip:
        if throttler.is_throttled(f"ip:{client_ip}", settings.auth_ip_max_failed_attempts, window, db):
            return True

    # 2. Check Email limit
    if email:
        if throttler.is_throttled(f"email:{email.strip().lower()}", settings.auth_max_failed_attempts, window, db):
            return True

    return False


def record_failed_login(client_ip: str, email: str, db: Session | None = None) -> None:
    settings = get_settings()
    throttler = get_throttler()
    window = settings.auth_throttle_window_seconds

    if client_ip:
        throttler.record_attempt(f"ip:{client_ip}", window, db)
    if email:
        throttler.record_attempt(f"email:{email.strip().lower()}", window, db)


def clear_failed_login(client_ip: str, email: str, db: Session | None = None) -> None:
    throttler = get_throttler()
    if email:
        throttler.clear(f"email:{email.strip().lower()}", db)


def is_recovery_throttled(client_ip: str, email: str, db: Session | None = None) -> bool:
    settings = get_settings()
    throttler = get_throttler()
    window = settings.auth_throttle_window_seconds

    if client_ip:
        if throttler.is_throttled(f"rec_ip:{client_ip}", settings.recovery_max_requests * 4, window, db):
            return True

    if email:
        if throttler.is_throttled(f"rec_email:{email.strip().lower()}", settings.recovery_max_requests, window, db):
            return True

    return False


def record_recovery_attempt(client_ip: str, email: str, db: Session | None = None) -> None:
    settings = get_settings()
    throttler = get_throttler()
    window = settings.auth_throttle_window_seconds

    if client_ip:
        throttler.record_attempt(f"rec_ip:{client_ip}", window, db)
    if email:
        throttler.record_attempt(f"rec_email:{email.strip().lower()}", window, db)


def reset_throttling() -> None:
    """Reset all throttlers (used in unit test setup/teardown)."""
    _memory_throttler.reset_all()
    _db_throttler.reset_all()
    if _redis_throttler is not None:
        _redis_throttler.reset_all()


def check_rate_limit(key: str, limit: int, window_seconds: int, error_msg: str, db: Session | None = None) -> None:
    throttler = get_throttler()
    if throttler.is_throttled(key, limit, window_seconds, db):
        raise HTTPException(
            status_code=429,
            detail=error_msg,
            headers={"Retry-After": str(window_seconds)},
        )
    throttler.record_attempt(key, window_seconds, db)


def check_ai_quota(company_id: int | None, user_id: int, db: Session | None = None) -> None:
    """Enforce per-user and per-company AI check quotas (tenant-independent)."""
    s = get_settings()
    user_key = f"quota:ai:user:{user_id}"
    check_rate_limit(
        user_key,
        s.ai_user_rate_limit_per_minute,
        60,
        "User AI request quota exceeded. Please wait a minute before requesting another check.",
        db,
    )

    if company_id:
        co_key = f"quota:ai:company:{company_id}"
        check_rate_limit(
            co_key,
            s.ai_company_rate_limit_per_minute,
            60,
            "Company AI request quota exceeded. Please wait a minute before requesting another check.",
            db,
        )

        daily_key = f"quota:ai:daily:{company_id}:{date.today().isoformat()}"
        check_rate_limit(
            daily_key,
            s.ai_company_daily_call_limit,
            86400,
            "Company daily AI usage quota reached.",
            db,
        )


def check_upload_quota(company_id: int | None, db: Session | None = None) -> None:
    """Enforce per-company document upload quota."""
    if not company_id:
        return
    s = get_settings()
    key = f"quota:upload:company:{company_id}"
    check_rate_limit(
        key,
        s.upload_company_rate_limit_per_minute,
        60,
        "Company document upload rate limit exceeded. Please wait a minute before uploading more documents.",
        db,
    )


def check_benchmark_quota(company_id: int | None, db: Session | None = None) -> None:
    """Enforce per-company benchmark execution quota."""
    if not company_id:
        return
    s = get_settings()
    key = f"quota:benchmark:company:{company_id}"
    check_rate_limit(
        key,
        s.benchmark_company_rate_limit_per_10min,
        600,
        "Benchmark execution limit exceeded. Maximum 3 benchmark runs per 10 minutes per company.",
        db,
    )


class AIConcurrencyLimiter:
    """Bounded concurrency semaphore for expensive AI analysis requests."""

    def __init__(self):
        self._sem: asyncio.Semaphore | None = None

    def _get_semaphore(self, max_concurrency: int) -> asyncio.Semaphore:
        if self._sem is None:
            self._sem = asyncio.Semaphore(max_concurrency)
        return self._sem

    @asynccontextmanager
    async def acquire(self, timeout: float = 10.0):
        s = get_settings()
        sem = self._get_semaphore(s.ai_max_concurrency)
        try:
            await asyncio.wait_for(sem.acquire(), timeout=timeout)
        except asyncio.TimeoutError:
            raise HTTPException(
                status_code=429,
                detail="AI processing capacity is currently saturated. Please try again shortly.",
                headers={"Retry-After": "5"},
            )
        try:
            yield
        finally:
            sem.release()


ai_concurrency_limiter = AIConcurrencyLimiter()
