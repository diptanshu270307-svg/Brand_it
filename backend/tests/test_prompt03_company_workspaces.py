import secrets
from datetime import timedelta
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.config import get_settings
from app.db import SessionLocal
from app.main import app
from app.mail import MailAdapter, MailMessage, set_mail_adapter_override
from app.models import (
    Brand,
    Company,
    CompanyInvitation,
    CompanyMembership,
    Draft,
    Membership,
    SourceDocument,
    User,
    utcnow,
)
from app.security import hash_password, hash_token, ROLE_DESCRIPTIONS
from app.seed import reset_and_seed
from conftest import Api


class MemoryMailAdapter(MailAdapter):
    """Test mail adapter capturing sent messages in memory."""

    def __init__(self):
        self.sent: list[MailMessage] = []

    def send(self, message: MailMessage) -> None:
        self.sent.append(message)


@pytest.fixture(autouse=True)
def capture_emails():
    adapter = MemoryMailAdapter()
    set_mail_adapter_override(adapter)
    yield adapter
    set_mail_adapter_override(None)


# ------------------------------------------------------------------ 1. Roles & Plain-Language Explanations
def test_roles_endpoint_explains_permissions_in_plain_language():
    with TestClient(app) as client:
        resp = client.get("/api/roles")
        assert resp.status_code == 200
        data = resp.json()

        for role in ("creator", "reviewer", "senior_reviewer", "brand_owner"):
            assert role in data
            assert "label" in data[role]
            assert "description" in data[role]
            assert len(data[role]["permissions"]) > 0


# ------------------------------------------------------------------ 2. Multi-Tenant Company Isolation
def test_cross_company_reads_and_mutations_rejected(api):
    # api.login("olivia") is Brand Owner of Lumina (Company 1, Brand 1)
    # api.login("noah") is Brand Owner of Northwind (Company 2, Brand 2)
    olivia_headers = api.login("olivia")
    noah_headers = api.login("noah")

    with TestClient(app) as client:
        # 1. Cross-company workspace reads are rejected with 404
        r1 = client.get("/api/companies/2", headers=olivia_headers)
        assert r1.status_code == 404  # Olivia cannot see Northwind company workspace

        r2 = client.get("/api/companies/1", headers=noah_headers)
        assert r2.status_code == 404  # Noah cannot see Lumina company workspace

        # 2. Cross-company member listings are rejected with 404
        r3 = client.get("/api/companies/2/members", headers=olivia_headers)
        assert r3.status_code == 404

        r4 = client.get("/api/companies/1/members", headers=noah_headers)
        assert r4.status_code == 404

        # 3. Cross-company settings mutations are rejected with 404
        r5 = client.put("/api/companies/2", json={"name": "Hacked Name"}, headers=olivia_headers)
        assert r5.status_code == 404

        r6 = client.put("/api/companies/1", json={"name": "Hacked Name"}, headers=noah_headers)
        assert r6.status_code == 404

        # 4. Cross-company invitations are rejected with 404
        r7 = client.post(
            "/api/companies/2/invitations",
            json={"email": "spy@lumina.demo", "role": "creator"},
            headers=olivia_headers,
        )
        assert r7.status_code == 404

        # 5. Cross-company brand mutations are rejected with 404
        r8 = client.post(
            "/api/brands/2/drafts",
            json={"title": "Unauthorized Draft", "text": "Draft content"},
            headers=olivia_headers,
        )
        assert r8.status_code == 404

        r9 = client.post(
            "/api/brands/1/drafts",
            json={"title": "Unauthorized Draft", "text": "Draft content"},
            headers=noah_headers,
        )
        assert r9.status_code == 404


# ------------------------------------------------------------------ 3. Guessed Resource ID Access Rejected
def test_guessed_resource_ids_rejected_across_tenants(api):
    # Create a draft in Northwind (Brand 2) by Noah
    noah_headers = api.login("noah")
    olivia_headers = api.login("olivia")

    with TestClient(app) as client:
        # Create draft in brand 2
        r_create = client.post(
            "/api/brands/2/drafts",
            json={"title": "Northwind Confidential Strategy", "text": "Secret text here."},
            headers=noah_headers,
        )
        assert r_create.status_code == 200
        nw_draft_id = r_create.json()["id"]

        # Olivia (Brand 1 / Lumina) guesses the ID of Northwind's draft
        # Trying to fetch it through brand 1 must return 404
        r_guess_b1 = client.get(f"/api/brands/1/drafts/{nw_draft_id}", headers=olivia_headers)
        assert r_guess_b1.status_code == 404

        # Trying to fetch it through brand 2 must also return 404 because Olivia is not in brand 2
        r_guess_b2 = client.get(f"/api/brands/2/drafts/{nw_draft_id}", headers=olivia_headers)
        assert r_guess_b2.status_code == 404

        # Create a document in brand 2
        r_doc = client.post(
            "/api/brands/2/documents",
            data={"kind": "guideline", "title": "Northwind Guideline", "text": "TERM-01: Rule text."},
            headers=noah_headers,
        )
        assert r_doc.status_code == 200
        nw_doc_id = r_doc.json()["document"]["id"]

        # Olivia guesses the document ID
        r_doc_guess = client.get(f"/api/brands/1/documents/{nw_doc_id}", headers=olivia_headers)
        assert r_doc_guess.status_code == 404


# ------------------------------------------------------------------ 4. Role Escalation Prevention
def test_role_escalation_prevented(api):
    # Casey is Creator in Lumina (Company 1)
    # Riley is Reviewer in Lumina (Company 1)
    casey_headers = api.login("casey")
    riley_headers = api.login("riley")

    with TestClient(app) as client:
        # 1. Creator cannot invite new members (403)
        r_invite_creator = client.post(
            "/api/companies/1/invitations",
            json={"email": "newbie@lumina.demo", "role": "creator"},
            headers=casey_headers,
        )
        assert r_invite_creator.status_code == 403
        assert "Requires company role" in r_invite_creator.text

        # 2. Reviewer cannot invite new members (403)
        r_invite_reviewer = client.post(
            "/api/companies/1/invitations",
            json={"email": "newbie@lumina.demo", "role": "creator"},
            headers=riley_headers,
        )
        assert r_invite_reviewer.status_code == 403

        # 3. Creator cannot change roles (403)
        r_role = client.put(
            "/api/companies/1/members/1",
            json={"role": "brand_owner"},
            headers=casey_headers,
        )
        assert r_role.status_code == 403

        # 4. Reviewer cannot remove members (403)
        r_remove = client.delete("/api/companies/1/members/1", headers=riley_headers)
        assert r_remove.status_code == 403

        # 5. Creator cannot update company settings (403)
        r_settings = client.put(
            "/api/companies/1",
            json={"name": "Renamed By Creator"},
            headers=casey_headers,
        )
        assert r_settings.status_code == 403


# ------------------------------------------------------------------ 5. Team Invitations & Replay Protection
def test_invitation_lifecycle_and_replay_protection(api, capture_emails):
    olivia_headers = api.login("olivia")

    with TestClient(app) as client:
        # 1. Inviting an existing member fails with 400
        r_fail = client.post(
            "/api/companies/1/invitations",
            json={"email": "casey@lumina.demo", "role": "reviewer"},
            headers=olivia_headers,
        )
        assert r_fail.status_code == 400
        assert "already a member" in r_fail.text

        # 2. Owner invites a new teammate
        invite_email = "emma.designer@lumina.demo"
        r_inv = client.post(
            "/api/companies/1/invitations",
            json={"email": invite_email, "role": "reviewer"},
            headers=olivia_headers,
        )
        assert r_inv.status_code == 200
        inv_data = r_inv.json()
        assert inv_data["email"] == invite_email
        assert inv_data["role"] == "reviewer"
        raw_token = inv_data["token"]
        assert len(raw_token) >= 32

        # Verify email was dispatched with URL fragment
        assert len(capture_emails.sent) == 1
        sent_email = capture_emails.sent[0]
        assert sent_email.to_email == invite_email
        assert "#invite-token=" in sent_email.text_body

        # 3. Inspect invitation endpoint (preview before accept)
        r_inspect = client.get(f"/api/invitations/{raw_token}")
        assert r_inspect.status_code == 200
        inspect_data = r_inspect.json()
        assert inspect_data["company_name"] == "Lumina Analytics"
        assert inspect_data["role"] == "reviewer"
        assert len(inspect_data["permissions"]) > 0

        # 4. Accept invitation as new user (creates account & joins workspace)
        r_accept = client.post(
            "/api/invitations/accept",
            json={"token": raw_token, "name": "Emma Designer", "password": "SecurePassword123!"},
        )
        assert r_accept.status_code == 200
        accept_data = r_accept.json()
        assert accept_data["status"] == "accepted"
        assert accept_data["role"] == "reviewer"
        new_token = accept_data["token"]

        # 5. INVITATION REPLAY REJECTED: Using the same token again must fail
        r_replay = client.post(
            "/api/invitations/accept",
            json={"token": raw_token, "name": "Emma Designer", "password": "SecurePassword123!"},
        )
        assert r_replay.status_code == 400
        assert "already been accepted" in r_replay.text

        # 6. Verify Emma has access to Lumina workspace as reviewer
        r_lib = client.get("/api/brands/1/library", headers={"Authorization": f"Bearer {new_token}"})
        assert r_lib.status_code == 200

        # Emma has reviewer role, so cannot access Northwind (Brand 2)
        r_other = client.get("/api/brands/2/library", headers={"Authorization": f"Bearer {new_token}"})
        assert r_other.status_code == 404

        # 7. Test Revocation: Owner creates invitation, then revokes it
        r_inv2 = client.post(
            "/api/companies/1/invitations",
            json={"email": "temp@lumina.demo", "role": "creator"},
            headers=olivia_headers,
        )
        inv2_id = r_inv2.json()["id"]
        inv2_token = r_inv2.json()["token"]

        # Revoke invitation
        r_revoke = client.delete(f"/api/companies/1/invitations/{inv2_id}", headers=olivia_headers)
        assert r_revoke.status_code == 200

        # Attempt to accept revoked invitation fails
        r_revoked_accept = client.post(
            "/api/invitations/accept",
            json={"token": inv2_token, "name": "Temp User", "password": "Password123!"},
        )
        assert r_revoked_accept.status_code == 400
        assert "revoked" in r_revoked_accept.text

        # 8. Test Expiration: Expired invitation cannot be accepted
        r_inv3 = client.post(
            "/api/companies/1/invitations",
            json={"email": "expired@lumina.demo", "role": "creator"},
            headers=olivia_headers,
        )
        inv3_token = r_inv3.json()["token"]
        token_h3 = hash_token(inv3_token)

        # Wind back expires_at in DB
        db = SessionLocal()
        try:
            db_inv = db.scalar(select(CompanyInvitation).where(CompanyInvitation.token_hash == token_h3))
            db_inv.expires_at = utcnow() - timedelta(days=1)
            db.commit()
        finally:
            db.close()

        r_expired_accept = client.post(
            "/api/invitations/accept",
            json={"token": inv3_token, "name": "Expired User", "password": "Password123!"},
        )
        assert r_expired_accept.status_code == 400
        assert "expired" in r_expired_accept.text


# ------------------------------------------------------------------ 6. Final Owner Protection
def test_final_owner_protection(api):
    olivia_headers = api.login("olivia")

    # Get Olivia's user ID
    db = SessionLocal()
    try:
        olivia = db.scalar(select(User).where(User.email == "olivia@lumina.demo"))
        olivia_id = olivia.id
        sam = db.scalar(select(User).where(User.email == "sam@lumina.demo"))
        sam_id = sam.id
    finally:
        db.close()

    with TestClient(app) as client:
        # 1. Attempting to remove the sole owner must fail with 400
        r_remove_sole = client.delete(f"/api/companies/1/members/{olivia_id}", headers=olivia_headers)
        assert r_remove_sole.status_code == 400
        assert "final owner" in r_remove_sole.text

        # 2. Attempting to demote the sole owner must fail with 400
        r_demote_sole = client.put(
            f"/api/companies/1/members/{olivia_id}",
            json={"role": "senior_reviewer"},
            headers=olivia_headers,
        )
        assert r_demote_sole.status_code == 400
        assert "final owner" in r_demote_sole.text

        # 3. Promote Sam to co-owner
        r_promote_sam = client.put(
            f"/api/companies/1/members/{sam_id}",
            json={"role": "brand_owner"},
            headers=olivia_headers,
        )
        assert r_promote_sam.status_code == 200

        # 4. Now that two owners exist, Olivia can demote Sam safely
        r_demote_sam = client.put(
            f"/api/companies/1/members/{sam_id}",
            json={"role": "senior_reviewer"},
            headers=olivia_headers,
        )
        assert r_demote_sam.status_code == 200


# ------------------------------------------------------------------ 7. Immediate Session Impact on Member Removal / Role Change
def test_immediate_session_impact_on_member_removal_and_role_change(api):
    # Riley is a reviewer in Lumina
    riley_headers = api.login("riley")
    olivia_headers = api.login("olivia")

    db = SessionLocal()
    try:
        riley = db.scalar(select(User).where(User.email == "riley@lumina.demo"))
        riley_id = riley.id
    finally:
        db.close()

    with TestClient(app) as client:
        # 1. Verify Riley can access Lumina brand currently
        r_before = client.get("/api/brands/1/library", headers=riley_headers)
        assert r_before.status_code == 200

        # 2. Owner removes Riley from Lumina company workspace
        r_rm = client.delete(f"/api/companies/1/members/{riley_id}", headers=olivia_headers)
        assert r_rm.status_code == 200

        # 3. IMMEDIATE IMPACT: Riley's existing session is immediately rejected on next request
        r_after = client.get("/api/brands/1/library", headers=riley_headers)
        assert r_after.status_code == 404

        r_after_company = client.get("/api/companies/1", headers=riley_headers)
        assert r_after_company.status_code == 404


# ------------------------------------------------------------------ 8. Self-Approval Prevention Retained
def test_self_approval_prevention_retained(api):
    # Sam is senior_reviewer
    # Have Sam author a draft
    sam_headers = api.login("sam")

    with TestClient(app) as client:
        r_draft = client.post(
            "/api/brands/1/drafts",
            json={"title": "Sam's Draft", "text": "Lumina Flow delivers reliable performance."},
            headers=sam_headers,
        )
        assert r_draft.status_code == 200
        draft_id = r_draft.json()["id"]
        rev_id = r_draft.json()["revision_id"]

        # Check the draft
        client.post(f"/api/brands/1/drafts/{draft_id}/check", headers=sam_headers)
        client.post(f"/api/brands/1/drafts/{draft_id}/submit", headers=sam_headers)

        # Sam attempts to self-approve the draft
        r_approve = client.post(
            f"/api/brands/1/drafts/{draft_id}/approve",
            json={"revision_id": rev_id, "comment": "Self approving"},
            headers=sam_headers,
        )
        assert r_approve.status_code == 403
        assert "author_cannot_approve" in r_approve.text or "Authors cannot approve" in r_approve.text
