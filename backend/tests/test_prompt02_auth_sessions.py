import hashlib
import hmac
import os
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.config import Settings, get_settings
from app.db import get_db, SessionLocal
from app.main import app
from app.mail import MailAdapter, MailMessage, set_mail_adapter_override
from app.models import AuthSession, PasswordResetToken, User, utcnow
from app.security import (
    clear_failed_login,
    hash_password,
    hash_token,
    verify_password,
    _failed_logins,
    _recovery_requests,
)
from app.seed import reset_and_seed


class MemoryMailAdapter(MailAdapter):
    """Test mail adapter capturing sent messages in memory."""

    def __init__(self):
        self.sent: list[MailMessage] = []

    def send(self, message: MailMessage) -> None:
        self.sent.append(message)


@pytest.fixture(autouse=True)
def clean_throttle_and_mail():
    _failed_logins.clear()
    _recovery_requests.clear()
    adapter = MemoryMailAdapter()
    set_mail_adapter_override(adapter)
    yield adapter
    set_mail_adapter_override(None)
    _failed_logins.clear()
    _recovery_requests.clear()


# ------------------------------------------------------------------ 1. Argon2id & Legacy Hash Upgrade
def test_argon2id_hashing_and_verification():
    raw = "correct-horse-battery-staple"
    hashed = hash_password(raw)

    assert hashed.startswith("$argon2id$")
    valid, needs_rehash = verify_password(raw, hashed)
    assert valid is True
    assert needs_rehash is False

    wrong_valid, _ = verify_password("wrong-password", hashed)
    assert wrong_valid is False


def test_legacy_pbkdf2_hash_upgrade_on_successful_login():
    reset_and_seed()
    db = SessionLocal()
    try:
        user = db.scalar(select(User).where(User.email == "casey@lumina.demo"))
        assert user is not None

        # Manually set legacy PBKDF2 hash (salt_hex$digest_hex)
        salt = os.urandom(16)
        legacy_digest = hashlib.pbkdf2_hmac("sha256", b"legacy-pass-123", salt, 120_000).hex()
        legacy_stored = f"{salt.hex()}${legacy_digest}"
        user.password_hash = legacy_stored
        db.commit()

        # verify_password should detect that rehash is required
        valid, needs_rehash = verify_password("legacy-pass-123", legacy_stored)
        assert valid is True
        assert needs_rehash is True

        # Now login via HTTP client
        with TestClient(app) as client:
            resp = client.post("/api/auth/login", json={"email": "casey@lumina.demo", "password": "legacy-pass-123"})
            assert resp.status_code == 200

        # Refresh user from DB: password hash MUST now be Argon2id
        db.refresh(user)
        assert user.password_hash.startswith("$argon2id$")

        # Subsequent login works with the upgraded Argon2id hash
        with TestClient(app) as client:
            resp2 = client.post("/api/auth/login", json={"email": "casey@lumina.demo", "password": "legacy-pass-123"})
            assert resp2.status_code == 200
    finally:
        db.close()


def test_corrupted_and_malformed_hashes_fail_safely():
    # Ensure malformed hashes never trigger unhandled 500 exceptions
    malformed_candidates = [
        None,
        "",
        "just-plain-text",
        "$argon2id$",
        "$argon2id$v=19$m=65536,t=2,p=1$truncated",
        "invalid_hex_salt$00112233",
        "salt_hex$invalid_digest",
        "too$many$parts$here$fail",
        "$" * 100,
        12345,  # wrong type
    ]

    for cand in malformed_candidates:
        valid, needs_rehash = verify_password("any-pass", cand)  # type: ignore
        assert valid is False
        assert needs_rehash is False

    # Also test via login endpoint with corrupted hash in DB
    reset_and_seed()
    db = SessionLocal()
    try:
        user = db.scalar(select(User).where(User.email == "casey@lumina.demo"))
        user.password_hash = "$argon2id$malformed_broken_hash_data"
        db.commit()

        with TestClient(app) as client:
            resp = client.post("/api/auth/login", json={"email": "casey@lumina.demo", "password": "demo1234"})
            assert resp.status_code == 401
            assert resp.json()["detail"] == "Invalid email or password"
    finally:
        db.close()


# ------------------------------------------------------------------ 2. Server-Stored Revocable Sessions
def test_server_stored_session_lifecycle():
    reset_and_seed()
    with TestClient(app) as client:
        # 1. Login sets HttpOnly session cookie
        login_resp = client.post("/api/auth/login", json={"email": "casey@lumina.demo", "password": "demo1234"})
        assert login_resp.status_code == 200
        data = login_resp.json()
        assert "token" in data
        assert "csrf_token" in data

        cookies = login_resp.cookies
        assert "brandlint_session" in cookies
        raw_token = cookies["brandlint_session"]

        # 2. Verify token is stored as SHA-256 hash in database, never plaintext
        db = SessionLocal()
        try:
            token_h = hash_token(raw_token)
            stored_sess = db.scalar(select(AuthSession).where(AuthSession.token_hash == token_h))
            assert stored_sess is not None
            assert stored_sess.revoked_at is None
            # Ensure plaintext token is not accidentally stored
            raw_in_db = db.scalar(select(AuthSession).where(AuthSession.token_hash == raw_token))
            assert raw_in_db is None
        finally:
            db.close()

        # 3. GET /api/auth/session succeeds with session cookie
        sess_resp = client.get("/api/auth/session")
        assert sess_resp.status_code == 200
        assert sess_resp.json()["authenticated"] is True
        assert sess_resp.json()["user"]["email"] == "casey@lumina.demo"

        # 4. Logout invalidates session in DB and clears cookie
        logout_resp = client.post("/api/auth/logout", headers={"X-CSRF-Token": data["csrf_token"]})
        assert logout_resp.status_code == 200

        # Check DB: session must be revoked
        db = SessionLocal()
        try:
            revoked_sess = db.scalar(select(AuthSession).where(AuthSession.token_hash == token_h))
            assert revoked_sess.revoked_at is not None
            assert revoked_sess.revoked_reason == "user_logout"
        finally:
            db.close()

        # 5. Subsequent request with previous cookie fails with 401
        client.cookies.set("brandlint_session", raw_token)
        after_logout_resp = client.get("/api/auth/session")
        assert after_logout_resp.status_code == 401
        assert "revoked" in after_logout_resp.text.lower()


# ------------------------------------------------------------------ 3. Idle & Absolute Timeouts
def test_session_idle_and_absolute_timeouts():
    reset_and_seed()
    with TestClient(app) as client:
        login_resp = client.post("/api/auth/login", json={"email": "casey@lumina.demo", "password": "demo1234"})
        assert login_resp.status_code == 200
        raw_token = login_resp.cookies["brandlint_session"]
        token_h = hash_token(raw_token)

        # 1. Simulate idle timeout: wind back last_seen_at by 31 minutes (> 30 min idle limit)
        db = SessionLocal()
        try:
            sess = db.scalar(select(AuthSession).where(AuthSession.token_hash == token_h))
            sess.last_seen_at = utcnow() - timedelta(minutes=31)
            db.commit()
        finally:
            db.close()

        idle_resp = client.get("/api/auth/session")
        assert idle_resp.status_code == 401
        assert "inactivity" in idle_resp.text.lower()

        # Session should now be marked revoked for idle_expiry in DB
        db = SessionLocal()
        try:
            sess = db.scalar(select(AuthSession).where(AuthSession.token_hash == token_h))
            assert sess.revoked_at is not None
            assert sess.revoked_reason == "idle_expiry"
        finally:
            db.close()

        # 2. Test absolute timeout: login anew and wind back created_at past 12 hours
        login2_resp = client.post("/api/auth/login", json={"email": "casey@lumina.demo", "password": "demo1234"})
        raw_token2 = login2_resp.cookies["brandlint_session"]
        token_h2 = hash_token(raw_token2)

        db = SessionLocal()
        try:
            sess2 = db.scalar(select(AuthSession).where(AuthSession.token_hash == token_h2))
            # Keep last_seen_at fresh, but created_at / expires_at expired
            sess2.last_seen_at = utcnow()
            sess2.expires_at = utcnow() - timedelta(seconds=10)
            db.commit()
        finally:
            db.close()

        abs_resp = client.get("/api/auth/session")
        assert abs_resp.status_code == 401
        assert "expired" in abs_resp.text.lower()


# ------------------------------------------------------------------ 4. CSRF Protection for Cookie Sessions
def test_csrf_protection_for_cookie_sessions():
    reset_and_seed()
    with TestClient(app) as client:
        # Sign in via cookie
        login_resp = client.post("/api/auth/login", json={"email": "casey@lumina.demo", "password": "demo1234"})
        assert login_resp.status_code == 200
        csrf_token = login_resp.json()["csrf_token"]

        # Safe GET requests do NOT require CSRF token
        get_resp = client.get("/api/brands/1/drafts")
        assert get_resp.status_code == 200

        # Unsafe mutating POST request WITHOUT CSRF token fails with 403
        post_no_csrf = client.post(
            "/api/brands/1/drafts",
            json={"title": "Unauthorized CSRF Draft", "text": "Body text here."},
        )
        assert post_no_csrf.status_code == 403
        assert "CSRF" in post_no_csrf.text

        # Unsafe mutating POST request with INVALID CSRF token fails with 403
        post_bad_csrf = client.post(
            "/api/brands/1/drafts",
            json={"title": "Forged CSRF Draft", "text": "Body text here."},
            headers={"X-CSRF-Token": "invalid-forged-csrf-token"},
        )
        assert post_bad_csrf.status_code == 403
        assert "CSRF" in post_bad_csrf.text

        # Unsafe mutating POST request with VALID CSRF token succeeds (200 / 201)
        post_ok = client.post(
            "/api/brands/1/drafts",
            json={"title": "Authorized Post Draft", "text": "Body text here."},
            headers={"X-CSRF-Token": csrf_token},
        )
        assert post_ok.status_code in (200, 201)


def test_bearer_token_requests_bypass_browser_csrf():
    reset_and_seed()
    with TestClient(app) as client:
        login_resp = client.post("/api/auth/login", json={"email": "casey@lumina.demo", "password": "demo1234"})
        token = login_resp.json()["token"]
        # Clear cookies to simulate pure API / curl caller
        client.cookies.clear()

        # Bearer header caller should NOT need X-CSRF-Token
        resp = client.post(
            "/api/brands/1/drafts",
            json={"title": "API Bearer Draft", "text": "Created via API client."},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code in (200, 201)


# ------------------------------------------------------------------ 5. Account Recovery Lifecycle & Invalidation
def test_account_recovery_and_token_invalidation(clean_throttle_and_mail):
    mail_adapter = clean_throttle_and_mail
    reset_and_seed()

    with TestClient(app) as client:
        # 1. Non-existent email returns generic message (no user enumeration)
        resp_nonexistent = client.post("/api/auth/forgot-password", json={"email": "nobody@nonexistent.demo"})
        assert resp_nonexistent.status_code == 200
        assert "If that email is registered" in resp_nonexistent.json()["message"]
        assert len(mail_adapter.sent) == 0

        # 2. Existing user forgot-password sends recovery link with URL fragment
        resp_existent = client.post("/api/auth/forgot-password", json={"email": "casey@lumina.demo"})
        assert resp_existent.status_code == 200
        assert "If that email is registered" in resp_existent.json()["message"]
        assert len(mail_adapter.sent) == 1

        sent_msg = mail_adapter.sent[0]
        assert sent_msg.to_email == "casey@lumina.demo"
        assert "#reset-token=" in sent_msg.text_body

        # Extract raw token from URL fragment
        url_frag = sent_msg.text_body.split("#reset-token=")[1].split()[0].strip()
        raw_token = url_frag

        # 3. Check DB: token is stored as SHA-256 hash, not plaintext
        db = SessionLocal()
        try:
            token_h = hash_token(raw_token)
            db_rec = db.scalar(select(PasswordResetToken).where(PasswordResetToken.token_hash == token_h))
            assert db_rec is not None
            assert db_rec.used_at is None
        finally:
            db.close()

        # 4. Sign in as Casey to have an active session before password reset
        login_pre = client.post("/api/auth/login", json={"email": "casey@lumina.demo", "password": "demo1234"})
        assert login_pre.status_code == 200
        pre_cookie = login_pre.cookies["brandlint_session"]

        # 5. Reset password with new password
        new_pass = "MyNewSecurePassword!2026"
        reset_resp = client.post("/api/auth/reset-password", json={"token": raw_token, "new_password": new_pass})
        assert reset_resp.status_code == 200
        assert "Password updated successfully" in reset_resp.json()["message"]

        # 6. Single-use: using the token a second time must fail
        reuse_resp = client.post("/api/auth/reset-password", json={"token": raw_token, "new_password": "another-password"})
        assert reuse_resp.status_code == 400
        assert "Invalid or expired" in reuse_resp.text

        # 7. Invalidation: previous session cookie must now be revoked
        client.cookies.set("brandlint_session", pre_cookie)
        sess_check = client.get("/api/auth/session")
        assert sess_check.status_code == 401

        # 8. Sign in with old password fails; sign in with new password succeeds
        fail_login = client.post("/api/auth/login", json={"email": "casey@lumina.demo", "password": "demo1234"})
        assert fail_login.status_code == 401

        ok_login = client.post("/api/auth/login", json={"email": "casey@lumina.demo", "password": new_pass})
        assert ok_login.status_code == 200
        assert ok_login.json()["user"]["email"] == "casey@lumina.demo"


# ------------------------------------------------------------------ 6. Throttling / Rate-Limiting
def test_failed_login_throttling():
    reset_and_seed()
    with TestClient(app) as client:
        # Max failed attempts is 5 in config
        for i in range(5):
            r = client.post("/api/auth/login", json={"email": "victim@lumina.demo", "password": f"wrong-{i}"})
            assert r.status_code == 401

        # 6th attempt should be throttled (429)
        throttled = client.post("/api/auth/login", json={"email": "victim@lumina.demo", "password": "wrong-again"})
        assert throttled.status_code == 429
        assert "Too many failed attempts" in throttled.text


def test_recovery_throttling():
    reset_and_seed()
    with TestClient(app) as client:
        # Max recovery requests is 3
        for i in range(3):
            r = client.post("/api/auth/forgot-password", json={"email": "casey@lumina.demo"})
            assert r.status_code == 200

        # 4th attempt should be throttled (429)
        throttled = client.post("/api/auth/forgot-password", json={"email": "casey@lumina.demo"})
        assert throttled.status_code == 429
        assert "Too many recovery attempts" in throttled.text


# ------------------------------------------------------------------ 7. Production Cookie Configuration
def test_production_mode_cookie_configuration(monkeypatch):
    prod_settings = Settings(
        app_mode="production",
        secret_key="production-test-key-" + "z" * 25,
        demo_password="",
        seed_on_startup=False,
        database_url=get_settings().database_url,
    )
    monkeypatch.setattr("app.config.get_settings", lambda: prod_settings)
    monkeypatch.setattr("app.api.get_settings", lambda: prod_settings)
    monkeypatch.setattr("app.security.get_settings", lambda: prod_settings)

    reset_and_seed()
    # Create real user for production testing (not ending in .demo)
    db = SessionLocal()
    try:
        prod_user = User(
            name="Prod User",
            email="employee@company.com",
            password_hash=hash_password("SuperSecretPass123!"),
        )
        db.add(prod_user)
        db.commit()
    finally:
        db.close()

    with TestClient(app) as client:
        resp = client.post(
            "/api/auth/login",
            json={"email": "employee@company.com", "password": "SuperSecretPass123!"},
        )
        assert resp.status_code == 200
        # In production, cookie name must use the __Host- prefix
        assert "__Host-session" in resp.cookies
        # Verify cookie header contains Secure and SameSite=lax
        cookie_header = resp.headers.get("set-cookie", "")
        assert "__Host-session=" in cookie_header
        assert "secure" in cookie_header.lower()
        assert "httponly" in cookie_header.lower()
        assert "samesite=lax" in cookie_header.lower()
