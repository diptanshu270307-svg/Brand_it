import hashlib
import hmac
import os
import secrets
import time
from datetime import datetime, timedelta, timezone
from typing import Literal

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError
from fastapi import Depends, HTTPException, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import get_settings
from .db import get_db
from .models import (
    AuditEvent,
    AuthSession,
    Brand,
    Company,
    CompanyInvitation,
    CompanyMembership,
    Membership,
    PasswordResetToken,
    User,
    utcnow,
)
from .throttling import (
    clear_failed_login,
    is_login_throttled,
    is_recovery_throttled,
    record_failed_login,
    record_recovery_attempt,
    reset_throttling,
    _memory_throttler,
)

# Backwards-compatible aliases for existing test inspection
_failed_logins = _memory_throttler._events
_recovery_requests = _memory_throttler._events

ROLES = ("creator", "reviewer", "senior_reviewer", "brand_owner")
REVIEW_ROLES = ("reviewer", "senior_reviewer", "brand_owner")

# Maintained Argon2id hasher (OWASP recommended parameters: memory 64MB, time cost >= 2)
_argon2_hasher = PasswordHasher(time_cost=2, memory_cost=65536, parallelism=1, hash_len=32)


def hash_password(password: str) -> str:
    """Hash password using Argon2id."""
    return _argon2_hasher.hash(password)


def verify_password(password: str, stored: str | None) -> tuple[bool, bool]:
    """
    Safely verify a password against stored hash.
    Returns (is_valid, needs_rehash).
    Malformed stored hashes return (False, False) without raising server errors.
    """
    if not stored or not isinstance(stored, str) or not password:
        return False, False

    # 1. Check if stored is an Argon2 hash
    if stored.startswith("$argon2"):
        try:
            _argon2_hasher.verify(stored, password)
            needs_rehash = _argon2_hasher.check_needs_rehash(stored)
            return True, needs_rehash
        except (VerifyMismatchError, VerificationError, InvalidHashError):
            return False, False
        except Exception:
            return False, False

    # 2. Check if stored is legacy PBKDF2 hash (salt_hex$digest_hex)
    if "$" in stored:
        try:
            parts = stored.split("$")
            if len(parts) != 2:
                return False, False
            salt_hex, digest_hex = parts
            salt = bytes.fromhex(salt_hex)
            cand = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 120_000).hex()
            if hmac.compare_digest(cand, digest_hex):
                # Valid legacy hash -> must upgrade to Argon2id on successful login
                return True, True
            return False, False
        except Exception:
            return False, False

    return False, False


# ------------------------------------------------------------------ Sessions & CSRF
def validate_password_policy(password: str) -> None:
    """Apply one configured password policy to signup and account recovery."""
    settings = get_settings()
    if len(password) < settings.password_min_length or len(password) > settings.password_max_length:
        raise HTTPException(
            422,
            f"Password must be between {settings.password_min_length} and {settings.password_max_length} characters.",
        )


def hash_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def generate_csrf_token(raw_session_token: str) -> str:
    s = get_settings()
    return hmac.new(s.secret_key.encode("utf-8"), raw_session_token.encode("utf-8"), hashlib.sha256).hexdigest()


def verify_csrf(raw_session_token: str, candidate_csrf: str) -> bool:
    if not raw_session_token or not candidate_csrf:
        return False
    expected = generate_csrf_token(raw_session_token)
    return hmac.compare_digest(expected, candidate_csrf)


def create_session(db: Session, user_id: int) -> tuple[AuthSession, str, str]:
    """Create a server-stored revocable session. Returns (session, raw_token, csrf_token)."""
    s = get_settings()
    raw_token = secrets.token_urlsafe(32)
    token_h = hash_token(raw_token)
    now = utcnow()
    expires_at = now + timedelta(hours=s.session_absolute_hours)

    sess = AuthSession(
        user_id=user_id,
        token_hash=token_h,
        created_at=now,
        last_seen_at=now,
        expires_at=expires_at,
    )
    db.add(sess)
    db.flush()

    csrf = generate_csrf_token(raw_token)
    return sess, raw_token, csrf


def revoke_session(db: Session, raw_token: str, reason: str = "logout") -> None:
    token_h = hash_token(raw_token)
    sess = db.scalar(select(AuthSession).where(AuthSession.token_hash == token_h, AuthSession.revoked_at.is_(None)))
    if sess:
        sess.revoked_at = utcnow()
        sess.revoked_reason = reason
        db.commit()


def revoke_all_user_sessions(db: Session, user_id: int, reason: str = "password_reset") -> None:
    sessions = db.scalars(select(AuthSession).where(AuthSession.user_id == user_id, AuthSession.revoked_at.is_(None)))
    now = utcnow()
    for s in sessions:
        s.revoked_at = now
        s.revoked_reason = reason
    db.commit()


def get_cookie_name() -> str:
    s = get_settings()
    # Keep the secure production default; Firebase Hosting requires the explicit __session override.
    return s.session_cookie_name or ("__Host-session" if s.is_production else "brandlint_session")


def get_session_cookie(request: Request) -> str | None:
    """Read only the configured cookie. Never revive an old development cookie in production."""
    return request.cookies.get(get_cookie_name())


def require_session_csrf(request: Request, raw_session_token: str) -> None:
    """Validate the header against this server session; no second cookie is required."""
    candidate = request.headers.get("x-csrf-token") or request.headers.get("x-xsrf-token")
    if not verify_csrf(raw_session_token, candidate or ""):
        raise HTTPException(403, "CSRF token missing or invalid")


def logout_request_sessions(request: Request, db: Session) -> None:
    """Revoke explicit bearer/browser sessions while keeping repeat logout idempotent.

    A browser cookie is ambient authority. Require its per-session CSRF token before
    revoking an active cookie session, unless the caller explicitly possesses that
    same session secret in Authorization. Expired/revoked/absent sessions can be
    cleared without granting any new authority.
    """
    cookie = get_session_cookie(request)
    header = request.headers.get("authorization", "")
    bearer = header[7:].strip() if header.lower().startswith("bearer ") else ""
    if cookie and not hmac.compare_digest(cookie, bearer):
        sess = db.scalar(select(AuthSession).where(AuthSession.token_hash == hash_token(cookie)))
        settings = get_settings()
        now = utcnow()
        active = (sess is not None and sess.revoked_at is None and now <= sess.expires_at
                  and now - sess.last_seen_at <= timedelta(minutes=settings.session_idle_minutes))
        if active:
            require_session_csrf(request, cookie)
    if cookie:
        revoke_session(db, cookie, reason="user_logout")
    if bearer and bearer != cookie:
        revoke_session(db, bearer, reason="user_logout")


def set_auth_cookies(response: Response, raw_session_token: str, csrf_token: str) -> None:
    s = get_settings()
    cookie_name = get_cookie_name()
    secure = s.is_production or s.dev_cookie_secure or cookie_name.startswith(("__Host-", "__Secure-"))
    max_age = s.session_absolute_hours * 3600

    # 1. HttpOnly Session Cookie (credentials never accessible to JavaScript)
    response.set_cookie(
        key=cookie_name,
        value=raw_session_token,
        max_age=max_age,
        httponly=True,
        secure=secure,
        samesite="lax",
        path="/",
    )
    # JSON login/session/me responses bootstrap the CSRF token in browser memory.
    # Retain the readable-cookie fallback off Firebase; Firebase drops all but __session.
    if cookie_name != "__session":
        response.set_cookie(
            key="brandlint_csrf",
            value=csrf_token,
            max_age=max_age,
            httponly=False,
            secure=secure,
            samesite="lax",
            path="/",
        )


def clear_auth_cookies(response: Response) -> None:
    cookie_name = get_cookie_name()
    s = get_settings()
    secure = s.is_production or s.dev_cookie_secure or cookie_name.startswith(("__Host-", "__Secure-"))
    response.delete_cookie(key=cookie_name, path="/", httponly=True, secure=secure, samesite="lax")
    response.delete_cookie(key="brandlint_csrf", path="/", httponly=False, secure=secure, samesite="lax")


# ------------------------------------------------------------------ Account Recovery
def create_recovery_token(db: Session, user_id: int) -> str:
    """Generate a single-use recovery token. Only its SHA-256 hash is persisted."""
    s = get_settings()
    raw = secrets.token_urlsafe(32)
    token_h = hash_token(raw)
    now = utcnow()
    expires = now + timedelta(minutes=s.recovery_token_ttl_minutes)

    rec = PasswordResetToken(user_id=user_id, token_hash=token_h, created_at=now, expires_at=expires)
    db.add(rec)
    db.commit()
    return raw


def consume_recovery_token(db: Session, raw_token: str) -> int | None:
    """Validate and atomically consume a single-use recovery token. Returns user_id or None."""
    if not raw_token or len(raw_token) < 16:
        return None
    token_h = hash_token(raw_token)
    now = utcnow()
    rec = db.scalar(
        select(PasswordResetToken).where(
            PasswordResetToken.token_hash == token_h,
            PasswordResetToken.used_at.is_(None),
            PasswordResetToken.expires_at > now,
        )
    )
    if not rec:
        return None
    rec.used_at = now
    db.commit()
    return rec.user_id


# ------------------------------------------------------------------ Auth Dependencies
def create_token(user: User) -> str:
    """Backwards-compatible JWT generator for API test clients."""
    s = get_settings()
    exp = datetime.now(timezone.utc) + timedelta(minutes=s.token_ttl_minutes)
    return jwt.encode({"sub": str(user.id), "exp": exp}, s.secret_key, algorithm="HS256")


def current_user(request: Request, db: Session = Depends(get_db)) -> User:
    """
    Authenticate user via:
    1. Bearer Authorization header (API clients, tests and CLI tooling - immune to browser CSRF)
    2. Server-stored session HttpOnly cookie (Browser sessions - requires CSRF token on mutating requests)
    """
    settings = get_settings()
    auth_header = request.headers.get("authorization", "")
    now = utcnow()

    # --- 1. Bearer Authorization Header Path (API / CLI / Tests) ---
    if auth_header.lower().startswith("bearer "):
        token_str = auth_header[7:].strip()
        # Check if it's a raw session token passed in Authorization header
        token_h = hash_token(token_str)
        sess = db.scalar(select(AuthSession).where(AuthSession.token_hash == token_h))
        if sess and sess.revoked_at is None and now <= sess.expires_at:
            idle_limit = timedelta(minutes=settings.session_idle_minutes)
            if (now - sess.last_seen_at) > idle_limit:
                sess.revoked_at = now
                sess.revoked_reason = "idle_expiry"
                db.commit()
                raise HTTPException(401, "Session expired due to inactivity")
            sess.last_seen_at = now
            db.commit()
            user = db.get(User, sess.user_id)
            if user:
                return user

        # Fallback to JWT token decoding (for existing test suites and API callers)
        try:
            payload = jwt.decode(token_str, settings.secret_key, algorithms=["HS256"])
            user = db.get(User, int(payload["sub"]))
            if user:
                return user
        except Exception:
            raise HTTPException(401, "Invalid or expired token")

    # --- 2. Session Cookie Path (Browser clients) ---
    session_cookie = get_session_cookie(request)
    if session_cookie:
        token_h = hash_token(session_cookie)
        sess = db.scalar(select(AuthSession).where(AuthSession.token_hash == token_h))
        if not sess or sess.revoked_at is not None:
            raise HTTPException(401, "Session invalid or revoked")

        # Absolute timeout check
        if now > sess.expires_at:
            sess.revoked_at = now
            sess.revoked_reason = "absolute_expiry"
            db.commit()
            raise HTTPException(401, "Session expired")

        # Idle timeout check
        idle_limit = timedelta(minutes=settings.session_idle_minutes)
        if (now - sess.last_seen_at) > idle_limit:
            sess.revoked_at = now
            sess.revoked_reason = "idle_expiry"
            db.commit()
            raise HTTPException(401, "Session expired due to inactivity")

        # CSRF Protection on unsafe HTTP methods when authenticated via cookie
        if request.method in ("POST", "PUT", "DELETE", "PATCH"):
            require_session_csrf(request, session_cookie)

        # Update activity timestamp
        sess.last_seen_at = now
        db.commit()

        user = db.get(User, sess.user_id)
        if not user:
            raise HTTPException(401, "Unknown user")
        return user

    raise HTTPException(401, "Not authenticated")


ROLE_DESCRIPTIONS = {
    "creator": {
        "role": "creator",
        "label": "Content Creator",
        "description": "Can draft, edit and test copy against brand guidelines and approved evidence. Cannot approve drafts or edit guidelines.",
        "permissions": [
            "Create and edit own content drafts",
            "Run automated brand and claim verification checks",
            "Accept or reject deterministic fix suggestions",
            "Submit checked drafts for reviewer approval",
        ],
    },
    "reviewer": {
        "role": "reviewer",
        "label": "Brand Reviewer",
        "description": "Can review standard-route drafts submitted by team members, request changes, add comments, and register supporting evidence.",
        "permissions": [
            "All Content Creator capabilities",
            "Review and approve standard-route drafts",
            "Request changes with explanatory feedback",
            "Register new evidence passports for review",
        ],
    },
    "senior_reviewer": {
        "role": "senior_reviewer",
        "label": "Senior Reviewer / Legal",
        "description": "Can review high-severity, sensitive, and compliance claims, and approve both standard and senior-route drafts.",
        "permissions": [
            "All Brand Reviewer capabilities",
            "Review and approve senior-route and sensitive claims",
            "Suggest clearer wording for underperforming guidelines",
        ],
    },
    "brand_owner": {
        "role": "brand_owner",
        "label": "Workspace Owner / Admin",
        "description": "Full administrative control over company settings, team invitations, member roles, guideline rules, and approved evidence.",
        "permissions": [
            "All Senior Reviewer capabilities",
            "Manage company settings and workspace configuration",
            "Invite new team members and assign roles",
            "Change member roles or revoke workspace access",
            "Approve or reject proposed brand rules and guideline changes",
            "Approve or reject submitted evidence passports",
        ],
    },
}


def membership_for(db: Session, user: User, brand_id: int) -> Membership:
    """
    Brand access check enforcing company tenant boundary.
    Verifies that the brand exists, that the brand belongs to a company,
    and that the authenticated user is an active member of that company.
    Non-members get 404 so brand and company existence is not leaked.
    """
    brand = db.get(Brand, brand_id)
    if not brand:
        raise HTTPException(404, "Brand not found")

    # If brand belongs to a company, enforce company tenant membership
    if brand.company_id:
        cm = db.scalar(
            select(CompanyMembership).where(
                CompanyMembership.user_id == user.id,
                CompanyMembership.company_id == brand.company_id,
            )
        )
        if not cm:
            raise HTTPException(404, "Brand not found")

        # Synchronize brand membership role with company membership role
        m = db.scalar(
            select(Membership).where(
                Membership.user_id == user.id,
                Membership.brand_id == brand_id,
            )
        )
        if not m:
            m = Membership(user_id=user.id, brand_id=brand_id, role=cm.role)
            db.add(m)
            db.commit()
        elif m.role != cm.role:
            m.role = cm.role
            db.commit()
        return m

    # Standalone brand fallback
    m = db.scalar(select(Membership).where(Membership.user_id == user.id, Membership.brand_id == brand_id))
    if not m:
        raise HTTPException(404, "Brand not found")
    return m


def company_membership_for(db: Session, user: User, company_id: int) -> CompanyMembership:
    """Company tenant access check. Non-members get 404 so company existence is not leaked."""
    cm = db.scalar(
        select(CompanyMembership).where(
            CompanyMembership.user_id == user.id,
            CompanyMembership.company_id == company_id,
        )
    )
    if not cm:
        raise HTTPException(404, "Company workspace not found")
    return cm


def require_company_role(cm: CompanyMembership, *roles: str) -> None:
    effective_roles = set(roles)
    if "brand_owner" in effective_roles or "owner" in effective_roles:
        effective_roles.add("brand_owner")
        effective_roles.add("owner")
    if cm.role not in effective_roles:
        raise HTTPException(403, f"Requires company role: {', '.join(roles)} (you have {cm.role})")


def require_role(m: Membership, *roles: str) -> None:
    if m.role not in roles:
        raise HTTPException(403, f"Requires role: {', '.join(roles)} (you are {m.role})")


def get_brand(db: Session, brand_id: int) -> Brand:
    b = db.get(Brand, brand_id)
    if not b:
        raise HTTPException(404, "Brand not found")
    return b


def audit(db: Session, brand_id: int, user_id: int | None, action: str, draft_id: int | None = None,
          details: dict | None = None, seeded: bool = False) -> AuditEvent:
    """Record an audit event. `details` must not contain draft text (ids/counts/hashes only)."""
    ev = AuditEvent(brand_id=brand_id, draft_id=draft_id, user_id=user_id, action=action,
                    details=details or {}, seeded=seeded)
    db.add(ev)
    return ev
