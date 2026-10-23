"""Insights + Guideline Health. History from the seed is labelled `seeded` and reported separately."""
from collections import Counter, defaultdict

from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .analysis.schemas import WordingSuggestion
from .config import get_settings
from .library import scan_suspicious
from .llm import ProviderError, get_provider
from .models import (Analysis, Draft, Finding, GuidelineProposal, Rule, RuleEvent, User, utcnow)
from .security import audit


def _latest_analysis_ids(db: Session, brand_id: int) -> list[int]:
    sub = (select(func.max(Analysis.id)).join(Draft, Draft.id == Analysis.draft_id)
           .where(Draft.brand_id == brand_id).group_by(Analysis.draft_id))
    return list(db.scalars(sub))


def insights(db: Session, brand_id: int) -> dict:
    ids = _latest_analysis_ids(db, brand_id)
    findings = list(db.scalars(select(Finding).where(Finding.analysis_id.in_(ids)))) if ids else []
    real = Counter(f.rule_key for f in findings if f.rule_key and f.severity != "info")
    events = list(db.scalars(select(RuleEvent).where(RuleEvent.brand_id == brand_id)))
    seeded_flagged = Counter(e.rule_key for e in events if e.kind == "flagged" and e.seeded)
    rules = {r.key: r for r in db.scalars(select(Rule).where(Rule.brand_id == brand_id, Rule.status == "active"))}
    recurring = []
    for key in set(real) | set(seeded_flagged):
        r = rules.get(key)
        recurring.append({"rule_key": key, "title": r.title if r else key, "category": r.category if r else "",
                          "live_count": real[key], "seeded_count": seeded_flagged[key],
                          "total": real[key] + seeded_flagged[key]})
    recurring.sort(key=lambda x: -x["total"])

    claim_status = Counter(f.evidence_status for f in findings if f.is_claim)
    drafts = Counter(d.status for d in db.scalars(select(Draft).where(Draft.brand_id == brand_id)))
    return {"recurring_issues": recurring, "claim_evidence_status": dict(claim_status), "drafts_by_status": dict(drafts),
            "note": "Seeded history is sample data included with the demo and is counted separately from live checks.",
            "health": guideline_health(db, brand_id)}


def guideline_health(db: Session, brand_id: int) -> list[dict]:
    min_sample = get_settings().min_health_sample
    events = list(db.scalars(select(RuleEvent).where(RuleEvent.brand_id == brand_id).order_by(RuleEvent.id)))
    by_key = defaultdict(list)
    for e in events:
        by_key[e.rule_key].append(e)
    rules = {r.key: r for r in db.scalars(select(Rule).where(Rule.brand_id == brand_id, Rule.status == "active"))}
    proposals = list(db.scalars(select(GuidelineProposal).where(GuidelineProposal.brand_id == brand_id).order_by(GuidelineProposal.id.desc())))
    out = []
    for key, evs in by_key.items():
        rule = rules.get(key)
        if not rule:
            continue
        over = [e for e in evs if e.kind == "overridden"]
        acc = [e for e in evs if e.kind == "accepted"]
        decisions = len(over) + len(acc)
        if not over:
            continue
        reasons = Counter(e.reason.strip() for e in over if e.reason.strip())
        prop = next((p for p in proposals if p.rule_key == key and p.status == "pending"), None)
        out.append({
            "rule_key": key, "rule_id": rule.id, "version": rule.version, "title": rule.title, "category": rule.category,
            "rule_text": rule.text, "overrides": len(over), "accepted": len(acc), "decisions": decisions,
            "override_rate": round(len(over) / decisions, 2) if decisions else None,
            "seeded_overrides": sum(1 for e in over if e.seeded), "live_overrides": sum(1 for e in over if not e.seeded),
            "insufficient_history": len(over) < min_sample, "min_sample": min_sample,
            "reasons": [{"reason": r, "count": c} for r, c in reasons.most_common(5)],
            "examples": [{"excerpt": e.excerpt, "reason": e.reason, "seeded": e.seeded} for e in over[-3:]],
            "proposal": proposal_view(prop) if prop else None,
        })
    out.sort(key=lambda x: -x["overrides"])
    return out


def proposal_view(p: GuidelineProposal) -> dict:
    return {"id": p.id, "rule_key": p.rule_key, "current_text": p.current_text, "proposed_text": p.proposed_text,
            "rationale": p.rationale, "override_count": p.override_count, "status": p.status,
            "created_at": p.created_at.isoformat()}


def suggest_clearer_wording(db: Session, brand_id: int, rule_key: str, user: User) -> GuidelineProposal:
    rule = db.scalar(select(Rule).where(Rule.brand_id == brand_id, Rule.key == rule_key, Rule.status == "active"))
    if not rule:
        raise HTTPException(404, "Rule not found")
    over = list(db.scalars(select(RuleEvent).where(RuleEvent.brand_id == brand_id, RuleEvent.rule_key == rule_key,
                                                   RuleEvent.kind == "overridden").order_by(RuleEvent.id.desc()).limit(30)))
    if not over:
        raise HTTPException(409, "No overrides recorded for this rule")
    existing = db.scalar(select(GuidelineProposal).where(GuidelineProposal.rule_id == rule.id, GuidelineProposal.status == "pending"))
    if existing:
        return existing
    try:
        raw = get_provider().suggest_wording(
            {"key": rule.key, "title": rule.title, "text": rule.text},
            [{"reason": e.reason, "excerpt": e.excerpt} for e in over])
        s = WordingSuggestion.model_validate(raw)
    except (ProviderError, ValidationError, Exception):  # noqa: BLE001
        raise HTTPException(502, "Could not generate a wording suggestion right now")
    if scan_suspicious([s.proposed_text, s.rationale]):
        raise HTTPException(502, "Suggestion was rejected because it contained instruction-like text")
    p = GuidelineProposal(brand_id=brand_id, rule_id=rule.id, rule_key=rule.key, current_text=rule.text,
                          proposed_text=s.proposed_text, rationale=s.rationale, override_count=len(over))
    db.add(p)
    db.flush()
    audit(db, brand_id, user.id, "wording_suggested", None, {"rule": rule.key, "proposal": p.id, "overrides": len(over)})
    return p


def decide_proposal(db: Session, brand_id: int, proposal_id: int, user: User, approve: bool, edited_text: str | None) -> GuidelineProposal:
    p = db.get(GuidelineProposal, proposal_id)
    if not p or p.brand_id != brand_id:
        raise HTTPException(404, "Proposal not found")
    if p.status != "pending":
        raise HTTPException(409, f"Proposal already {p.status}")
    p.status, p.decided_by, p.decided_at = ("approved" if approve else "rejected"), user.id, utcnow()
    if approve:
        old = db.get(Rule, p.rule_id)
        text = (edited_text or p.proposed_text).strip()
        if len(text) < 10:
            raise HTTPException(422, "Rule text too short")
        old.status = "superseded"
        new = Rule(brand_id=brand_id, key=old.key, version=old.version + 1, status="active", title=old.title,
                   category=old.category, severity=old.severity, text=text, sensitive=old.sensitive,
                   matchers=old.matchers, claim_kind=old.claim_kind, source_document_id=None, source_page=None,
                   source_excerpt=text, approved_by=user.id)
        db.add(new)
        db.flush()
        p.new_rule_id = new.id
    audit(db, brand_id, user.id, "proposal_approved" if approve else "proposal_rejected", None,
          {"proposal": p.id, "rule": p.rule_key})
    return p
