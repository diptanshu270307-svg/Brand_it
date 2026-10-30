import os
import tempfile

# Must be set before the app (and its cached settings) is imported.
_tmp = tempfile.mkdtemp(prefix="brandlint-test-")
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp}/test.db"
os.environ["LLM_PROVIDER"] = "mock"
os.environ["SEED_ON_STARTUP"] = "false"
os.environ["SECRET_KEY"] = "test-secret-test-secret-test-secret"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.llm import set_provider_override  # noqa: E402
from app.main import app  # noqa: E402
from app.seed import reset_and_seed  # noqa: E402
from app.throttling import reset_throttling  # noqa: E402

PASSWORD = "demo1234"


class Api:
    """Tiny helper around TestClient with per-user tokens."""

    def __init__(self, client: TestClient):
        self.c = client
        self.tokens: dict[str, str] = {}
        self.brand_id = 1

    def login(self, who: str) -> dict:
        email = {"casey": "casey@lumina.demo", "riley": "riley@lumina.demo", "sam": "sam@lumina.demo",
                 "olivia": "olivia@lumina.demo", "noah": "noah@northwind.demo"}[who]
        if who not in self.tokens:
            r = self.c.post("/api/auth/login", json={"email": email, "password": PASSWORD})
            assert r.status_code == 200, r.text
            self.tokens[who] = r.json()["token"]
            self.c.cookies.clear()
        return {"Authorization": f"Bearer {self.tokens[who]}"}

    def call(self, who, method, path, **kw):
        return self.c.request(method, f"/api/brands/{self.brand_id}{path}", headers=self.login(who), **kw)

    def drafts(self, who="casey"):
        return {d["title"]: d for d in self.call(who, "GET", "/drafts").json()}

    def draft_by(self, fragment, who="casey"):
        return next(d for t, d in self.drafts(who).items() if fragment in t and "SEEDED" not in t)

    def detail(self, draft_id, who="casey"):
        return self.call(who, "GET", f"/drafts/{draft_id}").json()


@pytest.fixture()
def api():
    set_provider_override(None)
    reset_throttling()
    reset_and_seed()
    with TestClient(app) as client:
        yield Api(client)
    reset_throttling()
    set_provider_override(None)


def finding(detail, rule_key=None, claim=False, contains=None):
    for f in detail["findings"]:
        if rule_key and (f["rule"] or {}).get("key") != rule_key:
            continue
        if claim and not f["is_claim"]:
            continue
        if contains and contains not in f["quote"]:
            continue
        return f
    return None
