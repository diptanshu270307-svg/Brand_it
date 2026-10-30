"""Firebase Hosting forwards only __session; browser CSRF cannot depend on a second cookie.

These tests exercise the production cookie settings over HTTPS against the isolated
SQLite test database. They do not contact Firebase or require cloud credentials.
"""
from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import select

import app.api as api_module
import app.security as security
from app.config import Settings, get_settings
from app.db import SessionLocal
from app.main import app
from app.models import AuthSession, User, utcnow


@pytest.fixture
def firebase_browser(api, monkeypatch):
    # The ordinary api fixture creates a fully isolated test database first.
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.email == "casey@lumina.demo"))
        user.email = "firebase.employee@example.test"
        db.commit()
    production = get_settings().model_copy(update={
        "app_mode": "production",
        "session_cookie_name": "__session",
        "dev_cookie_secure": False,
    })
    monkeypatch.setattr(security, "get_settings", lambda: production)
    monkeypatch.setattr(api_module, "get_settings", lambda: production)
    # The outer api fixture owns app lifespan/schema setup, not production SQLite startup.
    browser = TestClient(app, base_url="https://brandlint.example.test")
    yield browser
    browser.close()


def login(browser):
    response = browser.post("/api/auth/login", json={
        "email": "firebase.employee@example.test", "password": "demo1234",
    })
    assert response.status_code == 200, response.text
    return response


def forward_only_firebase_cookie(browser, raw):
    browser.cookies.clear()
    browser.cookies.set("__session", raw, domain="brandlint.example.test", path="/")
    assert list(browser.cookies.keys()) == ["__session"]


def test_default_cookie_names_remain_backward_compatible(monkeypatch):
    monkeypatch.setattr(security, "get_settings", lambda: Settings(_env_file=None, app_mode="production", session_cookie_name=""))
    assert security.get_cookie_name() == "__Host-session"
    monkeypatch.setattr(security, "get_settings", lambda: Settings(_env_file=None, app_mode="development", session_cookie_name=""))
    assert security.get_cookie_name() == "brandlint_session"


@pytest.mark.parametrize("name", ["a;b", "a=b", "session cookie", "a\r\nInjected", "brandlint_csrf", "a" * 129])
def test_invalid_cookie_names_rejected(name):
    with pytest.raises(ValidationError):
        Settings(_env_file=None, session_cookie_name=name)


def test_firebase_cookie_has_production_security_flags(firebase_browser):
    response = login(firebase_browser)
    assert "__session" in response.cookies
    assert "brandlint_csrf" not in response.cookies
    assert "brandlint_session" not in response.cookies
    cookie = response.headers.get("set-cookie", "").lower()
    assert "httponly" in cookie and "secure" in cookie
    assert "samesite=lax" in cookie and "path=/" in cookie
    assert "domain=" not in cookie


def test_cookie_only_reload_bootstraps_csrf_and_authorizes_mutations(firebase_browser):
    response = login(firebase_browser)
    raw = response.cookies["__session"]
    forward_only_firebase_cookie(firebase_browser, raw)

    # Browser memory is empty after reload: get the header token from a safe JSON response.
    session = firebase_browser.get("/api/auth/session")
    assert session.status_code == 200
    assert session.json()["authenticated"] is True
    csrf = session.json()["csrf_token"]
    assert csrf == response.json()["csrf_token"]
    me = firebase_browser.get("/api/me")
    assert me.status_code == 200
    assert me.json()["csrf_token"] == csrf
    assert "brandlint_csrf" not in firebase_browser.cookies

    draft = {"title": "Cookie-only Firebase draft", "text": "Content for independent review."}
    missing = firebase_browser.post("/api/brands/1/drafts", json=draft)
    assert missing.status_code == 403
    forged = firebase_browser.post("/api/brands/1/drafts", json=draft, headers={"X-CSRF-Token": "not-a-session-token"})
    assert forged.status_code == 403
    valid = firebase_browser.post("/api/brands/1/drafts", json=draft, headers={"X-CSRF-Token": csrf})
    assert valid.status_code == 200, valid.text


def test_csrf_is_bound_to_the_current_session(firebase_browser):
    old = login(firebase_browser)
    current = login(firebase_browser)
    assert old.cookies["__session"] != current.cookies["__session"]
    forward_only_firebase_cookie(firebase_browser, current.cookies["__session"])
    draft = {"title": "Session binding", "text": "Session scoped mutation."}
    mismatch = firebase_browser.post("/api/brands/1/drafts", json=draft, headers={"X-CSRF-Token": old.json()["csrf_token"]})
    assert mismatch.status_code == 403
    valid = firebase_browser.post("/api/brands/1/drafts", json=draft, headers={"X-CSRF-Token": current.json()["csrf_token"]})
    assert valid.status_code == 200


def test_active_cookie_logout_requires_csrf_then_revokes_session(firebase_browser):
    response = login(firebase_browser)
    raw = response.cookies["__session"]
    forward_only_firebase_cookie(firebase_browser, raw)
    denied = firebase_browser.post("/api/auth/logout")
    assert denied.status_code == 403
    assert firebase_browser.get("/api/auth/session").status_code == 200
    # An arbitrary bearer header cannot bypass CSRF protection for the ambient cookie.
    mismatch = firebase_browser.post("/api/auth/logout", headers={"Authorization": "Bearer unrelated-session"})
    assert mismatch.status_code == 403
    logged_out = firebase_browser.post("/api/auth/logout", headers={"X-CSRF-Token": response.json()["csrf_token"]})
    assert logged_out.status_code == 200
    deleted = logged_out.headers.get("set-cookie", "").lower()
    assert "__session=" in deleted and "max-age=0" in deleted
    assert "httponly" in deleted and "secure" in deleted and "samesite=lax" in deleted
    assert "__session" not in firebase_browser.cookies
    # Captured session + its valid CSRF header remain unusable after logout.
    forward_only_firebase_cookie(firebase_browser, raw)
    assert firebase_browser.get("/api/auth/session").status_code == 401
    assert firebase_browser.post("/api/brands/1/drafts", json={"title": "Replay", "text": "Rejected replay"}, headers={"X-CSRF-Token": response.json()["csrf_token"]}).status_code == 401
    assert firebase_browser.post("/api/auth/logout").status_code == 200


def test_explicit_same_session_bearer_logout_is_supported(firebase_browser):
    response = login(firebase_browser)
    raw = response.cookies["__session"]
    logged_out = firebase_browser.post("/api/auth/logout", headers={"Authorization": f"Bearer {raw}"})
    assert logged_out.status_code == 200
    forward_only_firebase_cookie(firebase_browser, raw)
    assert firebase_browser.get("/api/auth/session").status_code == 401


def test_legacy_cookie_is_not_an_alternate_production_auth_path(firebase_browser):
    response = login(firebase_browser)
    firebase_browser.cookies.clear()
    firebase_browser.cookies.set("brandlint_session", response.cookies["__session"], domain="brandlint.example.test", path="/")
    assert firebase_browser.get("/api/me").status_code == 401


def test_firebase_forwarded_cookie_still_obeys_absolute_expiry(firebase_browser):
    response = login(firebase_browser)
    raw = response.cookies["__session"]
    with SessionLocal() as db:
        session = db.scalar(select(AuthSession).where(AuthSession.token_hash == security.hash_token(raw)))
        session.expires_at = utcnow() - timedelta(seconds=1)
        db.commit()
    forward_only_firebase_cookie(firebase_browser, raw)
    assert firebase_browser.get("/api/auth/session").status_code == 401


def test_signup_uses_configured_minimum_and_maximum_password_lengths(api, monkeypatch):
    settings = get_settings().model_copy(update={"password_min_length": 14, "password_max_length": 24})
    monkeypatch.setattr(api_module, "get_settings", lambda: settings)
    monkeypatch.setattr(security, "get_settings", lambda: settings)
    body = {"name": "Registration Test", "email": "signup-policy@example.test"}
    for password in ("short-but-13!", "x" * 25):
        response = api.c.post("/api/auth/register", json={**body, "password": password})
        assert response.status_code == 422
        assert "between 14 and 24" in response.text
    response = api.c.post("/api/auth/register", json={**body, "password": "valid-length-password"})
    assert response.status_code == 200, response.text


def test_signup_rate_limit_has_a_separate_ip_bucket(api, monkeypatch):
    settings = get_settings().model_copy(update={"auth_ip_max_failed_attempts": 2})
    monkeypatch.setattr(api_module, "get_settings", lambda: settings)
    for number in range(2):
        response = api.c.post("/api/auth/register", json={
            "name": "Registration Test", "email": f"signup-rate-{number}@example.test",
            "password": "ValidPassword123!",
        })
        assert response.status_code == 200, response.text
    limited = api.c.post("/api/auth/register", json={
        "name": "Registration Test", "email": "signup-rate-over@example.test", "password": "ValidPassword123!",
    })
    assert limited.status_code == 429
    assert limited.headers.get("retry-after")
    # Signup throttling does not consume the unrelated failed-login counter.
    login_response = api.c.post("/api/auth/login", json={"email": "casey@lumina.demo", "password": "demo1234"})
    assert login_response.status_code == 200
