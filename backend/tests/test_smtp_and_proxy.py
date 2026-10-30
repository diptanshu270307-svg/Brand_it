from email.mime.multipart import MIMEMultipart
from pathlib import Path
from unittest.mock import MagicMock
import pytest
from fastapi.testclient import TestClient

from app.config import Settings, get_settings
from app.main import app
from app.mail import MailMessage, SmtpMailAdapter
from app.security import _failed_logins, _recovery_requests


@pytest.fixture(autouse=True)
def clean_throttle():
    _failed_logins.clear()
    _recovery_requests.clear()
    yield
    _failed_logins.clear()
    _recovery_requests.clear()


# ------------------------------------------------------------------ 1. Reverse Proxy & Scheme Resolution
def test_proxy_headers_client_ip_and_scheme_resolution():
    with TestClient(app) as client:
        # Request with reverse-proxy headers (as sent by Nginx/Caddy)
        resp = client.get(
            "/api/health",
            headers={
                "X-Forwarded-For": "203.0.113.195",
                "X-Forwarded-Proto": "https",
                "X-Forwarded-Host": "brandlint.company.com",
            },
        )
        assert resp.status_code == 200
        assert resp.json() == {"status": "ok"}


def test_proxy_headers_preserves_client_ip_in_login_throttling():
    with TestClient(app) as client:
        # Check that different forwarded IPs are treated as distinct clients for rate-limiting
        # 5 failed attempts for victim@test.com from IP-1
        for _ in range(5):
            r = client.post(
                "/api/auth/login",
                json={"email": "victim@test.com", "password": "wrong"},
                headers={"X-Forwarded-For": "198.51.100.1"},
            )
            assert r.status_code == 401

        # 6th attempt from same IP-1 for victim@test.com is throttled (429)
        r_throttled = client.post(
            "/api/auth/login",
            json={"email": "victim@test.com", "password": "wrong"},
            headers={"X-Forwarded-For": "198.51.100.1"},
        )
        assert r_throttled.status_code == 429
        assert "Too many failed attempts" in r_throttled.text

        # Fresh email from IP-2 is NOT throttled
        r_other_ip = client.post(
            "/api/auth/login",
            json={"email": "fresh@test.com", "password": "wrong"},
            headers={"X-Forwarded-For": "198.51.100.2"},
        )
        assert r_other_ip.status_code == 401


# ------------------------------------------------------------------ 2. SMTP Adapter Configuration & Security
def test_smtp_adapter_unconfigured_verification():
    empty_settings = Settings(
        app_mode="production",
        secret_key="prod-secret-" + "s" * 25,
        smtp_host="",
        smtp_from="",
        database_url=get_settings().database_url,
    )
    adapter = SmtpMailAdapter(settings=empty_settings)
    ok, msg = adapter.verify_connection()
    assert ok is False
    assert "must be configured" in msg


def test_smtp_adapter_starttls_mode(monkeypatch):
    mock_server = MagicMock()
    mock_smtp_cls = MagicMock(return_value=mock_server)
    mock_server.__enter__.return_value = mock_server

    monkeypatch.setattr("smtplib.SMTP", mock_smtp_cls)

    smtp_settings = Settings(
        app_mode="production",
        secret_key="prod-secret-" + "s" * 25,
        smtp_host="smtp.sendgrid.net",
        smtp_port=587,
        smtp_username="apikey",
        smtp_password="super-secret-key-12345",
        smtp_from="security@company.com",
        smtp_starttls=True,
        smtp_ssl=False,
        database_url=get_settings().database_url,
    )
    adapter = SmtpMailAdapter(settings=smtp_settings)

    # 1. Test verify_connection
    ok, msg = adapter.verify_connection()
    assert ok is True
    assert "Successfully connected" in msg
    mock_smtp_cls.assert_called_with("smtp.sendgrid.net", 587, timeout=15)
    mock_server.starttls.assert_called_once()
    mock_server.login.assert_called_with("apikey", "super-secret-key-12345")
    mock_server.noop.assert_called_once()

    # 2. Test send
    mock_server.reset_mock()
    msg = MailMessage(
        to_email="employee@company.com",
        subject="Test Subject",
        text_body="Plain text body",
    )
    adapter.send(msg)
    mock_server.send_message.assert_called_once()


def test_smtp_adapter_direct_ssl_mode(monkeypatch):
    mock_server_ssl = MagicMock()
    mock_smtp_ssl_cls = MagicMock(return_value=mock_server_ssl)
    mock_server_ssl.__enter__.return_value = mock_server_ssl

    monkeypatch.setattr("smtplib.SMTP_SSL", mock_smtp_ssl_cls)

    ssl_settings = Settings(
        app_mode="production",
        secret_key="prod-secret-" + "s" * 25,
        smtp_host="email-smtp.us-east-1.amazonaws.com",
        smtp_port=465,
        smtp_username="ses-user",
        smtp_password="ses-password-secret",
        smtp_from="security@company.com",
        smtp_starttls=False,
        smtp_ssl=True,
        database_url=get_settings().database_url,
    )
    adapter = SmtpMailAdapter(settings=ssl_settings)

    ok, msg = adapter.verify_connection()
    assert ok is True
    assert "SSL (port 465)" in msg
    mock_smtp_ssl_cls.assert_called_with("email-smtp.us-east-1.amazonaws.com", 465, timeout=15)
    mock_server_ssl.login.assert_called_with("ses-user", "ses-password-secret")
    mock_server_ssl.noop.assert_called_once()


def test_smtp_authentication_failure_masks_secrets(monkeypatch):
    import smtplib

    mock_server = MagicMock()
    mock_server.__enter__.return_value = mock_server
    mock_server.login.side_effect = smtplib.SMTPAuthenticationError(535, b"Authentication failed")
    monkeypatch.setattr("smtplib.SMTP", MagicMock(return_value=mock_server))

    secret_val = "sensitive-smtp-secret-999"
    smtp_settings = Settings(
        app_mode="production",
        secret_key="prod-secret-" + "s" * 25,
        smtp_host="smtp.example.com",
        smtp_port=587,
        smtp_username="myuser",
        smtp_password=secret_val,
        smtp_from="sender@example.com",
        database_url=get_settings().database_url,
    )
    adapter = SmtpMailAdapter(settings=smtp_settings)

    ok, msg = adapter.verify_connection()
    assert ok is False
    assert "authentication failed" in msg.lower()
    # Ensure password is NEVER leaked in error string
    assert secret_val not in msg
