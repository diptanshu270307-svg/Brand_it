"""HTTP API. Every brand-scoped route calls membership_for() first (brand access check)."""
from datetime import date, datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from . import insights as ins
from . import library as lib
from . import service as svc
from .analysis.evidence import evidence_state
from .db import get_db
from .llm import privacy_notice
from .models import (AuditEvent, Brand, Disposition, Draft, EvidenceRecord, Finding, GuidelineProposal, Membership,
                     ReviewDecision, Rule, SourceDocument, User, utcnow)
from .security import (REVIEW_ROLES, audit, create_token, current_user, membership_for, require_role, verify_password)

router = APIRouter(prefix="/api")


# ------------------------------------------------------------------ auth / brands
class LoginIn(BaseModel):
    email: str
    password: str


@router.post("/auth/login")
def login(body: LoginIn, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == body.email.strip().lower()))
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Invalid email or password")
    return {"token": create_token(user), "user": {"id": user.id, "name": user.name, "email": user.email}}


@router.get("/me")
def me(user: User = Depends(current_user), db: Session = Depends(get_db)):
    ms = db.scalars(select(Membership).where(Membership.user_id == user.id))
    brands = []
    for m in ms:
        b = db.get(Brand, m.brand_id)
        brands.append({"id": b.id, "name": b.name, "description": b.description, "role": m.role,
                       "protected_terms": b.protected_terms})
    return {"user": {"id": user.id, "name": user.name, "email": user.email}, "brands": brands, "privacy": privacy_notice()}


@router.get("/privacy")
def privacy():
    return privacy_notice()


# ------------------------------------------------------------------ brand library
def rule_view(r: Rule) -> dict:
    d = r.source_document
    return {"id": r.id, "key": r.key, "version": r.version, "ref": r.ref, "status": r.status, "title": r.title,
            "category": r.category, "severity": r.severity, "text": r.text, "sensitive": r.sensitive,
            "matchers": len(r.matchers or []), "banned": [m.get("message") for m in (r.matchers or [])][:3],
            "source": ({"document_id": d.id, "title": d.title, "version": d.version, "page": r.source_page} if d else None),
            "excerpt": r.source_excerpt}


def doc_view(d: SourceDocument, with_pages: bool = False) -> dict:
    v = {"id": d.id, "kind": d.kind, "title": d.title, "version": d.version, "pages": len(d.pages),
         "expires_on": d.expires_on.isoformat() if d.expires_on else None, "suspicious": d.suspicious,
         "suspicious_notes": d.suspicious_notes, "seeded": d.seeded, "created_at": d.created_at.isoformat()}
    if with_pages:
        v["page_text"] = d.pages
    return v


@router.get("/brands/{brand_id}/library")
def library(brand_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    membership_for(db, user, brand_id)
    rules = db.scalars(select(Rule).where(Rule.brand_id == brand_id, Rule.status.in_(("active", "proposed")))
                       .order_by(Rule.status, Rule.key))
    docs = db.scalars(select(SourceDocument).where(SourceDocument.brand_id == brand_id).order_by(SourceDocument.id.desc()))
    return {"rules": [rule_view(r) for r in rules], "documents": [doc_view(d) for d in docs]}


@router.get("/brands/{brand_id}/documents/{doc_id}")
def get_document(brand_id: int, doc_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    membership_for(db, user, brand_id)
    d = db.get(SourceDocument, doc_id)
    if not d or d.brand_id != brand_id:
        raise HTTPException(404, "Document not found")
    return doc_view(d, with_pages=True)


@router.post("/brands/{brand_id}/documents")
async def upload_document(brand_id: int, kind: str = Form("guideline"), title: str = Form(...), text: str = Form(""),
                          expires_on: str = Form(""), file: UploadFile | None = File(None),
                          user: User = Depends(current_user), db: Session = Depends(get_db)):
    m = membership_for(db, user, brand_id)
    require_role(m, "brand_owner")
    if kind not in ("guideline", "evidence"):
        raise HTTPException(422, "kind must be guideline or evidence")
    brand = db.get(Brand, brand_id)
    if file is not None and file.filename:
        data = await file.read()
        pages = lib.pdf_to_pages(data) if (file.filename.lower().endswith(".pdf") or data[:4] == b"%PDF") else \
            [data.decode("utf-8", errors="replace")[:200_000]]
    elif text.strip():
        pages = [p.strip() for p in text.split("\f")] if "\f" in text else [text.strip()]
    else:
        raise HTTPException(422, "Provide a PDF file or paste text")
    exp = None
    if expires_on.strip():
        try:
            exp = date.fromisoformat(expires_on.strip())
        except ValueError:
            raise HTTPException(422, "expires_on must be YYYY-MM-DD")
    doc = lib.ingest_document(db, brand, user, kind, title.strip()[:300], pages, exp)
    proposed, notes = ([], [])
    if kind == "guideline":
        proposed, notes = lib.propose_rules(db, brand, doc, user)
    db.commit()
    return {"document": doc_view(doc), "proposed_rules": [rule_view(r) for r in proposed], "notes": notes}


@router.post("/brands/{brand_id}/rules/{rule_id}/approve")
def approve_rule(brand_id: int, rule_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    require_role(membership_for(db, user, brand_id), "brand_owner")
    r = db.get(Rule, rule_id)
    if not r or r.brand_id != brand_id:
        raise HTTPException(404, "Rule not found")
    lib.activate_rule(db, r, user)
    db.commit()
    return rule_view(r)


@router.post("/brands/{brand_id}/rules/{rule_id}/reject")
def reject_rule(brand_id: int, rule_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    require_role(membership_for(db, user, brand_id), "brand_owner")
    r = db.get(Rule, rule_id)
    if not r or r.brand_id != brand_id:
        raise HTTPException(404, "Rule not found")
    if r.status != "proposed":
        raise HTTPException(409, f"Rule is '{r.status}', not proposed")
    r.status = "rejected"
    audit(db, brand_id, user.id, "rule_rejected", None, {"rule": r.key})
    db.commit()
    return rule_view(r)


# ------------------------------------------------------------------ evidence vault
def evidence_view(e: EvidenceRecord) -> dict:
    from .service import passport

    p = passport(e)
    p["keywords"] = e.keywords
    p["valid_until_record"] = e.valid_until.isoformat() if e.valid_until else None
    p["source_expires_on"] = e.source_document.expires_on.isoformat() if e.source_document.expires_on else None
    return p


@router.get("/brands/{brand_id}/evidence")
def list_evidence(brand_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    membership_for(db, user, brand_id)
    rows = db.scalars(select(EvidenceRecord).where(EvidenceRecord.brand_id == brand_id).order_by(EvidenceRecord.id))
    return [evidence_view(e) for e in rows]


class EvidenceIn(BaseModel):
    claim_text: str = Field(min_length=5, max_length=600)
    excerpt: str = Field(min_length=5, max_length=1500)
    document_id: int
    page: int = 1
    owner: str = Field(min_length=2, max_length=120)
    valid_from: date | None = None
    valid_until: date | None = None
    keywords: list[str] = []


@router.post("/brands/{brand_id}/evidence")
def add_evidence(brand_id: int, body: EvidenceIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    m = membership_for(db, user, brand_id)
    require_role(m, "brand_owner", "senior_reviewer", "reviewer")
    brand = db.get(Brand, brand_id)
    e = lib.create_evidence(db, brand, user, body.claim_text, body.excerpt, body.document_id, body.page, body.owner,
                            body.valid_from, body.valid_until, body.keywords)
    db.commit()
    return evidence_view(e)


@router.post("/brands/{brand_id}/evidence/{evidence_id}/{decision}")
def decide_evidence(brand_id: int, evidence_id: int, decision: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    require_role(membership_for(db, user, brand_id), "brand_owner")
    if decision not in ("approve", "reject"):
        raise HTTPException(404, "Not found")
    e = db.get(EvidenceRecord, evidence_id)
    if not e or e.brand_id != brand_id:
        raise HTTPException(404, "Evidence not found")
    e.status = "approved" if decision == "approve" else "rejected"
    e.approved_by = user.id
    audit(db, brand_id, user.id, f"evidence_{decision}d", None, {"evidence": e.id})
    db.commit()
    return evidence_view(e)


# ------------------------------------------------------------------ drafts
class DraftIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    channel: str = Field(default="", max_length=60)
    text: str = Field(min_length=1, max_length=20000)
    audience: str = Field(default="", max_length=300)
    purpose: str = Field(default="", max_length=300)
    cta: str = Field(default="", max_length=300)


class DraftEdit(BaseModel):
    text: str = Field(min_length=1, max_length=20000)
    audience: str = Field(default="", max_length=300)
    purpose: str = Field(default="", max_length=300)
    cta: str = Field(default="", max_length=300)
    title: str | None = None


@router.get("/brands/{brand_id}/drafts")
def list_drafts(brand_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    m = membership_for(db, user, brand_id)
    q = select(Draft).where(Draft.brand_id == brand_id).order_by(Draft.id.desc())
    if m.role == "creator":
        q = q.where(Draft.author_id == user.id)
    return [svc.draft_summary(db, d) for d in db.scalars(q)]


@router.post("/brands/{brand_id}/drafts")
def create_draft(brand_id: int, body: DraftIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    m = membership_for(db, user, brand_id)
    d = Draft(brand_id=brand_id, author_id=user.id, title=body.title.strip(), channel=body.channel.strip())
    db.add(d)
    db.flush()
    svc.create_revision(db, d, user, body.text, body.audience, body.purpose, body.cta, "Initial draft")
    audit(db, brand_id, user.id, "draft_created", d.id, {})
    db.commit()
    return svc.draft_detail(db, d, m)


@router.get("/brands/{brand_id}/drafts/{draft_id}")
def get_draft(brand_id: int, draft_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    m = membership_for(db, user, brand_id)
    return svc.draft_detail(db, svc.get_draft(db, brand_id, draft_id, m), m)


@router.put("/brands/{brand_id}/drafts/{draft_id}")
def edit_draft(brand_id: int, draft_id: int, body: DraftEdit, user: User = Depends(current_user), db: Session = Depends(get_db)):
    m = membership_for(db, user, brand_id)
    d = svc.get_draft(db, brand_id, draft_id, m)
    if d.author_id != user.id:
        raise HTTPException(403, "Only the author can edit a draft")
    rev = svc.current_revision(db, d)
    if (body.text, body.audience, body.purpose, body.cta) == (rev.text, rev.audience, rev.purpose, rev.cta):
        return svc.draft_detail(db, d, m)  # no change -> no new revision
    if body.title:
        d.title = body.title.strip()
    svc.create_revision(db, d, user, body.text, body.audience, body.purpose, body.cta, "Edited by author")
    db.commit()
    return svc.draft_detail(db, d, m)


@router.post("/brands/{brand_id}/drafts/{draft_id}/check")
def check_draft(brand_id: int, draft_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    m = membership_for(db, user, brand_id)
    d = svc.get_draft(db, brand_id, draft_id, m)
    if d.status == "approved":
        raise HTTPException(409, "Approved drafts are locked. Edit the draft to create a new revision.")
    svc.run_check(db, d, user, "manual")
    db.commit()
    return svc.draft_detail(db, d, m)


def _finding(db: Session, d: Draft, finding_id: int) -> Finding:
    f = db.get(Finding, finding_id)
    if not f or f.draft_id != d.id:
        raise HTTPException(404, "Finding not found")
    return f


class AcceptIn(BaseModel):
    confirm_protected: bool = False


class RejectIn(BaseModel):
    reason: str = Field(default="", max_length=1000)


@router.post("/brands/{brand_id}/drafts/{draft_id}/findings/{finding_id}/accept")
def accept_finding(brand_id: int, draft_id: int, finding_id: int, body: AcceptIn, user: User = Depends(current_user),
                   db: Session = Depends(get_db)):
    m = membership_for(db, user, brand_id)
    d = svc.get_draft(db, brand_id, draft_id, m)
    svc.accept_fix(db, d, user, _finding(db, d, finding_id), body.confirm_protected)
    db.commit()
    return svc.draft_detail(db, d, m)


@router.post("/brands/{brand_id}/drafts/{draft_id}/findings/{finding_id}/reject")
def reject_finding(brand_id: int, draft_id: int, finding_id: int, body: RejectIn, user: User = Depends(current_user),
                   db: Session = Depends(get_db)):
    m = membership_for(db, user, brand_id)
    d = svc.get_draft(db, brand_id, draft_id, m)
    svc.dispose(db, d, user, m, _finding(db, d, finding_id), "rejected", body.reason)
    db.commit()
    return svc.draft_detail(db, d, m)


@router.post("/brands/{brand_id}/drafts/{draft_id}/submit")
def submit_draft(brand_id: int, draft_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    m = membership_for(db, user, brand_id)
    d = svc.get_draft(db, brand_id, draft_id, m)
    svc.submit(db, d, user, m)
    db.commit()
    return svc.draft_detail(db, d, m)


class ApproveIn(BaseModel):
    revision_id: int
    comment: str = Field(default="", max_length=2000)


class ReasonIn(BaseModel):
    reason: str = Field(default="", max_length=2000)


@router.post("/brands/{brand_id}/drafts/{draft_id}/approve")
def approve_draft(brand_id: int, draft_id: int, body: ApproveIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    m = membership_for(db, user, brand_id)
    d = svc.get_draft(db, brand_id, draft_id, m)
    svc.approve(db, d, user, m, body.revision_id, body.comment)
    db.commit()
    return svc.draft_detail(db, d, m)


@router.post("/brands/{brand_id}/drafts/{draft_id}/request-changes")
def request_changes(brand_id: int, draft_id: int, body: ReasonIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    m = membership_for(db, user, brand_id)
    d = svc.get_draft(db, brand_id, draft_id, m)
    svc.request_changes(db, d, user, m, body.reason)
    db.commit()
    return svc.draft_detail(db, d, m)


class CommentIn(BaseModel):
    body: str = Field(min_length=1, max_length=2000)


@router.post("/brands/{brand_id}/drafts/{draft_id}/comments")
def add_comment(brand_id: int, draft_id: int, body: CommentIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    m = membership_for(db, user, brand_id)
    d = svc.get_draft(db, brand_id, draft_id, m)
    db.add(ReviewDecision(draft_id=d.id, revision_id=d.current_revision_id, user_id=user.id, kind="comment", body=body.body.strip()))
    audit(db, brand_id, user.id, "comment_added", d.id, {"chars": len(body.body)})
    db.commit()
    return history(brand_id, draft_id, user, db)


@router.get("/brands/{brand_id}/drafts/{draft_id}/history")
def history(brand_id: int, draft_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    m = membership_for(db, user, brand_id)
    d = svc.get_draft(db, brand_id, draft_id, m)
    decisions = db.scalars(select(ReviewDecision).where(ReviewDecision.draft_id == d.id).order_by(ReviewDecision.id))
    events = db.scalars(select(AuditEvent).where(AuditEvent.draft_id == d.id).order_by(AuditEvent.id))
    return {
        "decisions": [{"id": x.id, "kind": x.kind, "body": x.body, "by": x.user.name, "route": x.route,
                       "revision_id": x.revision_id, "at": x.created_at.isoformat(), "seeded": x.seeded} for x in decisions],
        "audit": [{"id": a.id, "action": a.action, "by": a.user.name if a.user else "system", "details": a.details,
                   "at": a.created_at.isoformat(), "seeded": a.seeded} for a in events],
    }


@router.get("/brands/{brand_id}/queue")
def queue(brand_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Creators see their own drafts; reviewers see what is waiting for them (senior route only for senior reviewers)."""
    m = membership_for(db, user, brand_id)
    drafts = list(db.scalars(select(Draft).where(Draft.brand_id == brand_id).order_by(Draft.updated_at.desc())))
    if m.role == "creator":
        drafts = [d for d in drafts if d.author_id == user.id]
    out = []
    for d in drafts:
        s = svc.draft_summary(db, d)
        s["actionable"] = (m.role in REVIEW_ROLES and d.author_id != user.id and
                           ((d.status == "in_review") or (d.status == "senior_review" and m.role == "senior_reviewer")))
        out.append(s)
    return out


# ------------------------------------------------------------------ insights / guideline health
@router.get("/brands/{brand_id}/insights")
def insights(brand_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    membership_for(db, user, brand_id)
    return ins.insights(db, brand_id)


@router.post("/brands/{brand_id}/health/{rule_key}/suggest")
def suggest_wording(brand_id: int, rule_key: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    require_role(membership_for(db, user, brand_id), "brand_owner", "senior_reviewer", "reviewer")
    p = ins.suggest_clearer_wording(db, brand_id, rule_key, user)
    db.commit()
    return ins.proposal_view(p)


class DecideIn(BaseModel):
    edited_text: str | None = Field(default=None, max_length=1500)


@router.post("/brands/{brand_id}/proposals/{proposal_id}/{decision}")
def decide_proposal(brand_id: int, proposal_id: int, decision: str, body: DecideIn | None = None,
                    user: User = Depends(current_user), db: Session = Depends(get_db)):
    require_role(membership_for(db, user, brand_id), "brand_owner")
    if decision not in ("approve", "reject"):
        raise HTTPException(404, "Not found")
    p = ins.decide_proposal(db, brand_id, proposal_id, user, decision == "approve", body.edited_text if body else None)
    db.commit()
    return ins.proposal_view(p)


@router.get("/brands/{brand_id}/evaluation")
def evaluation(brand_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    membership_for(db, user, brand_id)
    from .evaluation import run_benchmark

    return run_benchmark(db, brand_id, user)


@router.post("/demo/reset")
def reset_demo(user: User = Depends(current_user)):
    from .seed import reset_and_seed

    reset_and_seed()
    return {"status": "reset"}

