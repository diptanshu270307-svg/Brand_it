"""Workflow + serialisation. All approval gates are enforced here (server side)."""
from datetime import date

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .analysis.evidence import effective_expiry, evidence_state
from .analysis.pipeline import SEV, compute_route, run_analysis
from .models import (Analysis, Brand, Disposition, Draft, DraftRevision, EvidenceRecord, Finding, Membership,
                     ReviewDecision, Rule, RuleEvent, User, utcnow)
from .security import REVIEW_ROLES, audit


# ---------------------------------------------------------------- helpers
def get_draft(db: Session, brand_id: int, draft_id: int, m: Membership) -> Draft:
    d = db.get(Draft, draft_id)
    if not d or d.brand_id != brand_id:
        raise HTTPException(404, "Draft not found")
    if m.role == "creator" and d.author_id != m.user_id:
        raise HTTPException(404, "Draft not found")  # creators only see their own drafts
    return d


def current_revision(db: Session, d: Draft) -> DraftRevision:
    return db.get(DraftRevision, d.current_revision_id)


def latest_analysis(db: Session, d: Draft) -> Analysis | None:
    return db.scalar(select(Analysis).where(Analysis.draft_id == d.id, Analysis.revision_id == d.current_revision_id)
                     .order_by(Analysis.id.desc()))


def disposition_map(db: Session, draft_id: int) -> dict[str, Disposition]:
    return {x.fingerprint: x for x in db.scalars(select(Disposition).where(Disposition.draft_id == draft_id))}


def findings_of(db: Session, analysis: Analysis | None) -> list[Finding]:
    if not analysis:
        return []
    return list(db.scalars(select(Finding).where(Finding.analysis_id == analysis.id).order_by(Finding.start, Finding.id)))


def hash_len(text: str) -> dict:
    import hashlib

    return {"chars": len(text), "sha256_12": hashlib.sha256(text.encode()).hexdigest()[:12]}


# ---------------------------------------------------------------- revisions
def create_revision(db: Session, d: Draft, user: User, text: str, audience: str, purpose: str, cta: str, note: str) -> DraftRevision:
    n = (db.scalar(select(func.max(DraftRevision.number)).where(DraftRevision.draft_id == d.id)) or 0) + 1
    rev = DraftRevision(draft_id=d.id, number=n, text=text, audience=audience, purpose=purpose, cta=cta,
                        edit_note=note, created_by=user.id)
    db.add(rev)
    db.flush()
    previously_approved = d.approved_revision_id is not None
    d.current_revision_id = rev.id
    d.status, d.route, d.updated_at = "draft", None, utcnow()
    if previously_approved:
        db.add(ReviewDecision(draft_id=d.id, revision_id=rev.id, user_id=user.id, kind="approval_invalidated",
                              body=f"Approval of an earlier revision was invalidated by edit (revision {n})."))
        audit(db, d.brand_id, user.id, "approval_invalidated", d.id, {"new_revision": n})
        d.approved_revision_id = None
    audit(db, d.brand_id, user.id, "revision_created", d.id, {"revision": n, **hash_len(text), "note": note[:80]})
    return rev


def run_check(db: Session, d: Draft, user: User | None, triggered_by: str) -> Analysis:
    rev = current_revision(db, d)
    a = run_analysis(db, d, rev, triggered_by=triggered_by)
    fs = findings_of(db, a)
    if d.status in ("draft", "checked", "changes_requested"):
        d.status = "checked"
    d.updated_at = utcnow()
    counts = {}
    for f in fs:
        counts[f.severity] = counts.get(f.severity, 0) + 1
    audit(db, d.brand_id, user.id if user else None, "check_run", d.id,
          {"analysis": a.id, "revision": rev.number, "trigger": triggered_by, "provider": a.provider,
           "findings": len(fs), "by_severity": counts, "rules": a.rule_versions})
    return a


# ---------------------------------------------------------------- gates
def blockers_for(analysis: Analysis | None, findings: list[Finding], disp: dict[str, Disposition], revision_id: int) -> list[dict]:
    out: list[dict] = []
    if analysis is None or analysis.revision_id != revision_id:
        return [{"code": "stale_analysis", "message": "Checks have not been run on the current revision."}]
    for f in findings:
        if f.is_claim:
            if f.evidence_status != "supported":
                out.append({"code": f"claim_{f.evidence_status}", "finding_id": f.id,
                            "message": f"Claim \u201c{f.quote[:70]}\u201d has {f.evidence_status.replace('_', ' ')} evidence."})
            continue
        d = disp.get(f.fingerprint)
        if d is None and SEV.get(f.severity, 0) >= SEV["medium"]:
            out.append({"code": "unresolved_finding", "finding_id": f.id,
                        "message": f"{f.rule_key or f.category}: \u201c{f.quote[:60]}\u201d is unresolved ({f.severity})."})
    return out


# ---------------------------------------------------------------- serialisation
def passport(e: EvidenceRecord | None, today: date | None = None) -> dict | None:
    if not e:
        return None
    d = e.source_document
    exp = effective_expiry(e)
    return {"id": e.id, "ref": e.ref, "claim_text": e.claim_text, "excerpt": e.excerpt, "page": e.page,
            "document": {"id": d.id, "title": d.title, "version": d.version, "kind": d.kind},
            "owner": e.owner, "valid_from": e.valid_from.isoformat() if e.valid_from else None,
            "valid_until": exp.isoformat() if exp else None, "approval_status": e.status,
            "state": evidence_state(e, today)}


def finding_view(f: Finding, disp: dict[str, Disposition], users: dict[int, str]) -> dict:
    d = disp.get(f.fingerprint)
    return {
        "id": f.id, "fingerprint": f.fingerprint, "origin": f.origin, "category": f.category, "severity": f.severity,
        "start": f.start, "end": f.end, "quote": f.quote, "explanation": f.explanation,
        "rule": ({"id": f.rule_id, "key": f.rule_key, "version": f.rule_version} if f.rule_key else None),
        "source_excerpt": f.source_excerpt, "source_ref": f.source_ref, "is_claim": f.is_claim,
        "evidence_status": f.evidence_status, "needs_review": f.needs_review, "sensitive": f.sensitive,
        "suggestion": ({"original": f.suggestion_original, "replacement": f.suggestion_replacement,
                        "protected_flags": f.protected_flags or [], "requires_confirmation": bool(f.protected_flags)}
                       if f.suggestion_replacement is not None else None),
        "disposition": ({"action": d.action, "reason": d.reason, "by": users.get(d.user_id, "?"),
                         "at": d.created_at.isoformat()} if d else None),
        "passport": passport(f.evidence),
    }


def draft_summary(db: Session, d: Draft) -> dict:
    rev = current_revision(db, d)
    return {"id": d.id, "title": d.title, "channel": d.channel, "status": d.status, "route": d.route,
            "author": d.author.name, "author_id": d.author_id, "seeded": d.seeded,
            "revision": rev.number if rev else 0, "updated_at": d.updated_at.isoformat()}


def draft_detail(db: Session, d: Draft, m: Membership) -> dict:
    rev = current_revision(db, d)
    analysis = latest_analysis(db, d)
    fs = findings_of(db, analysis)
    disp = disposition_map(db, d.id)
    uids = {x.user_id for x in disp.values()} | {x.created_by for x in db.scalars(select(DraftRevision).where(DraftRevision.draft_id == d.id))}
    users = {u.id: u.name for u in db.scalars(select(User).where(User.id.in_(uids)))} if uids else {}
    blockers = blockers_for(analysis, fs, disp, rev.id)
    route = compute_route(fs, disp) if analysis else None
    revisions = list(db.scalars(select(DraftRevision).where(DraftRevision.draft_id == d.id).order_by(DraftRevision.number)))
    s = draft_summary(db, d)
    s.update({
        "revision_id": rev.id, "text": rev.text, "audience": rev.audience, "purpose": rev.purpose, "cta": rev.cta,
        "approved_revision_id": d.approved_revision_id,
        "revisions": [{"id": r.id, "number": r.number, "note": r.edit_note, "at": r.created_at.isoformat(),
                       "by": users.get(r.created_by) or db.get(User, r.created_by).name} for r in revisions],
        "analysis": ({"id": analysis.id, "at": analysis.created_at.isoformat(), "provider": analysis.provider,
                      "rule_versions": analysis.rule_versions, "source_versions": analysis.source_versions,
                      "notes": analysis.notes, "triggered_by": analysis.triggered_by} if analysis else None),
        "findings": [finding_view(f, disp, users) for f in fs],
        "computed_route": route, "blockers": blockers,
        "can_edit": m.user_id == d.author_id,
        "can_review": m.role in REVIEW_ROLES and m.user_id != d.author_id and d.status in ("in_review", "senior_review"),
        "role": m.role,
    })
    return s


# ---------------------------------------------------------------- actions
def submit(db: Session, d: Draft, user: User, m: Membership) -> None:
    if d.author_id != user.id:
        raise HTTPException(403, "Only the author can submit a draft for review")
    if d.status not in ("checked",):
        raise HTTPException(409, f"Draft must be in 'checked' state to submit (currently '{d.status}'). Run checks first.")
    a = latest_analysis(db, d)
    if not a:
        raise HTTPException(409, "Run checks on the current revision before submitting")
    fs, disp = findings_of(db, a), disposition_map(db, d.id)
    d.route = compute_route(fs, disp)
    d.status = "senior_review" if d.route == "senior" else "in_review"
    d.updated_at = utcnow()
    db.add(ReviewDecision(draft_id=d.id, revision_id=d.current_revision_id, user_id=user.id, kind="submitted",
                          body=f"Submitted for {d.route} review.", route=d.route))
    audit(db, d.brand_id, user.id, "submitted", d.id, {"route": d.route, "analysis": a.id,
                                                       "open_blockers": len(blockers_for(a, fs, disp, d.current_revision_id))})


def request_changes(db: Session, d: Draft, user: User, m: Membership, reason: str) -> None:
    if m.role not in REVIEW_ROLES or user.id == d.author_id:
        raise HTTPException(403, "Only a reviewer (not the author) can request changes")
    if d.status not in ("in_review", "senior_review"):
        raise HTTPException(409, "Draft is not awaiting review")
    if d.route == "senior" and m.role != "senior_reviewer":
        raise HTTPException(403, "This draft is on the senior-review route")
    if len((reason or "").strip()) < 3:
        raise HTTPException(422, "A reason is required")
    d.status, d.updated_at = "changes_requested", utcnow()
    db.add(ReviewDecision(draft_id=d.id, revision_id=d.current_revision_id, user_id=user.id,
                          kind="changes_requested", body=reason.strip(), route=d.route))
    audit(db, d.brand_id, user.id, "changes_requested", d.id, {"reason_chars": len(reason)})


def approve(db: Session, d: Draft, user: User, m: Membership, revision_id: int, comment: str) -> None:
    """Backend approval gate. Every failure is audited; checks are re-run before deciding."""

    def deny(status: int, code: str, message: str, extra: dict | None = None):
        audit(db, d.brand_id, user.id, "approval_denied", d.id, {"code": code, **(extra or {})})
        db.commit()
        raise HTTPException(status, {"code": code, "message": message, **(extra or {})})

    if m.role not in REVIEW_ROLES:
        deny(403, "role_not_permitted", f"Role '{m.role}' cannot approve drafts.")
    if user.id == d.author_id:
        deny(403, "self_approval", "Authors cannot approve their own drafts.")
    if d.status not in ("in_review", "senior_review"):
        deny(409, "not_in_review", f"Draft is '{d.status}', not awaiting review.")
    if revision_id != d.current_revision_id:
        deny(409, "stale_revision", "The draft changed after you opened it. Reload and review the current revision.")
    if len((comment or "").strip()) < 3:
        deny(422, "reason_required", "A reason/comment is required to approve.")

    # Re-run checks on the exact revision being approved.
    a = run_check(db, d, user, "pre_approval")
    fs, disp = findings_of(db, a), disposition_map(db, d.id)
    route = compute_route(fs, disp)
    if route == "senior" and d.route != "senior":
        d.route, d.status = "senior", "senior_review"
    if route == "senior" and m.role != "senior_reviewer":
        deny(403, "senior_required", "This draft involves sensitive or unresolved claims and needs a senior reviewer.",
             {"route": route})
    d.status = "senior_review" if d.route == "senior" else "in_review"  # run_check must not demote review state
    blockers = blockers_for(a, fs, disp, d.current_revision_id)
    if blockers:
        deny(409, "approval_blocked", f"{len(blockers)} issue(s) block approval.", {"blockers": blockers})

    d.status, d.approved_revision_id, d.updated_at = "approved", d.current_revision_id, utcnow()
    db.add(ReviewDecision(draft_id=d.id, revision_id=d.current_revision_id, user_id=user.id, kind="approved",
                          body=comment.strip(), route=d.route))
    audit(db, d.brand_id, user.id, "approved", d.id, {"revision": revision_id, "route": d.route, "analysis": a.id,
                                                      "rule_versions": a.rule_versions})


def dispose(db: Session, d: Draft, user: User, m: Membership, finding: Finding, action: str, reason: str) -> None:
    if d.status == "approved":
        raise HTTPException(409, "Approved drafts are locked. Edit the draft to create a new revision.")
    if user.id != d.author_id and m.role not in REVIEW_ROLES:
        raise HTTPException(403, "Not permitted")
    if finding.is_claim:
        raise HTTPException(409, "Claim evidence problems cannot be overridden. Fix the claim or add approved evidence.")
    if finding.revision_id != d.current_revision_id:
        raise HTTPException(409, "Finding belongs to an older revision. Re-run checks.")
    if action == "rejected" and len((reason or "").strip()) < 3:
        raise HTTPException(422, "A reason is required to reject a suggestion")
    existing = db.scalar(select(Disposition).where(Disposition.draft_id == d.id, Disposition.fingerprint == finding.fingerprint))
    if existing:
        db.delete(existing)
        db.flush()
    db.add(Disposition(draft_id=d.id, fingerprint=finding.fingerprint, action=action, reason=(reason or "").strip(),
                       user_id=user.id, revision_id=finding.revision_id, rule_key=finding.rule_key, severity=finding.severity))
    if finding.rule_key:
        db.add(RuleEvent(brand_id=d.brand_id, rule_key=finding.rule_key, rule_version=finding.rule_version or 1,
                         kind="overridden" if action == "rejected" else "accepted", reason=(reason or "").strip(),
                         excerpt=finding.quote[:200], draft_id=d.id))
    audit(db, d.brand_id, user.id, f"finding_{action}", d.id,
          {"finding": finding.id, "rule": finding.rule_key, "severity": finding.severity, "reason_chars": len(reason or "")})
    # a changed disposition may change the route of a submitted draft
    if d.status in ("in_review", "senior_review"):
        a = latest_analysis(db, d)
        if a:
            d.route = compute_route(findings_of(db, a), disposition_map(db, d.id))
            d.status = "senior_review" if d.route == "senior" else "in_review"


def accept_fix(db: Session, d: Draft, user: User, finding: Finding, confirm_protected: bool) -> None:
    if d.author_id != user.id:
        raise HTTPException(403, "Only the author can apply fixes")
    if finding.revision_id != d.current_revision_id:
        raise HTTPException(409, "Finding belongs to an older revision. Re-run checks.")
    if finding.suggestion_replacement is None:
        raise HTTPException(409, "This finding has no suggested fix")
    if finding.protected_flags and not confirm_protected:
        raise HTTPException(409, {"code": "protected_change_needs_confirmation",
                                  "message": "This fix changes protected content and needs explicit confirmation.",
                                  "flags": finding.protected_flags})
    rev = current_revision(db, d)
    if rev.text[finding.start:finding.end] != finding.suggestion_original:
        raise HTTPException(409, "Draft text no longer matches this finding. Re-run checks.")
    new_text = rev.text[:finding.start] + finding.suggestion_replacement + rev.text[finding.end:]
    create_revision(db, d, user, new_text, rev.audience, rev.purpose, rev.cta,
                    f"Accepted fix for {finding.rule_key or finding.category}")
    db.add(Disposition(draft_id=d.id, fingerprint=finding.fingerprint, action="accepted", reason="",
                       user_id=user.id, revision_id=finding.revision_id, rule_key=finding.rule_key, severity=finding.severity))
    if finding.rule_key:
        db.add(RuleEvent(brand_id=d.brand_id, rule_key=finding.rule_key, rule_version=finding.rule_version or 1,
                         kind="accepted", excerpt=finding.quote[:200], draft_id=d.id))
    audit(db, d.brand_id, user.id, "finding_accepted", d.id,
          {"finding": finding.id, "rule": finding.rule_key, "protected_confirmed": bool(finding.protected_flags)})
    run_check(db, d, user, "post_edit")


def active_rules(db: Session, brand_id: int) -> list[Rule]:
    return list(db.scalars(select(Rule).where(Rule.brand_id == brand_id, Rule.status == "active").order_by(Rule.key)))
