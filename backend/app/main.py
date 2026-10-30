import asyncio
import logging
import time
import urllib.parse
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

from .api import router
from .config import get_settings
from .db import engine, init_db
from .observability import check_liveness, check_readiness, registry

log = logging.getLogger("brandlint.http")


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    settings.validate_production_readiness()
    init_db()
    if (settings.is_demo or settings.is_development) and settings.seed_on_startup:
        from .seed import seed_if_empty

        seed_if_empty()

    cleanup_task = None
    if settings.session_cleanup_enabled:
        from .cleanup import start_periodic_cleanup_loop

        interval = settings.session_cleanup_interval_hours * 3600
        cleanup_task = asyncio.create_task(start_periodic_cleanup_loop(interval_seconds=interval))

    try:
        yield
    finally:
        if cleanup_task is not None:
            cleanup_task.cancel()


app = FastAPI(title="BrandLint API", version="0.1.0", lifespan=lifespan)

settings = get_settings()
trusted_hosts = settings.trusted_proxy_list if settings.trusted_proxies.strip() != "*" else "*"
app.add_middleware(ProxyHeadersMiddleware, trusted_hosts=trusted_hosts)

origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
origin_regex = r"^https?://(localhost|127\.0\.0\.1)(:[0-9]+)?$" if not settings.is_production else None
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    """Enforces strict browser security headers and CSP while preserving Loader.tsx 3D dependencies."""
    response = await call_next(request)
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), payment=()"
    if request.url.path == "/api" or request.url.path.startswith("/api/"):
        # Session/CSRF and tenant responses must never be shared by an edge cache.
        response.headers["Cache-Control"] = "private, no-store, max-age=0"
        vary = [value.strip() for value in response.headers.get("Vary", "").split(",") if value.strip()]
        if "cookie" not in [value.lower() for value in vary]:
            vary.append("Cookie")
        response.headers["Vary"] = ", ".join(vary)
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com data:; "
        "img-src 'self' data: blob:; "
        "connect-src 'self' ws: wss:; "
        "frame-ancestors 'none'; "
        "base-uri 'self'; "
        "form-action 'self';"
    )
    return response


@app.middleware("http")
async def request_id_and_access_log(request: Request, call_next):
    """Assigns unique request ID, measures duration, logs structured access events without confidential draft text."""
    start_time = time.time()
    request_id = request.headers.get("x-request-id") or f"req_{uuid.uuid4().hex[:16]}"
    request.state.request_id = request_id

    response = await call_next(request)
    duration_ms = round((time.time() - start_time) * 1000, 2)
    response.headers["X-Request-ID"] = request_id

    # Record metrics
    registry.record_request(request.method, request.url.path, response.status_code, duration_ms)

    # Structured operational access log (NO draft text, NO passwords, NO tokens)
    log.info(
        "[%s] %s %s -> %s (%.2fms)",
        request_id,
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
    )
    return response


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    request_id = getattr(request.state, "request_id", None) or request.headers.get("x-request-id") or "req_unknown"
    headers = dict(exc.headers or {})
    headers["X-Request-ID"] = request_id
    content = {"detail": exc.detail, "request_id": request_id}
    return JSONResponse(status_code=exc.status_code, content=content, headers=headers)


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    request_id = getattr(request.state, "request_id", None) or "req_unknown"
    log.error("[%s] Server error: %s: %s", request_id, type(exc).__name__, exc)
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal server error occurred.", "request_id": request_id},
        headers={"X-Request-ID": request_id},
    )


app.include_router(router)


@app.get("/healthz", tags=["Operations"])
def healthz():
    """Liveness probe indicating process is active."""
    return check_liveness()


@app.get("/api/health", tags=["Operations"])
def health():
    return {"status": "ok"}


@app.get("/readyz", tags=["Operations"])
def readyz():
    """Readiness probe verifying database, migrations, storage volume, and provider readiness."""
    healthy, details = check_readiness(engine, get_settings())
    return JSONResponse(status_code=200 if healthy else 503, content=details)


@app.get("/metrics", tags=["Operations"])
@app.get("/api/system/metrics", tags=["Operations"])
def metrics():
    """Measured latency distribution, request throughput, and error metrics."""
    return registry.get_summary()


@app.get("/api/system/alerts", tags=["Operations"])
def operator_alerts():
    """Actionable operator alerts without confidential draft text or secrets."""
    return registry.get_alerts()


# Serve the built React app from the same origin with strict traversal and symlink containment.
_dist = (Path(__file__).resolve().parents[2] / "frontend" / "dist").resolve()

ASSET_EXTENSIONS = (
    ".js", ".css", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico",
    ".woff", ".woff2", ".ttf", ".eot", ".json", ".map", ".txt", ".xml"
)


def _resolve_contained_path(raw_path: str) -> tuple[str, Path | None]:
    """
    Safely resolves raw_path against _dist.
    Returns:
      ("FILE", path)  -> Authorized file strictly inside _dist
      ("SPA", path)   -> SPA deep link, fallback to index.html
      ("DENIED", None)-> Traversal attempt, escaping symlink, or missing asset (404)
    """
    if not _dist.exists():
        return ("DENIED", None)

    # Defeat multiple URL encodings (e.g. %2e%2e or %252e%252e)
    decoded = raw_path or ""
    for _ in range(3):
        prev = decoded
        decoded = urllib.parse.unquote(decoded)
        if decoded == prev:
            break

    if "\x00" in decoded:
        return ("DENIED", None)

    clean = decoded.replace("\\", "/").lstrip("/")
    # Unknown API routes must remain JSON 404s rather than successful SPA pages.
    if clean == "api" or clean.startswith("api/"):
        return ("DENIED", None)
    if not clean:
        index_file = _dist / "index.html"
        return ("FILE", index_file) if index_file.is_file() else ("DENIED", None)

    try:
        candidate = (_dist / clean).resolve()
        candidate.relative_to(_dist)
    except (ValueError, RuntimeError):
        # Escapes the build directory via traversal or symlink
        return ("DENIED", None)

    if candidate.is_file():
        return ("FILE", candidate)

    # Missing static assets should 404 rather than return index.html
    if clean.startswith("assets/") or any(clean.lower().endswith(ext) for ext in ASSET_EXTENSIONS):
        return ("DENIED", None)

    # Route is a client-side SPA route (e.g. /review, /vault)
    index_file = _dist / "index.html"
    return ("SPA", index_file) if index_file.is_file() else ("DENIED", None)


if _dist.exists():
    @app.head("/{path:path}", include_in_schema=False)
    @app.get("/{path:path}", include_in_schema=False)
    def spa_or_static(path: str):
        status, target = _resolve_contained_path(path)
        if status in ("FILE", "SPA") and target is not None:
            return FileResponse(target)
        raise HTTPException(status_code=404, detail="Not found")
