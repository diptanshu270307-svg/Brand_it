import os
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from app.config import Settings, get_settings
from app.main import app
from app.seed import reset_and_seed
from app.security import create_token
from app.models import User


def test_production_mode_refuses_weak_or_default_secrets():
    # 1. Default insecure secret must be rejected in production
    s1 = Settings(app_mode="production", secret_key="dev-only-change-me-dev-only-change-me", demo_password="")
    with pytest.raises(RuntimeError, match="SECRET_KEY"):
        s1.validate_production_readiness()

    # 2. Short secret must be rejected in production
    s2 = Settings(app_mode="production", secret_key="short-secret-1234", demo_password="")
    with pytest.raises(RuntimeError, match="at least 32 characters"):
        s2.validate_production_readiness()

    # 3. Default demo password must be rejected in production
    s3 = Settings(app_mode="production", secret_key="a" * 32, demo_password="demo1234", seed_on_startup=False)
    with pytest.raises(RuntimeError, match="DEMO_PASSWORD"):
        s3.validate_production_readiness()

    # 4. Valid production settings pass validation
    s4 = Settings(app_mode="production", secret_key="prod-secret-" + "x" * 25, demo_password="", seed_on_startup=False,
                  database_url="postgresql+psycopg://user:pass@localhost:5432/brandlint")
    s4.validate_production_readiness()
    assert s4.is_production is True
    assert s4.is_demo is False


def test_production_mode_disables_demo_accounts_and_reset(monkeypatch):
    # Set mode to production with valid production secret
    prod_settings = Settings(
        app_mode="production",
        secret_key="production-test-key-" + "y" * 25,
        demo_password="",
        seed_on_startup=False,
        database_url=get_settings().database_url
    )
    monkeypatch.setattr("app.config.get_settings", lambda: prod_settings)
    monkeypatch.setattr("app.api.get_settings", lambda: prod_settings)
    monkeypatch.setattr("app.main.get_settings", lambda: prod_settings)
    # This test exercises request-time production behaviour against the isolated SQLite test DB.
    # Startup validation (incl. the PostgreSQL requirement) is covered by the readiness tests.
    monkeypatch.setattr(Settings, "validate_production_readiness", lambda self: None)

    with TestClient(app) as client:
        # 1. Demo account login must be blocked in production
        resp = client.post("/api/auth/login", json={"email": "casey@lumina.demo", "password": "demo1234"})
        assert resp.status_code == 403
        assert "Demo accounts are disabled" in resp.text

        # 2. Reset endpoint must be removed / return 404 in production
        # Authenticate with an arbitrary token
        dummy_user = User(id=1, email="admin@company.com", name="Admin", password_hash="dummy")
        token = create_token(dummy_user)
        resp_reset = client.post("/api/demo/reset", headers={"Authorization": f"Bearer {token}"})
        assert resp_reset.status_code == 404

        # 3. /api/system/mode reports production constraints
        resp_mode = client.get("/api/system/mode")
        assert resp_mode.status_code == 200
        mode_data = resp_mode.json()
        assert mode_data["is_production"] is True
        assert mode_data["allow_reset"] is False
        assert mode_data["allow_persona_switch"] is False


def test_demo_reset_forbidden_for_ordinary_users(api):
    # Logged in as Casey (role: creator, ordinary user)
    token_headers = api.login("casey")
    r = api.c.post("/api/demo/reset", headers=token_headers)
    assert r.status_code == 403
    assert "Brand Owner" in r.text


def test_demo_reset_forbidden_on_non_demo_database(monkeypatch, api):
    # Simulate a production database URL in non-production mode
    current = get_settings()
    custom_settings = Settings(
        app_mode="isolated-demo",
        secret_key=current.secret_key,
        database_url="postgresql://prod_user:secret@db.company.com:5432/company_production"
    )
    monkeypatch.setattr("app.config.get_settings", lambda: custom_settings)
    monkeypatch.setattr("app.api.get_settings", lambda: custom_settings)

    token_headers = api.login("olivia")  # Olivia is Brand Owner
    r = api.c.post("/api/demo/reset", headers=token_headers)
    assert r.status_code == 403
    assert "isolated demo database" in r.text


def test_demo_reset_permitted_for_brand_owner_on_isolated_demo_db(api):
    # Reset is allowed for Olivia on the isolated demo/test DB
    token_headers = api.login("olivia")
    r = api.c.post("/api/demo/reset", headers=token_headers)
    assert r.status_code == 200
    assert r.json() == {"status": "reset"}


def test_static_file_traversal_containment():
    dist_dir = Path("frontend/dist").resolve()
    repo_root = dist_dir.parents[1]

    # Create a canary file in repository root, strictly outside frontend/dist
    canary_path = repo_root / "canary_security_test.txt"
    canary_content = "CANARY_SECRET_DATA_DO_NOT_LEAK"
    canary_path.write_text(canary_content)

    symlink_path = dist_dir / "canary_symlink.txt"

    try:
        with TestClient(app) as client:
            # 1. SPA root works
            r_root = client.get("/")
            assert r_root.status_code == 200
            assert "BrandLint" in r_root.text

            # 2. SPA deep links work without returning external files
            r_deep = client.get("/review")
            assert r_deep.status_code == 200
            assert "BrandLint" in r_deep.text

            # 3. Direct access to canary file outside dist must 404
            r_canary = client.get("/canary_security_test.txt")
            assert r_canary.status_code == 404
            assert canary_content not in r_canary.text

            # 4. Standard path traversal (../)
            r_trav1 = client.get("/../canary_security_test.txt")
            assert r_trav1.status_code == 404
            assert canary_content not in r_trav1.text

            # 5. Encoded traversal variants (%2e%2e)
            r_trav2 = client.get("/%2e%2e/canary_security_test.txt")
            assert r_trav2.status_code == 404
            assert canary_content not in r_trav2.text

            # 6. Double encoded traversal (%252e%252e)
            r_trav3 = client.get("/%252e%252e/canary_security_test.txt")
            assert r_trav3.status_code == 404
            assert canary_content not in r_trav3.text

            # 7. Traversal through assets prefix (/assets/..)
            r_trav4 = client.get("/assets/../canary_security_test.txt")
            assert r_trav4.status_code == 404
            assert canary_content not in r_trav4.text

    finally:
        if canary_path.exists():
            canary_path.unlink()
        if symlink_path.exists() or symlink_path.is_symlink():
            symlink_path.unlink()


def test_static_symlink_containment(tmp_path):
    dist_dir = Path("frontend/dist").resolve()
    canary = tmp_path / "outside-dist.txt"
    canary.write_text("CANARY_MUST_NOT_BE_SERVED")
    link = dist_dir / "canary_symlink.txt"
    try:
        try:
            os.symlink(canary, link)
        except OSError as exc:
            if getattr(exc, "winerror", None) == 1314:
                pytest.skip("Windows does not grant this process symbolic-link creation permission")
            raise
        with TestClient(app) as client:
            response = client.get("/canary_symlink.txt")
        assert response.status_code == 404
        assert canary.read_text() not in response.text
    finally:
        if link.is_symlink():
            link.unlink()
