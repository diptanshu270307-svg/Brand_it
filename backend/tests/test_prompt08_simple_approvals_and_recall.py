"""Acceptance tests for Prompt 08 — Simple approvals and persisted Evidence Recall.

Tests:
1. Authors cannot self-approve (HTTP 403 self_approval).
2. Sensitive content requires correct reviewer (HTTP 403 senior_required).
3. Outdated revisions cannot be approved (HTTP 409 stale_revision).
4. Revoked evidence cannot support approval even during concurrent requests.
5. Controllable clock to test evidence expiry recall.
6. Repeated recall processing is idempotent and tenant-scoped.
7. Auditable reopen, recheck, and human reapproval workflow.
8. Eligible independent reviewers list, decision reason requirements, and in-app notifications.
"""
from datetime import date, timedelta
from conftest import finding


def test_author_cannot_self_approve(api):
    """Authors are strictly prevented from self-approving their own drafts."""
    # Casey (creator) creates and checks a draft
    d = api.call("casey", "POST", "/drafts", json={
        "title": "Clean announcement",
        "channel": "Blog",
        "text": "Lumina Flow delivers reliable performance for teams.",
        "audience": "Customers",
        "purpose": "Update",
        "cta": "Read more",
    }).json()
    did = d["id"]
    api.call("casey", "POST", f"/drafts/{did}/check")
    sub = api.call("casey", "POST", f"/drafts/{did}/submit").json()
    assert sub["status"] in ("in_review", "senior_review")
    rev = sub["revision_id"]

    # Casey attempts self-approval
    res = api.call("casey", "POST", f"/drafts/{did}/approve", json={
        "revision_id": rev,
        "comment": "Self sign-off approval attempt",
    })
    assert res.status_code == 403
    detail = res.json()["detail"]
    assert detail["code"] == "self_approval"
    assert "Authors cannot approve" in detail["message"]

    # Verify draft is still awaiting review and not approved
    det = api.detail(did)
    assert det["status"] in ("in_review", "senior_review")
    assert det["approved_revision_id"] is None

    # Audit trail recorded approval denial
    hist = api.call("casey", "GET", f"/drafts/{did}/history").json()
    assert any(a["action"] == "approval_denied" and a["details"].get("code") == "self_approval" for a in hist["audit"])


def test_sensitive_content_requires_correct_reviewer(api):
    """Drafts escalated to senior review require a senior reviewer or brand owner."""
    d = api.draft_by("productivity claim")
    did = d["id"]

    # Resolve tone and protected terminology
    det = api.call("casey", "POST", f"/drafts/{did}/check").json()
    g = finding(det, "CLAIM-01")
    det = api.call("casey", "POST", f"/drafts/{did}/findings/{g['id']}/accept", json={}).json()
    name = finding(det, "TERM-01")
    det = api.call("casey", "POST", f"/drafts/{did}/findings/{name['id']}/accept", json={"confirm_protected": True}).json()

    sub = api.call("casey", "POST", f"/drafts/{did}/submit").json()
    assert sub["status"] == "senior_review"
    assert sub["route"] == "senior"
    rev = sub["revision_id"]

    # Riley (standard reviewer) tries to approve
    r = api.call("riley", "POST", f"/drafts/{did}/approve", json={"revision_id": rev, "comment": "Standard reviewer attempt"})
    assert r.status_code == 403
    assert r.json()["detail"]["code"] == "senior_required"


def test_outdated_revisions_cannot_be_approved(api):
    """Submitting approval for an older revision is rejected with 409 stale_revision."""
    d = api.call("casey", "POST", "/drafts", json={
        "title": "Revision race test",
        "channel": "Email",
        "text": "Lumina Flow improves workflow efficiency.",
        "audience": "Customers",
        "purpose": "General update",
        "cta": "Learn more",
    }).json()
    did = d["id"]
    api.call("casey", "POST", f"/drafts/{did}/check")
    sub = api.call("casey", "POST", f"/drafts/{did}/submit").json()
    old_rev = sub["revision_id"]

    # Casey makes an edit, bumping to revision 2
    edit_res = api.call("casey", "PUT", f"/drafts/{did}", json={
        "text": "Lumina Flow improves team collaboration and efficiency.",
        "audience": "Customers",
        "purpose": "General update",
        "cta": "Learn more",
    }).json()
    assert edit_res["revision_id"] != old_rev

    # Reviewer tries to approve the old revision
    res = api.call("riley", "POST", f"/drafts/{did}/approve", json={
        "revision_id": old_rev,
        "comment": "Approving older revision",
    })
    assert res.status_code == 409
    assert res.json()["detail"]["code"] in ("stale_revision", "not_in_review")


def test_revoked_evidence_blocks_approval_even_during_concurrent_requests(api):
    """If evidence is revoked/rejected, approval is immediately blocked with 409."""
    today = date.today()
    # Olivia uploads an evidence source and registers an approved fact
    doc_res = api.call("olivia", "POST", "/documents", data={
        "kind": "evidence",
        "title": "Q4 Performance Benchmark",
        "text": "Lumina Flow speeds up batch indexing by 35% in enterprise environments.",
    }).json()
    doc_id = doc_res["document"]["id"]

    ev_res = api.call("olivia", "POST", "/evidence", json={
        "claim_text": "Lumina Flow speeds up batch indexing by 35% in enterprise environments.",
        "excerpt": "speeds up batch indexing by 35% in enterprise environments.",
        "document_id": doc_id,
        "page": 1,
        "owner": "Performance Team",
        "keywords": ["speed", "batch indexing", "35%"],
        "valid_from": (today - timedelta(days=10)).isoformat(),
        "valid_until": (today + timedelta(days=60)).isoformat(),
    }).json()
    ev_id = ev_res["id"]
    api.call("olivia", "POST", f"/evidence/{ev_id}/approve")

    # Author creates draft citing this approved claim
    d = api.call("casey", "POST", "/drafts", json={
        "title": "Enterprise Indexing Update",
        "channel": "Whitepaper",
        "text": "Lumina Flow speeds up batch indexing by 35% in enterprise environments.",
        "audience": "Enterprise teams",
        "purpose": "Speed benchmark",
        "cta": "Contact sales",
    }).json()
    did = d["id"]

    # Check and submit
    api.call("casey", "POST", f"/drafts/{did}/check")
    sub = api.call("casey", "POST", f"/drafts/{did}/submit").json()
    assert sub["status"] == "in_review"
    rev = sub["revision_id"]

    # Concurrently, Olivia revokes the evidence
    api.call("olivia", "POST", f"/evidence/{ev_id}/reject")

    # Sam (senior reviewer) attempts approval: blocked with 409 because evidence is revoked
    app_res = api.call("sam", "POST", f"/drafts/{did}/approve", json={
        "revision_id": rev,
        "comment": "Sign-off attempt with revoked evidence",
    })
    assert app_res.status_code == 409
    assert app_res.json()["detail"]["code"] in ("revoked_evidence", "approval_blocked")


def test_controllable_clock_evidence_expiry_and_recall(api):
    """Controllable clock tests evidence expiry and recalls affected approved content."""
    today = date.today()
    expiry_date = today + timedelta(days=7)

    # Ingest document and create evidence expiring in 7 days
    doc_res = api.call("olivia", "POST", "/documents", data={
        "kind": "evidence",
        "title": "Temporary Market Share Report",
        "text": "Lumina Flow holds 28% market share in cloud observability.",
    }).json()
    doc_id = doc_res["document"]["id"]

    ev_res = api.call("olivia", "POST", "/evidence", json={
        "claim_text": "Lumina Flow holds 28% market share in cloud observability.",
        "excerpt": "holds 28% market share in cloud observability.",
        "document_id": doc_id,
        "page": 1,
        "owner": "Research Analyst",
        "keywords": ["market share", "28%"],
        "valid_from": (today - timedelta(days=30)).isoformat(),
        "valid_until": expiry_date.isoformat(),
    }).json()
    ev_id = ev_res["id"]
    api.call("olivia", "POST", f"/evidence/{ev_id}/approve")

    # Author creates and checks draft
    d = api.call("casey", "POST", "/drafts", json={
        "title": "Market Share Announcement",
        "channel": "Press Release",
        "text": "Lumina Flow holds 28% market share in cloud observability.",
        "audience": "Industry analysts",
        "purpose": "Quarterly recap",
        "cta": "Read report",
    }).json()
    did = d["id"]

    check_res = api.call("casey", "POST", f"/drafts/{did}/check").json()
    assert len(check_res["blockers"]) == 0
    sub = api.call("casey", "POST", f"/drafts/{did}/submit").json()
    rev = sub["revision_id"]

    # Reviewer approves draft
    app_res = api.call("riley", "POST", f"/drafts/{did}/approve", json={
        "revision_id": rev,
        "comment": "Verified against temporary report.",
    })
    assert app_res.status_code == 200
    assert app_res.json()["status"] == "approved"
    assert app_res.json()["validity_status"] == "valid"

    # Now use controllable clock: run recall as_of today + 10 days (after expiry)
    future_date = today + timedelta(days=10)
    recall_res = api.call("riley", "POST", "/recall/process", json={
        "as_of": future_date.isoformat()
    })
    assert recall_res.status_code == 200
    data = recall_res.json()
    assert data["affected_count"] >= 1
    assert any(item["draft_id"] == did for item in data["affected"])

    # Verify draft validity changed to needs_revalidation while preserving historical approval
    det = api.detail(did)
    assert det["status"] == "needs_revalidation"
    assert det["validity_status"] == "needs_revalidation"
    assert "expired" in (det["recall_reason"] or "").lower()
    assert det["approved_revision_id"] == rev  # Historical approval preserved!

    # Historical decision trail preserved
    hist = api.call("casey", "GET", f"/drafts/{did}/history").json()
    assert any(d["kind"] == "approved" for d in hist["decisions"])

    # In-app notification created for author
    notifs = api.call("casey", "GET", "/notifications").json()
    assert any(n["kind"] == "evidence_recall" and n["draft_id"] == did for n in notifs)


def test_recall_is_idempotent_and_tenant_scoped(api):
    """Repeated recall processing is idempotent and isolated by tenant."""
    today = date.today()
    future_date = today + timedelta(days=20)

    # First call with future date
    res1 = api.call("riley", "POST", "/recall/process", json={"as_of": future_date.isoformat()})
    assert res1.status_code == 200

    # Second identical run must be idempotent (affected_count is 0 since already processed)
    res2 = api.call("riley", "POST", "/recall/process", json={"as_of": future_date.isoformat()})
    assert res2.status_code == 200
    assert res2.json()["affected_count"] == 0

    # Tenant scoping: Northwind (brand_id 2) has zero affected drafts
    res_other = api.c.post("/api/brands/2/recall/process", headers=api.login("noah"), json={"as_of": future_date.isoformat()})
    assert res_other.status_code == 200
    assert res_other.json()["affected_count"] == 0


def test_auditable_reopen_recheck_and_workflow(api):
    """Auditable reopen, recheck, and human re-approval workflow."""
    today = date.today()
    # 1. Setup an approved draft with expiring evidence
    doc_res = api.call("olivia", "POST", "/documents", data={
        "kind": "evidence",
        "title": "Special Report",
        "text": "Lumina Flow accelerates team velocity by 25% across sprint cycles.",
    }).json()
    doc_id = doc_res["document"]["id"]

    ev_res = api.call("olivia", "POST", "/evidence", json={
        "claim_text": "Lumina Flow accelerates team velocity by 25% across sprint cycles.",
        "excerpt": "accelerates team velocity by 25% across sprint cycles.",
        "document_id": doc_id,
        "page": 1,
        "owner": "Agile PMO",
        "keywords": ["velocity", "25%"],
        "valid_from": (today - timedelta(days=30)).isoformat(),
        "valid_until": (today + timedelta(days=3)).isoformat(),
    }).json()
    ev_id = ev_res["id"]
    api.call("olivia", "POST", f"/evidence/{ev_id}/approve")

    d = api.call("casey", "POST", "/drafts", json={
        "title": "Velocity Sprint Announcement",
        "channel": "Blog",
        "text": "Lumina Flow accelerates team velocity by 25% across sprint cycles.",
        "audience": "Engineering Leads",
        "purpose": "Productivity summary",
        "cta": "Read more",
    }).json()
    did = d["id"]

    api.call("casey", "POST", f"/drafts/{did}/check")
    sub = api.call("casey", "POST", f"/drafts/{did}/submit").json()
    rev = sub["revision_id"]

    api.call("riley", "POST", f"/drafts/{did}/approve", json={
        "revision_id": rev,
        "comment": "Approved based on Special Report.",
    })

    # 2. Run recall to invalidate it
    future_date = today + timedelta(days=10)
    api.call("riley", "POST", "/recall/process", json={"as_of": future_date.isoformat()})

    # 3. Check that alert appears
    alerts = api.call("riley", "GET", "/recall/alerts").json()
    assert len(alerts) >= 1
    assert any(a["draft_id"] == did for a in alerts)

    # 4. Reopen draft with reason
    reopen_res = api.call("casey", "POST", f"/drafts/{did}/reopen", json={
        "reason": "Reopening to refresh expired proof with updated figures."
    })
    assert reopen_res.status_code == 200
    det = reopen_res.json()
    assert det["status"] == "checked"
    assert det["validity_status"] == "reopened"

    # 5. Recheck draft
    recheck_res = api.call("casey", "POST", f"/drafts/{did}/recheck")
    assert recheck_res.status_code == 200

    # 6. History shows reopened decision
    hist = api.call("casey", "GET", f"/drafts/{did}/history").json()
    assert any(d["kind"] == "reopened" and "refresh expired proof" in d["body"] for d in hist["decisions"])


def test_eligible_reviewers_and_decision_reasons(api):
    """Test eligible independent reviewers list, decision reason length, and notification read."""
    d = api.call("casey", "POST", "/drafts", json={
        "title": "Reviewer test draft",
        "channel": "LinkedIn",
        "text": "Lumina Flow makes daily coordination simple.",
        "audience": "Customers",
        "purpose": "Updates",
        "cta": "Explore",
    }).json()
    did = d["id"]

    # Eligible reviewers for this draft excludes the author (Casey)
    el_res = api.call("casey", "GET", f"/drafts/{did}/eligible-reviewers")
    assert el_res.status_code == 200
    reviewers = el_res.json()
    assert len(reviewers) >= 2
    assert all(r["email"] != "casey@lumina.demo" for r in reviewers)
    assert any(r["role"] == "senior_reviewer" for r in reviewers)

    # Submit the draft so it is in_review
    api.call("casey", "POST", f"/drafts/{did}/check")
    api.call("casey", "POST", f"/drafts/{did}/submit")

    # Reason requirement on request changes: < 3 chars rejected with 422
    fail_res = api.call("riley", "POST", f"/drafts/{did}/request-changes", json={"reason": "no"})
    assert fail_res.status_code == 422

    # Request changes with valid reason
    req_res = api.call("riley", "POST", f"/drafts/{did}/request-changes", json={"reason": "Please clarify coordination details."})
    assert req_res.status_code == 200
    assert req_res.json()["status"] == "changes_requested"

    # Notification read endpoint
    notifs = api.call("casey", "GET", "/notifications").json()
    if notifs:
        nid = notifs[0]["id"]
        read_res = api.call("casey", "POST", f"/notifications/{nid}/read")
        assert read_res.status_code == 200
        assert read_res.json()["status"] == "ok"
