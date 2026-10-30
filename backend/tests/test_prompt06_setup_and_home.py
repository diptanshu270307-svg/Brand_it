import pytest
from fastapi.testclient import TestClient

from app.db import SessionLocal
from app.main import app
from app.models import Brand, Rule


def test_company_creation_and_initial_setup(api):
    with TestClient(app) as client:
        olivia_headers = api.login("olivia")

        # Create a brand new company workspace
        create_res = client.post(
            "/api/companies",
            json={"name": "Acme Global", "brand_name": "Acme Core"},
            headers=olivia_headers,
        )
        assert create_res.status_code == 200
        data = create_res.json()
        assert data["company"]["name"] == "Acme Global"
        brand_id = data["brand"]["id"]

        # Retrieve setup state for the newly created brand
        setup_res = client.get(f"/api/brands/{brand_id}/setup", headers=olivia_headers)
        assert setup_res.status_code == 200
        setup = setup_res.json()
        assert setup["brand_id"] == brand_id
        assert setup["current_step"] == "guidelines"
        assert setup["is_completed"] is False
        assert setup["completed_count"] == 1  # Brand step is complete
        assert setup["steps"][0]["id"] == "brand"
        assert setup["steps"][0]["completed"] is True
        assert setup["steps"][1]["id"] == "guidelines"
        assert setup["steps"][1]["completed"] is False
        assert setup["role_task"]["key"] == "upload_guidelines"
        assert setup["role_task"]["can_act"] is True


def test_upload_guidelines_does_not_auto_activate_rules(api):
    with TestClient(app) as client:
        olivia_headers = api.login("olivia")

        with SessionLocal() as db:
            brand = db.query(Brand).first()
            brand_id = brand.id

        # Upload a guideline
        upload_res = client.post(
            f"/api/brands/{brand_id}/documents",
            data={
                "kind": "guideline",
                "title": "Fresh Tone Guidelines 2026",
                "text": "Tone rules:\nRule 1: Always say kindly.\nRule 2: Never use jargon.",
            },
            headers=olivia_headers,
        )
        assert upload_res.status_code == 200
        res_data = upload_res.json()
        doc_id = res_data["document"]["id"]
        assert len(res_data["proposed_rules"]) > 0

        # Verify proposed rules are NOT automatically approved/activated
        with SessionLocal() as db:
            proposed_rules = db.query(Rule).filter(
                Rule.brand_id == brand_id,
                Rule.source_document_id == doc_id,
            ).all()
            for r in proposed_rules:
                assert r.status == "proposed"
                assert r.approved_by is None

        # Check setup state
        setup_res = client.get(f"/api/brands/{brand_id}/setup", headers=olivia_headers)
        assert setup_res.status_code == 200
        setup = setup_res.json()
        guidelines_step = next(s for s in setup["steps"] if s["id"] == "guidelines")
        assert guidelines_step["completed"] is True


def test_role_aware_setup_and_permission_enforcement(api):
    with TestClient(app) as client:
        with SessionLocal() as db:
            brand = db.query(Brand).first()
            brand_id = brand.id

        casey_headers = api.login("casey")

        # Creator requests setup progress
        setup_res = client.get(f"/api/brands/{brand_id}/setup", headers=casey_headers)
        assert setup_res.status_code == 200
        setup = setup_res.json()

        # Creator should see creator-appropriate role task
        assert setup["role_task"]["target"] in ("review", "library")
        # Owner-only steps should have can_execute = False for creator
        guidelines_step = next(s for s in setup["steps"] if s["id"] == "guidelines")
        assert guidelines_step["can_execute"] is False
        rules_step = next(s for s in setup["steps"] if s["id"] == "rules")
        assert rules_step["can_execute"] is False

        # Creator cannot skip setup steps
        skip_res = client.post(
            f"/api/brands/{brand_id}/setup/skip-step",
            json={"step": "invite"},
            headers=casey_headers,
        )
        assert skip_res.status_code == 403


def test_skip_optional_invitation_and_resumability(api):
    with TestClient(app) as client:
        with SessionLocal() as db:
            brand = db.query(Brand).first()
            brand_id = brand.id

        olivia_headers = api.login("olivia")

        # Owner skips invite step
        skip_res = client.post(
            f"/api/brands/{brand_id}/setup/skip-step",
            json={"step": "invite"},
            headers=olivia_headers,
        )
        assert skip_res.status_code == 200
        setup = skip_res.json()
        assert setup["skipped_invite"] is True
        invite_step = next(s for s in setup["steps"] if s["id"] == "invite")
        assert invite_step["completed"] is True
        assert invite_step["skipped"] is True

        # Dismiss setup card
        dismiss_res = client.post(f"/api/brands/{brand_id}/setup/dismiss", headers=olivia_headers)
        assert dismiss_res.status_code == 200
        assert dismiss_res.json()["dismissed"] is True

        # Setup survives page refresh / re-fetching
        setup_refetch = client.get(f"/api/brands/{brand_id}/setup", headers=olivia_headers)
        assert setup_refetch.status_code == 200
        assert setup_refetch.json()["dismissed"] is True
        assert setup_refetch.json()["skipped_invite"] is True

        # Resume setup
        resume_res = client.post(f"/api/brands/{brand_id}/setup/resume", headers=olivia_headers)
        assert resume_res.status_code == 200
        assert resume_res.json()["dismissed"] is False


def test_teammate_completes_review_and_self_approval_prevented(api):
    with TestClient(app) as client:
        with SessionLocal() as db:
            brand = db.query(Brand).first()
            brand_id = brand.id

        casey_headers = api.login("casey")
        riley_headers = api.login("riley")

        # 1. Creator (Casey) creates a draft, checks and submits it
        draft_res = client.post(
            f"/api/brands/{brand_id}/drafts",
            json={"title": "Q4 Feature Launch", "channel": "Social", "text": "Excited to share our new features."},
            headers=casey_headers,
        )
        assert draft_res.status_code == 200
        draft_id = draft_res.json()["id"]
        rev_id = draft_res.json()["revision_id"]

        # Run check
        check_res = client.post(f"/api/brands/{brand_id}/drafts/{draft_id}/check", headers=casey_headers)
        assert check_res.status_code == 200

        # Submit for team review
        submit_res = client.post(f"/api/brands/{brand_id}/drafts/{draft_id}/submit", headers=casey_headers)
        assert submit_res.status_code == 200

        # Author Casey attempts self-approval -> rejected!
        self_approve = client.post(
            f"/api/brands/{brand_id}/drafts/{draft_id}/approve",
            json={"revision_id": rev_id, "comment": "Self approval should fail"},
            headers=casey_headers,
        )
        assert self_approve.status_code == 403

        # 2. Teammate Reviewer (Riley) checks queue
        queue_res = client.get(f"/api/brands/{brand_id}/queue", headers=riley_headers)
        assert queue_res.status_code == 200
        pending_items = [d for d in queue_res.json() if d["id"] == draft_id]
        assert len(pending_items) == 1
        assert pending_items[0]["actionable"] is True

        # Reviewer Riley approves the draft directly (as on home screen)
        approve_res = client.post(
            f"/api/brands/{brand_id}/drafts/{draft_id}/approve",
            json={"revision_id": rev_id, "comment": "Approved by independent reviewer."},
            headers=riley_headers,
        )
        assert approve_res.status_code == 200
        approved_draft = approve_res.json()
        assert approved_draft["status"] == "approved"
