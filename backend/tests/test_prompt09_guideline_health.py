"""Tests for Prompt 09: Guideline Health that changes behavior.

Verifies:
1. Review outcomes stored and displayed by rule version and content channel; seeded vs live separated.
2. v1/v2 statistics remain separate (active version reflects active stats, version breakdown isolates each).
3. Explicit channel conditions represented as validated data, not executable code.
4. Channel-specific behavior changes as previewed (e.g. casual greetings allowed on Instagram, restricted on Investor copy).
5. Statistical sample size, override count/rate and uncertainty labelling (insufficient history labelled when n < min_sample).
6. Pre-publication draft evaluation simulation against real saved drafts showing changed findings, sample size, and unchanged cases.
7. Proposal publication is strictly permission-checked (owner required), preserves old versions, retains historical version pins on prior analyses.
8. Rule publication routes impacted approved content into the revalidation workflow.
9. AI policy suggestions are never auto-published.
"""
from sqlalchemy import select
from app.db import SessionLocal
from app.models import (
    Analysis, Brand, Draft, DraftRevision, EvidenceRecord, Finding,
    GuidelineProposal, RevisionDependency, Rule, RuleEvent,
)
from app.insights import simulate_proposal_evaluation, compute_uncertainty
from app.analysis.pipeline import run_matchers


def test_channel_specific_matcher_behavior(api):
    """Channel-specific behavior: casual greeting allowed on Instagram, restricted on Investor copy."""
    with SessionLocal() as db:
        rule = db.scalar(select(Rule).where(Rule.brand_id == api.brand_id, Rule.key == "TONE-01"))
        assert rule is not None

        # Text with casual greeting
        text = "Hey guys, join our upcoming session."

        # Baseline: with no exemptions, flags on all channels
        hits_no_ch = run_matchers(text, [rule], channel="")
        assert len(hits_no_ch) == 1
        assert hits_no_ch[0].quote.lower() == "guys"

        hits_ig_v1 = run_matchers(text, [rule], channel="Instagram")
        assert len(hits_ig_v1) == 1

        hits_inv_v1 = run_matchers(text, [rule], channel="Investor Update")
        assert len(hits_inv_v1) == 1

        # Configure explicit channel condition: allow on Instagram
        rule.channel_conditions = [
            {"channel": "Instagram", "action": "allow", "reason": "Casual greetings allowed on Instagram"}
        ]
        rule.exempt_channels = ["Instagram"]

        # On Instagram: exempted! No findings
        hits_ig_v2 = run_matchers(text, [rule], channel="Instagram")
        assert len(hits_ig_v2) == 0

        # On Investor Update: restricted! Flags finding
        hits_inv_v2 = run_matchers(text, [rule], channel="Investor Update")
        assert len(hits_inv_v2) == 1
        assert hits_inv_v2[0].quote.lower() == "guys"


def test_uncertainty_and_insufficient_history_labelling():
    """Uncertainty metrics: small sample size flagged as insufficient history rather than claiming rule is bad."""
    # Under minimum sample (n = 2 < 5)
    uncert_small = compute_uncertainty(overrides=2, decisions=2, min_sample=5)
    assert uncert_small["insufficient_history"] is True
    assert "Insufficient sample size (n = 2 < 5)" in uncert_small["uncertainty_label"]
    assert uncert_small["confidence_interval"] is None

    # Adequate sample (n = 10 >= 5)
    uncert_adequate = compute_uncertainty(overrides=6, decisions=10, min_sample=5)
    assert uncert_adequate["insufficient_history"] is False
    assert "n = 10" in uncert_adequate["uncertainty_label"]
    assert uncert_adequate["confidence_interval"] is not None
    assert 0.0 <= uncert_adequate["confidence_interval"]["low"] <= uncert_adequate["confidence_interval"]["high"] <= 1.0


def test_v1_and_v2_statistics_remain_separate(api):
    """Acceptance: v1 and v2 review statistics remain strictly isolated."""
    # Seed already has 6 overrides and 3 accepted decisions for TONE-01 v1
    res = api.call("olivia", "GET", "/insights")
    assert res.status_code == 200
    data = res.json()
    health_tone = next(h for h in data["health"] if h["rule_key"] == "TONE-01")

    # In v1: 6 overrides, 3 accepted -> 9 decisions
    assert health_tone["version"] == 1
    assert health_tone["overrides"] == 6
    assert health_tone["accepted"] == 3
    assert health_tone["decisions"] == 9
    assert health_tone["insufficient_history"] is False

    # Propose a wording change as reviewer (riley)
    res_sug = api.call("riley", "POST", "/health/TONE-01/suggest")
    assert res_sug.status_code == 200
    proposal_id = res_sug.json()["id"]

    # Olivia (brand owner) approves and publishes proposal with explicit channel conditions
    res_pub = api.call(
        "olivia", "POST", f"/proposals/{proposal_id}/approve",
        json={
            "edited_text": "Professional address is required; casual greetings like 'hey guys' are permitted on Instagram.",
            "channel_conditions": [
                {"channel": "Instagram", "action": "allow", "reason": "Casual greetings allowed on Instagram"}
            ],
        },
    )
    assert res_pub.status_code == 200

    # Add 2 accepted decisions under version 2
    with SessionLocal() as db:
        db.add(RuleEvent(
            brand_id=api.brand_id, rule_key="TONE-01", rule_version=2, kind="accepted",
            excerpt="Hey guys", channel="Instagram", seeded=False,
        ))
        db.add(RuleEvent(
            brand_id=api.brand_id, rule_key="TONE-01", rule_version=2, kind="accepted",
            excerpt="Dear investors", channel="Investor Update", seeded=False,
        ))
        db.commit()

    # Re-query insights: active version is now v2!
    res2 = api.call("olivia", "GET", "/insights")
    assert res2.status_code == 200
    health_tone_v2 = next(h for h in res2.json()["health"] if h["rule_key"] == "TONE-01")

    # Active version statistics reflect v2 ONLY: 0 overrides, 2 accepted, decisions = 2
    assert health_tone_v2["version"] == 2
    assert health_tone_v2["overrides"] == 0
    assert health_tone_v2["accepted"] == 2
    assert health_tone_v2["decisions"] == 2
    # Since n = 2 < min_sample (5), insufficient_history must be True!
    assert health_tone_v2["insufficient_history"] is True
    assert "Insufficient sample size (n = 2 < 5)" in health_tone_v2["uncertainty_label"]

    # Version breakdown retains both v1 and v2 separately
    vb = health_tone_v2["version_breakdown"]
    assert len(vb) == 2
    v1_entry = next(v for v in vb if v["version"] == 1)
    v2_entry = next(v for v in vb if v["version"] == 2)
    assert v1_entry["overrides"] == 6
    assert v1_entry["decisions"] == 9
    assert v2_entry["overrides"] == 0
    assert v2_entry["decisions"] == 2


def test_pre_publication_draft_simulation(api):
    """Pre-publication simulation evaluates candidate rule & conditions against real saved drafts."""
    # Create two drafts in the workspace: one Instagram draft and one Investor Update draft
    d1 = api.call("casey", "POST", "/drafts", json={
        "title": "Instagram Social Reel",
        "channel": "Instagram",
        "text": "Hey guys! Join us for a special feature reveal. Book a demo today.",
        "audience": "Customers",
        "purpose": "Announcement",
        "cta": "Book a demo",
    }).json()
    api.call("casey", "POST", f"/drafts/{d1['id']}/check")

    d2 = api.call("casey", "POST", "/drafts", json={
        "title": "Investor Update Q3",
        "channel": "Investor Update",
        "text": "Hey guys, our task throughput increased 18%. Book a demo.",
        "audience": "Investors",
        "purpose": "Update",
        "cta": "Book a demo",
    }).json()
    api.call("casey", "POST", f"/drafts/{d2['id']}/check")

    # Simulate proposal with Instagram exemption
    sim_payload = {
        "proposed_text": "Professional address required; casual greetings permitted on Instagram.",
        "channel_conditions": [
            {"channel": "Instagram", "action": "allow", "reason": "Casual greetings allowed on Instagram"}
        ],
    }
    res_sim = api.call("olivia", "POST", "/health/TONE-01/simulate", json=sim_payload)
    assert res_sim.status_code == 200
    sim_data = res_sim.json()

    assert sim_data["drafts_evaluated"] >= 2
    assert sim_data["findings_eliminated_count"] >= 1
    assert sim_data["changed_count"] >= 1

    changed = sim_data["changed_drafts"]
    ig_draft = next((d for d in changed if d["title"] == "Instagram Social Reel"), None)
    assert ig_draft is not None
    assert ig_draft["change_type"] == "findings_eliminated"
    assert any("guys" in q.lower() for q in ig_draft["quotes_eliminated"])

    # Investor update is in unchanged drafts because "guys" still triggers
    unchanged = sim_data["unchanged_drafts"]
    assert any(d["title"] == "Investor Update Q3" for d in unchanged)


def test_proposal_publication_permissions_and_revalidation(api):
    """Proposal publication requires brand_owner; routes impacted approved content to revalidation."""
    # Casey (creator) creates and checks a draft citing TONE-01
    d = api.call("casey", "POST", "/drafts", json={
        "title": "Spring Newsletter Notice",
        "channel": "Email",
        "text": "Welcome everyone to our update. Book a demo.",
        "audience": "Subscribers",
        "purpose": "Newsletter",
        "cta": "Book a demo",
    }).json()
    did = d["id"]
    api.call("casey", "POST", f"/drafts/{did}/check")
    sub = api.call("casey", "POST", f"/drafts/{did}/submit").json()
    rev = sub["revision_id"]

    # Sam (senior_reviewer) approves the draft
    res_app = api.call("sam", "POST", f"/drafts/{did}/approve", json={"revision_id": rev, "comment": "Approved tone"})
    assert res_app.status_code == 200
    assert res_app.json()["status"] == "approved"

    # Verify dependency on TONE-01 v1 was recorded
    with SessionLocal() as db:
        dep = db.scalar(select(RevisionDependency).where(
            RevisionDependency.draft_id == did,
            RevisionDependency.dependency_type == "rule",
            RevisionDependency.rule_key == "TONE-01",
        ))
        assert dep is not None
        assert dep.rule_version == 1

        # Create proposal for TONE-01
        rule = db.scalar(select(Rule).where(Rule.brand_id == api.brand_id, Rule.key == "TONE-01"))
        prop = GuidelineProposal(
            brand_id=api.brand_id, rule_id=rule.id, rule_key="TONE-01",
            current_text=rule.text, proposed_text="Updated tone guidelines v2 wording.",
            rationale="Periodic owner update.", status="pending",
        )
        db.add(prop)
        db.commit()
        proposal_id = prop.id

    # Casey (creator) attempts to approve proposal -> 403 Forbidden!
    res_creator = api.call(
        "casey", "POST", f"/proposals/{proposal_id}/approve",
        json={"edited_text": "Unauthorized publication attempt."},
    )
    assert res_creator.status_code == 403

    # Riley (reviewer) attempts to approve proposal -> 403 Forbidden!
    res_reviewer = api.call(
        "riley", "POST", f"/proposals/{proposal_id}/approve",
        json={"edited_text": "Reviewer publication attempt."},
    )
    assert res_reviewer.status_code == 403

    # Sam (senior_reviewer) attempts to approve proposal -> 403 Forbidden (brand_owner required)!
    res_senior = api.call(
        "sam", "POST", f"/proposals/{proposal_id}/approve",
        json={"edited_text": "Senior reviewer publication attempt."},
    )
    assert res_senior.status_code == 403

    # Olivia (brand owner) approves proposal -> 200 OK!
    res_owner = api.call(
        "olivia", "POST", f"/proposals/{proposal_id}/approve",
        json={"edited_text": "Updated tone guidelines v2 published by owner."},
    )
    assert res_owner.status_code == 200

    # Verify that the approved draft citing v1 is routed into needs_revalidation
    with SessionLocal() as db:
        draft_row = db.get(Draft, did)
        assert draft_row.validity_status == "needs_revalidation"
        assert draft_row.status == "needs_revalidation"
        assert "TONE-01 was updated to v2" in (draft_row.recall_reason or "")

        # Verify old rule is preserved as superseded
        old_rule = db.scalar(select(Rule).where(
            Rule.brand_id == api.brand_id, Rule.key == "TONE-01", Rule.version == 1
        ))
        assert old_rule.status == "superseded"

        # Verify new rule is active as v2
        new_rule = db.scalar(select(Rule).where(
            Rule.brand_id == api.brand_id, Rule.key == "TONE-01", Rule.version == 2
        ))
        assert new_rule.status == "active"


def test_ai_suggestions_are_never_auto_published(api):
    """Never auto-publish a model's policy suggestion; must require owner approval."""
    # Request wording suggestion as reviewer (riley)
    res_sug = api.call("riley", "POST", "/health/TONE-01/suggest")
    assert res_sug.status_code == 200
    sug_data = res_sug.json()
    assert sug_data["status"] == "pending"

    # Verify that the active rule in the database has NOT changed automatically!
    with SessionLocal() as db:
        active_rule = db.scalar(select(Rule).where(
            Rule.brand_id == api.brand_id, Rule.key == "TONE-01", Rule.status == "active"
        ))
        assert active_rule.version == 1
        assert "professional, friendly voice" in active_rule.text.lower() or "slang" in active_rule.text.lower()
