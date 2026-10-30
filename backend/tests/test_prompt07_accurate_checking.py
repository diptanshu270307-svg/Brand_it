"""Acceptance tests for Prompt 07 — Accurate content checking and explained rewrites.

Tests:
1. Unfamiliar factual claims + span validation against saved draft text
2. Wrong-metric same-number evidence (e.g. downtime 40% vs cost 40%)
3. Missing qualifiers / universal claim overreach (every customer vs enterprise plan)
4. Outdated / expired sources deterministic gate
5. Invented citations (unknown evidence_ref or false quotation)
6. Provider failures (graceful degradation to needs-review while preserving deterministic rules)
7. Stale asynchronous results (re-checks and 409 conflict on obsolete revisions)
"""
from app.llm import LLMProvider, ProviderError, set_provider_override
from conftest import finding


class FaultyProvider(LLMProvider):
    name = "faulty"
    hosted = False

    def analyze(self, ctx: dict) -> dict:
        raise ProviderError("LLM API connection timed out")

    def extract_rules(self, doc_text: str, pages: list[str]) -> dict:
        raise ProviderError("Rule extraction unavailable")

    def suggest_wording(self, rule: dict, overrides: list[dict]) -> dict:
        raise ProviderError("Wording suggestion unavailable")


class InventedCitationProvider(LLMProvider):
    name = "invented_citation"
    hosted = False

    def analyze(self, ctx: dict) -> dict:
        judgements = []
        for c in ctx.get("claims", []):
            judgements.append({
                "claim_ref": c["ref"],
                "evidence_ref": "EV-99999-INVENTED",
                "verdict": "supports",
                "supporting_quote": "This quote was hallucinated and does not exist in any file.",
                "explanation": "Fabricated support.",
                "suggested_replacement": None,
                "dimensions": {},
                "uncertainty": None,
            })
        return {
            "findings": [],
            "extracted_claims": [
                {"quote": "This hallucinated text does not exist in the draft at all.", "kind": "factual"}
            ],
            "claim_judgements": judgements,
        }

    def extract_rules(self, doc_text: str, pages: list[str]) -> dict:
        return {"rules": []}

    def suggest_wording(self, rule: dict, overrides: list[dict]) -> dict:
        return {"proposed_text": "", "rationale": ""}


def test_unfamiliar_factual_claims_and_span_validation(api):
    """Unfamiliar factual claims are extracted and validated; invented spans are rejected."""
    # Create draft with unfamiliar factual claim
    d = api.call("casey", "POST", "/drafts", json={
        "title": "Infrastructure overview",
        "channel": "Blog",
        "text": "Lumina stores customer data in Frankfurt data centers with end-to-end encryption.",
        "audience": "Enterprise CTOs",
        "purpose": "Infrastructure reliability",
        "cta": "Read our whitepaper",
    }).json()

    det = api.call("casey", "POST", f"/drafts/{d['id']}/check").json()

    # Claim is extracted and checked
    f = finding(det, claim=True, contains="Frankfurt")
    assert f is not None
    assert f["is_claim"] is True
    # No approved evidence on file for Frankfurt data centers -> never assumed supported
    assert f["evidence_status"] in ("missing", "needs_review", "insufficient")
    assert f["evidence_status"] != "supported"
    assert f["dimensions"] is not None

    # Now test that invented model spans not in draft text are rejected
    set_provider_override(InventedCitationProvider())
    try:
        det2 = api.call("casey", "POST", f"/drafts/{d['id']}/check").json()
        hallucinated = finding(det2, claim=True, contains="hallucinated")
        assert hallucinated is None
        notes_str = " ".join(det2["analysis"]["notes"])
        assert "Rejected model claim extraction" in notes_str or "Rejected model judgement" in notes_str
    finally:
        set_provider_override(None)


def test_wrong_metric_same_number_evidence_fails(api):
    """Wrong-metric same-number evidence must fail. E.g. downtime 40% != cost 40%."""
    # Upload evidence for hosting cost reduction
    upload_res = api.call("olivia", "POST", "/documents", data={
        "kind": "evidence",
        "title": "2025 Cost Analysis Study",
        "text": "Lumina reduces hosting costs by 40% for cloud infrastructure.",
    }).json()
    doc = upload_res["document"]

    # Register approved evidence for costs
    ev_res = api.call("olivia", "POST", "/evidence", json={
        "document_id": doc["id"],
        "page": 1,
        "claim_text": "Lumina reduces hosting costs by 40%.",
        "excerpt": "Lumina reduces hosting costs by 40% for cloud infrastructure.",
        "owner": "Dana Kim (Finance)",
        "keywords": ["cost", "savings", "hosting"],
    })
    assert ev_res.status_code == 200, ev_res.text
    ev = ev_res.json()
    api.call("olivia", "POST", f"/evidence/{ev['id']}/approve")

    # Author writes a draft asserting system downtime reduction with the same number (40%)
    d = api.call("casey", "POST", "/drafts", json={
        "title": "Reliability Post",
        "channel": "Email",
        "text": "Lumina reduces system downtime by 40%.",
        "audience": "DevOps Leads",
        "purpose": "Promote uptime",
        "cta": "Schedule demo",
    }).json()

    det = api.call("casey", "POST", f"/drafts/{d['id']}/check").json()
    f = finding(det, claim=True, contains="40%")
    assert f is not None

    # Matching the number 40% is NOT enough! Metric concept is downtime vs cost.
    assert f["evidence_status"] in ("insufficient", "needs_review")
    assert f["evidence_status"] != "supported"
    assert f["dimensions"]["metric"]["status"] == "mismatch"
    assert "downtime" in f["dimensions"]["metric"]["note"].lower() or "cost" in f["dimensions"]["metric"]["note"].lower()


def test_missing_qualifiers_universal_claim_fails(api):
    """Universal assertions with qualified evidence must fail for missing qualifiers."""
    # Upload qualified evidence
    upload_res = api.call("olivia", "POST", "/documents", data={
        "kind": "evidence",
        "title": "Enterprise SLA Report",
        "text": "Lumina achieves 99.9% uptime on enterprise plans with dedicated runner clusters.",
    }).json()
    doc = upload_res["document"]

    ev_res = api.call("olivia", "POST", "/evidence", json={
        "document_id": doc["id"],
        "page": 1,
        "claim_text": "Lumina achieves 99.9% uptime on enterprise plans with dedicated runner clusters.",
        "excerpt": "Lumina achieves 99.9% uptime on enterprise plans with dedicated runner clusters.",
        "owner": "Dana Kim (Finance)",
        "keywords": ["uptime", "sla", "enterprise"],
    })
    assert ev_res.status_code == 200, ev_res.text
    ev = ev_res.json()
    api.call("olivia", "POST", f"/evidence/{ev['id']}/approve")

    # Author overreaches with universal assertion: "for every customer"
    d = api.call("casey", "POST", "/drafts", json={
        "title": "Universal Uptime",
        "channel": "Instagram",
        "text": "Lumina achieves 99.9% uptime for every customer.",
        "audience": "General Public",
        "purpose": "Brand awareness",
        "cta": "Sign up",
    }).json()

    det = api.call("casey", "POST", f"/drafts/{d['id']}/check").json()
    f = finding(det, claim=True, contains="99.9%")
    assert f is not None

    # Overreach without qualification must not be supported
    assert f["evidence_status"] != "supported"
    pop_status = f["dimensions"]["population"]["status"]
    qual_status = f["dimensions"]["qualifiers"]["status"]
    assert pop_status == "mismatch" or qual_status == "mismatch"
    assert f["uncertainty"] is not None


def test_outdated_sources_deterministic_gate(api):
    """Deterministic evidence validity gate: expired evidence overrides model and blocks approval."""
    d = api.draft_by("productivity claim")
    det = api.call("casey", "POST", f"/drafts/{d['id']}/check").json()

    f = finding(det, claim=True, contains="40%")
    assert f is not None
    # Deterministic validity gate forces status to expired
    assert f["evidence_status"] == "expired"
    assert f["passport"] is not None
    assert f["passport"]["state"] == "expired"
    assert "expired" in f["explanation"].lower()


def test_invented_citations_rejected_and_degraded(api):
    """Model citing an invented evidence reference or fake quote is rejected and degraded to needs_review."""
    d = api.call("casey", "POST", "/drafts", json={
        "title": "Claims test",
        "channel": "Email",
        "text": "Our platform guarantees 100% secure compliance.",
        "audience": "Enterprise buyers",
        "purpose": "Security",
        "cta": "Book demo",
    }).json()

    set_provider_override(InventedCitationProvider())
    try:
        det = api.call("casey", "POST", f"/drafts/{d['id']}/check").json()
        f = finding(det, claim=True, contains="secure")
        assert f is not None
        assert f["evidence_status"] in ("needs_review", "missing", "insufficient")
        assert f["evidence_status"] != "supported"
        notes_str = " ".join(det["analysis"]["notes"])
        assert "Rejected model judgement" in notes_str or "Rejected model claim extraction" in notes_str
    finally:
        set_provider_override(None)


def test_provider_failures_degrade_safely(api):
    """Provider failure degrades safely to needs-review without discarding deterministic results."""
    d = api.call("casey", "POST", "/drafts", json={
        "title": "Provider crash test",
        "channel": "Instagram",
        "text": "Hey buddy, Lumina delivers 40% higher productivity.\nGame-changing platform!",
        "audience": "Audience",
        "purpose": "Purpose",
        "cta": "CTA",
    }).json()

    set_provider_override(FaultyProvider())
    try:
        r = api.call("casey", "POST", f"/drafts/{d['id']}/check")
        assert r.status_code == 200
        det = r.json()

        # Deterministic terminology check (TONE-01 for "buddy") is preserved!
        buddy_finding = finding(det, "TONE-01")
        assert buddy_finding is not None
        assert "buddy" in buddy_finding["quote"].lower()

        # Claims are NOT crashed or assumed supported; they degrade safely
        claim_findings = [f for f in det["findings"] if f["is_claim"]]
        assert len(claim_findings) > 0
        for cf in claim_findings:
            assert cf["evidence_status"] in ("needs_review", "expired", "missing", "insufficient")
            assert cf["evidence_status"] != "supported"

        # Pipeline notes record provider failure
        notes = det["analysis"]["notes"]
        assert any("ProviderError" in n or "unavailable" in n for n in notes)
    finally:
        set_provider_override(None)


def test_stale_asynchronous_results_rejected_with_409(api):
    """Applying a suggestion from a stale finding or outdated revision raises 409 conflict."""
    d = api.draft_by("productivity claim")
    det1 = api.call("casey", "POST", f"/drafts/{d['id']}/check").json()

    # Find a finding with a suggested fix (e.g. CLAIM-01 for "guarantees")
    f_fix = next(f for f in det1["findings"] if f["suggestion"] is not None)
    rev1_finding_id = f_fix["id"]

    # Author makes a manual edit, advancing to Revision 2
    api.call("casey", "PUT", f"/drafts/{d['id']}", json={
        "text": "LuminaFlow guarantees 40% higher productivity for ops teams.\nUpdated draft.",
        "audience": "Audience",
        "purpose": "Purpose",
        "cta": "CTA",
    })

    # Now attempt to apply the finding from Revision 1
    res = api.call("casey", "POST", f"/drafts/{d['id']}/findings/{rev1_finding_id}/accept", json={"confirm_protected": True})
    assert res.status_code == 409
    assert "older revision" in res.json().get("detail", "").lower() or "no longer matches" in res.json().get("detail", "").lower()

    # Recheck Revision 2 to get fresh findings
    det2 = api.call("casey", "POST", f"/drafts/{d['id']}/check").json()
    fresh_fix = next(f for f in det2["findings"] if f["suggestion"] is not None)

    # Applying the fresh finding succeeds and automatically rechecks
    res_ok = api.call("casey", "POST", f"/drafts/{d['id']}/findings/{fresh_fix['id']}/accept", json={"confirm_protected": True})
    assert res_ok.status_code == 200
    det3 = res_ok.json()
    assert det3["revision"] == det2["revision"] + 1  # Created a new revision
    assert det3["analysis"] is not None  # Rechecked post-edit
