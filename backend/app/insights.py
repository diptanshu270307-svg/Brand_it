"""Insights + Guideline Health. History from the seed is labelled `seeded` and reported separately."""
from collections import Counter, defaultdict
import math

from fastapi import HTTPException
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .analysis.schemas import WordingSuggestion
from .config import get_settings
from .library import scan_suspicious
from .llm import ProviderError, get_provider
from .models import (Analysis, Draft, Finding, GuidelineProposal, Rule, RuleEvent, User, utcnow)
from .security import audit


class ChannelConditionIn(BaseModel):
    """Explicit channel condition represented as validated data, never executable code."""
    channel: str = Field(..., min_length=1, max_length=60)
    action: str = Field(default="allow", pattern=r"^(allow|exempt|restrict|prohibit)$")
    reason: str | None = Field(default="", max_length=300)
    patterns: list[str] = Field(default_factory=list)


def _latest_analysis_ids(db: Session, brand_id: int) -> list[int]:
    sub = (select(func.max(Analysis.id)).join(Draft, Draft.id == Analysis.draft_id)
           .where(Draft.brand_id == brand_id).group_by(Analysis.draft_id))
    return list(db.scalars(sub))


def compute_uncertainty(overrides: int, decisions: int, min_sample: int = 5) -> dict:
    if decisions < min_sample:
        return {
            "insufficient_history": True,
            "uncertainty_label": f"Insufficient sample size (n = {decisions} < {min_sample}) to infer guideline friction",
            "confidence_interval": None,
        }
    p = overrides / decisions if decisions else 0.0
    se = math.sqrt(p * (1.0 - p) / decisions) if decisions else 0.0
    low = round(max(0.0, p - 1.96 * se), 2)
    high = round(min(1.0, p + 1.96 * se), 2)
    return {
        "insufficient_history": False,
        "uncertainty_label": f"Sample size n = {decisions} · 95% CI [{int(low * 100)}%, {int(high * 100)}%]",
        "confidence_interval": {"low": low, "high": high},
    }


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

    all_rules = list(db.scalars(select(Rule).where(Rule.brand_id == brand_id)))
    active_rules = {r.key: r for r in all_rules if r.status == "active"}
    proposals = list(db.scalars(select(GuidelineProposal).where(GuidelineProposal.brand_id == brand_id).order_by(GuidelineProposal.id.desc())))
    out = []

    # Iterate over all rules that have active status or recorded events
    rule_keys = set(active_rules.keys()) | set(by_key.keys())
    for key in rule_keys:
        rule = active_rules.get(key)
        if not rule:
            # Look up most recent rule record if none active
            matching_rules = sorted([r for r in all_rules if r.key == key], key=lambda x: x.version)
            if not matching_rules:
                continue
            rule = matching_rules[-1]

        evs = by_key.get(key, [])
        all_over = [e for e in evs if e.kind == "overridden"]
        all_acc = [e for e in evs if e.kind == "accepted"]

        # Only report rules that have recorded overrides or decisions
        if not all_over and not all_acc and rule.status != "active":
            continue

        # Group events by version so v1/v2 statistics remain separate
        events_by_version = defaultdict(list)
        for e in evs:
            events_by_version[e.rule_version or 1].append(e)

        # Version breakdown across all versions
        version_breakdown = []
        rule_versions = sorted([r for r in all_rules if r.key == key], key=lambda x: x.version)
        for rv in rule_versions:
            v_evs = events_by_version[rv.version]
            v_over = [e for e in v_evs if e.kind == "overridden"]
            v_acc = [e for e in v_evs if e.kind == "accepted"]
            v_dec = len(v_over) + len(v_acc)
            version_breakdown.append({
                "version": rv.version,
                "status": rv.status,
                "overrides": len(v_over),
                "accepted": len(v_acc),
                "decisions": v_dec,
                "override_rate": round(len(v_over) / v_dec, 2) if v_dec else None,
                "live_overrides": sum(1 for e in v_over if not e.seeded),
                "seeded_overrides": sum(1 for e in v_over if e.seeded),
                "live_accepted": sum(1 for e in v_acc if not e.seeded),
                "seeded_accepted": sum(1 for e in v_acc if e.seeded),
                "insufficient_history": v_dec < min_sample,
            })

        # Outcomes by content channel
        by_channel = defaultdict(lambda: {"overrides": 0, "accepted": 0, "live_overrides": 0, "seeded_overrides": 0})
        for e in evs:
            ch = e.channel or "Unspecified"
            if e.kind == "overridden":
                by_channel[ch]["overrides"] += 1
                if e.seeded:
                    by_channel[ch]["seeded_overrides"] += 1
                else:
                    by_channel[ch]["live_overrides"] += 1
            elif e.kind == "accepted":
                by_channel[ch]["accepted"] += 1

        outcomes_by_channel = {}
        for ch, stats in by_channel.items():
            tot = stats["overrides"] + stats["accepted"]
            outcomes_by_channel[ch] = {
                **stats,
                "decisions": tot,
                "override_rate": round(stats["overrides"] / tot, 2) if tot else None,
            }

        # Active version outcomes (or latest if none active)
        curr_evs = events_by_version[rule.version]
        curr_over = [e for e in curr_evs if e.kind == "overridden"]
        curr_acc = [e for e in curr_evs if e.kind == "accepted"]
        curr_decisions = len(curr_over) + len(curr_acc)
        curr_rate = round(len(curr_over) / curr_decisions, 2) if curr_decisions else None

        # Statistical uncertainty for active version
        uncert = compute_uncertainty(len(curr_over), curr_decisions, min_sample)

        reasons = Counter(e.reason.strip() for e in (curr_over or all_over) if e.reason.strip())
        prop = next((p for p in proposals if p.rule_key == key and p.status == "pending"), None)

        out.append({
            "rule_key": key,
            "rule_id": rule.id,
            "version": rule.version,
            "title": rule.title,
            "category": rule.category,
            "rule_text": rule.text,
            "channel_conditions": rule.channel_conditions or [],
            "exempt_channels": rule.exempt_channels or [],
            # Active version statistics
            "overrides": len(curr_over),
            "accepted": len(curr_acc),
            "decisions": curr_decisions,
            "override_rate": curr_rate,
            "seeded_overrides": sum(1 for e in curr_over if e.seeded),
            "live_overrides": sum(1 for e in curr_over if not e.seeded),
            # All-time / aggregated statistics for historical context
            "all_time_overrides": len(all_over),
            "all_time_decisions": len(all_over) + len(all_acc),
            "all_time_seeded_overrides": sum(1 for e in all_over if e.seeded),
            "all_time_live_overrides": sum(1 for e in all_over if not e.seeded),
            # Uncertainty metrics
            "insufficient_history": uncert["insufficient_history"],
            "uncertainty_label": uncert["uncertainty_label"],
            "confidence_interval": uncert["confidence_interval"],
            "min_sample": min_sample,
            # Qualitative review reasons and examples
            "reasons": [{"reason": r, "count": c} for r, c in reasons.most_common(5)],
            "examples": [{"excerpt": e.excerpt, "reason": e.reason, "channel": e.channel, "rule_version": e.rule_version, "seeded": e.seeded} for e in (curr_over or all_over)[-3:]],
            "outcomes_by_channel": outcomes_by_channel,
            "version_breakdown": version_breakdown,
            "proposal": proposal_view(prop) if prop else None,
        })

    out.sort(key=lambda x: -x["all_time_overrides"])
    return out


def proposal_view(p: GuidelineProposal) -> dict:
    return {
        "id": p.id,
        "rule_key": p.rule_key,
        "current_text": p.current_text,
        "proposed_text": p.proposed_text,
        "rationale": p.rationale,
        "override_count": p.override_count,
        "channel_conditions": p.channel_conditions or [],
        "proposed_matchers": p.proposed_matchers or [],
        "status": p.status,
        "created_at": p.created_at.isoformat(),
        "new_rule_id": p.new_rule_id,
    }


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


def simulate_proposal_evaluation(
    db: Session,
    brand_id: int,
    rule_key: str,
    proposed_text: str,
    channel_conditions: list[dict] | None = None,
    proposed_matchers: list[dict] | None = None,
) -> dict:
    """Evaluate candidate rule wording and explicit channel conditions against real saved drafts."""
    from .analysis.pipeline import run_matchers
    from .service import current_revision

    active_rule = db.scalar(select(Rule).where(Rule.brand_id == brand_id, Rule.key == rule_key, Rule.status == "active"))
    val_conditions = []
    exempt_channels = []
    for c in (channel_conditions or []):
        cond = ChannelConditionIn.model_validate(c).model_dump()
        val_conditions.append(cond)
        if cond["action"] in ("allow", "exempt"):
            exempt_channels.append(cond["channel"])
    exempt_channels = sorted(list(set(exempt_channels)))

    # Prepare matchers
    if proposed_matchers is not None:
        val_matchers = proposed_matchers
    else:
        val_matchers = []
        for m in (active_rule.matchers if active_rule else []):
            m_copy = dict(m)
            ex = set(m_copy.get("exempt_channels") or [])
            ex.update(exempt_channels)
            m_copy["exempt_channels"] = sorted(list(ex))
            val_matchers.append(m_copy)

    candidate_rule = Rule(
        brand_id=brand_id,
        key=rule_key,
        version=(active_rule.version + 1) if active_rule else 1,
        status="active",
        title=active_rule.title if active_rule else rule_key,
        category=active_rule.category if active_rule else "general",
        severity=active_rule.severity if active_rule else "medium",
        text=proposed_text,
        matchers=val_matchers,
        exempt_channels=exempt_channels,
        channel_conditions=val_conditions,
    )

    drafts = list(db.scalars(select(Draft).where(Draft.brand_id == brand_id)).all())
    changed_drafts = []
    unchanged_drafts = []
    findings_eliminated_count = 0
    findings_added_count = 0

    for d in drafts:
        rev = current_revision(db, d)
        if not rev or not rev.text:
            continue
        ch = d.channel or ""
        curr_hits = []
        if active_rule:
            curr_hits = [f for f in run_matchers(rev.text, [active_rule], channel=ch) if f.rule and f.rule.key == rule_key]
        cand_hits = [f for f in run_matchers(rev.text, [candidate_rule], channel=ch) if f.rule and f.rule.key == rule_key]

        curr_quotes = [f.quote for f in curr_hits]
        cand_quotes = [f.quote for f in cand_hits]

        if len(curr_hits) > len(cand_hits):
            diff = len(curr_hits) - len(cand_hits)
            findings_eliminated_count += diff
            eliminated = [q for q in curr_quotes if q not in cand_quotes]
            changed_drafts.append({
                "draft_id": d.id,
                "title": d.title,
                "channel": d.channel or "Unspecified",
                "status": d.status,
                "change_type": "findings_eliminated",
                "findings_diff": -diff,
                "current_count": len(curr_hits),
                "proposed_count": len(cand_hits),
                "quotes_eliminated": eliminated,
            })
        elif len(curr_hits) < len(cand_hits):
            diff = len(cand_hits) - len(curr_hits)
            findings_added_count += diff
            added = [q for q in cand_quotes if q not in curr_quotes]
            changed_drafts.append({
                "draft_id": d.id,
                "title": d.title,
                "channel": d.channel or "Unspecified",
                "status": d.status,
                "change_type": "findings_added",
                "findings_diff": diff,
                "current_count": len(curr_hits),
                "proposed_count": len(cand_hits),
                "quotes_added": added,
            })
        elif curr_quotes != cand_quotes:
            changed_drafts.append({
                "draft_id": d.id,
                "title": d.title,
                "channel": d.channel or "Unspecified",
                "status": d.status,
                "change_type": "findings_modified",
                "findings_diff": 0,
                "current_count": len(curr_hits),
                "proposed_count": len(cand_hits),
            })
        else:
            unchanged_drafts.append({
                "draft_id": d.id,
                "title": d.title,
                "channel": d.channel or "Unspecified",
                "status": d.status,
                "findings_count": len(curr_hits),
            })

    return {
        "rule_key": rule_key,
        "sample_size": len(drafts),
        "drafts_evaluated": len(drafts),
        "changed_count": len(changed_drafts),
        "unchanged_count": len(unchanged_drafts),
        "findings_eliminated_count": findings_eliminated_count,
        "findings_added_count": findings_added_count,
        "changed_drafts": changed_drafts,
        "unchanged_drafts": unchanged_drafts,
        "channel_conditions": val_conditions,
    }


def decide_proposal(
    db: Session,
    brand_id: int,
    proposal_id: int,
    user: User,
    approve: bool,
    edited_text: str | None = None,
    channel_conditions: list[dict] | None = None,
    proposed_matchers: list[dict] | None = None,
) -> GuidelineProposal:
    p = db.get(GuidelineProposal, proposal_id)
    if not p or p.brand_id != brand_id:
        raise HTTPException(404, "Proposal not found")
    if p.status != "pending":
        raise HTTPException(409, f"Proposal already {p.status}")
    p.status, p.decided_by, p.decided_at = ("approved" if approve else "rejected"), user.id, utcnow()
    if approve:
        old = db.get(Rule, p.rule_id)
        if not old:
            raise HTTPException(404, "Target rule not found")
        text = (edited_text or p.proposed_text).strip()
        if len(text) < 10:
            raise HTTPException(422, "Rule text too short")

        val_conditions = []
        exempt_channels = []
        conds_input = channel_conditions if channel_conditions is not None else (p.channel_conditions or [])
        for c in conds_input:
            cond = ChannelConditionIn.model_validate(c).model_dump()
            val_conditions.append(cond)
            if cond["action"] in ("allow", "exempt"):
                exempt_channels.append(cond["channel"])
        exempt_channels = sorted(list(set(exempt_channels)))

        # Update matching logic explicitly; do not silently copy unchanged matchers
        if proposed_matchers is not None:
            final_matchers = proposed_matchers
        else:
            final_matchers = []
            for m in (old.matchers or []):
                m_copy = dict(m)
                ex = set(m_copy.get("exempt_channels") or [])
                ex.update(exempt_channels)
                m_copy["exempt_channels"] = sorted(list(ex))
                final_matchers.append(m_copy)

        old.status = "superseded"
        new = Rule(
            brand_id=brand_id,
            key=old.key,
            version=old.version + 1,
            status="active",
            title=old.title,
            category=old.category,
            severity=old.severity,
            text=text,
            sensitive=old.sensitive,
            matchers=final_matchers,
            exempt_channels=exempt_channels,
            channel_conditions=val_conditions,
            claim_kind=old.claim_kind,
            source_document_id=old.source_document_id,
            source_page=old.source_page,
            source_excerpt=text,
            approved_by=user.id,
        )
        db.add(new)
        db.flush()
        p.new_rule_id = new.id
        p.channel_conditions = val_conditions
        p.proposed_matchers = final_matchers

        # Route impacted approvals into the revalidation workflow
        from . import service as svc
        svc.process_evidence_recall(db, brand_id)

    audit(db, brand_id, user.id, "proposal_approved" if approve else "proposal_rejected", None,
          {"proposal": p.id, "rule": p.rule_key})
    return p
