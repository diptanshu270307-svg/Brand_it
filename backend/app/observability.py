"""Observability, structured telemetry, measured latency metrics, and operator alerts.

Maintains strict operational confidentiality: NEVER records draft text, passwords,
or cryptographic session tokens in logs, metrics, or operator alerts.
"""
from collections import deque
from datetime import datetime, timezone
import logging
import os
from pathlib import Path
import time
from typing import Any

from sqlalchemy import text

log = logging.getLogger("brandlint.ops")


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


START_TIME = time.time()


class MetricsRegistry:
    def __init__(self, max_samples: int = 2000):
        self.max_samples = max_samples
        self.total_requests = 0
        self.status_2xx = 0
        self.status_3xx = 0
        self.status_4xx = 0
        self.status_5xx = 0
        self.latencies_ms = deque(maxlen=max_samples)
        self.alerts = deque(maxlen=200)

    def record_request(self, method: str, path: str, status_code: int, duration_ms: float) -> None:
        self.total_requests += 1
        if 200 <= status_code < 300:
            self.status_2xx += 1
        elif 300 <= status_code < 400:
            self.status_3xx += 1
        elif 400 <= status_code < 500:
            self.status_4xx += 1
        else:
            self.status_5xx += 1

        self.latencies_ms.append(duration_ms)

        # Trigger operator alert if sudden burst of 5xx errors
        if status_code >= 500:
            self.record_alert(
                alert_type="HTTP_SERVER_ERROR",
                severity="ERROR",
                message=f"HTTP {status_code} occurred on {method} {path}",
                action="Inspect recent application exception trace and database status.",
                context={"method": method, "path": path, "status_code": status_code},
            )

    def record_alert(
        self,
        alert_type: str,
        severity: str,
        message: str,
        action: str,
        context: dict[str, Any] | None = None,
    ) -> None:
        alert = {
            "id": f"alt_{len(self.alerts) + 1}",
            "type": alert_type,
            "severity": severity,
            "message": message,
            "action": action,
            "context": context or {},
            "timestamp": utcnow().isoformat(),
        }
        self.alerts.append(alert)
        log.warning("[OPERATOR_ALERT] [%s] %s: %s (Action: %s)", severity, alert_type, message, action)

    def get_summary(self) -> dict[str, Any]:
        lats = sorted(self.latencies_ms)
        n = len(lats)
        p50 = round(lats[int(n * 0.50)], 2) if n else 0.0
        p95 = round(lats[int(n * 0.95)], 2) if n else 0.0
        p99 = round(lats[int(n * 0.99)], 2) if n else 0.0
        avg = round(sum(lats) / n, 2) if n else 0.0

        error_rate = round((self.status_5xx / self.total_requests) * 100, 2) if self.total_requests else 0.0

        return {
            "uptime_seconds": round(time.time() - START_TIME, 1),
            "requests": {
                "total": self.total_requests,
                "status_2xx": self.status_2xx,
                "status_3xx": self.status_3xx,
                "status_4xx": self.status_4xx,
                "status_5xx": self.status_5xx,
                "error_rate_pct": error_rate,
            },
            "latency_ms": {
                "sample_size": n,
                "avg": avg,
                "p50": p50,
                "p95": p95,
                "p99": p99,
            },
            "alerts_count": len(self.alerts),
        }

    def get_alerts(self, limit: int = 50) -> list[dict[str, Any]]:
        return list(reversed(self.alerts))[:limit]


registry = MetricsRegistry()


def record_operator_alert(alert_type: str, severity: str, message: str, action: str, context: dict | None = None) -> None:
    registry.record_alert(alert_type, severity, message, action, context)


def check_liveness() -> dict[str, Any]:
    return {
        "status": "live",
        "timestamp": utcnow().isoformat(),
        "uptime_seconds": round(time.time() - START_TIME, 1),
        "version": "0.1.0",
    }


def check_readiness(engine: Any, settings: Any) -> tuple[bool, dict[str, Any]]:
    checks = {}
    healthy = True

    # 1. Database connectivity
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        checks["database"] = {"status": "ok"}
    except Exception as e:
        healthy = False
        checks["database"] = {"status": "error", "message": f"Database unreachable: {type(e).__name__}"}

    # 2. Migration version state
    try:
        from .migrations.runner import get_migration_status
        m_status = get_migration_status(engine)
        if m_status["is_head"]:
            checks["migrations"] = {"status": "ok", "current_revision": m_status["current_revision"]}
        else:
            if settings.is_production:
                healthy = False
            checks["migrations"] = {
                "status": "pending",
                "current_revision": m_status["current_revision"],
                "total_applied": m_status["total_applied"],
                "total_available": m_status["total_available"],
            }
    except Exception as e:
        healthy = False
        checks["migrations"] = {"status": "error", "message": f"Migration check failed: {type(e).__name__}"}

    # 3. Document storage directory
    try:
        storage_dir = Path(settings.document_storage_dir)
        storage_dir.mkdir(parents=True, exist_ok=True)
        test_file = storage_dir / ".health_check_probe"
        test_file.write_text("ok")
        test_file.unlink(missing_ok=True)
        checks["storage"] = {"status": "ok", "path": str(storage_dir)}
    except Exception as e:
        healthy = False
        checks["storage"] = {"status": "error", "message": f"Storage volume error: {type(e).__name__}"}

    # 4. LLM provider state
    checks["provider"] = {
        "status": "ok",
        "provider": settings.llm_provider,
        "mode": "hosted" if settings.llm_provider in ("openai", "gemini") else "offline_verifier",
    }

    return healthy, {
        "status": "ready" if healthy else "not_ready",
        "timestamp": utcnow().isoformat(),
        "components": checks,
    }
