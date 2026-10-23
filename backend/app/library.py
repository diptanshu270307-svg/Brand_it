"""Brand Library + Evidence Vault services. Uploaded documents are UNTRUSTED content."""
import hashlib
import io
import re
from datetime import date

from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .analysis.schemas import RuleExtraction
from .analysis.text import quote_in
from .llm import ProviderError, get_provider
from .models import Brand, EvidenceRecord, Rule, SourceDocument, User
from .security import audit

MAX_PDF_BYTES = 10 * 1024 * 1024
MAX_PAGES = 200

INJECTION_PATTERNS = [
    r"ignore\s+(?:all\s+|any\s+)?(?:the\s+)?(?:previous|prior|above|earlier)\s+(?:instructions|rules|prompts?)",
    r"disregard\s+.{0,40}(?:instructions|rules|guidelines)",
    r"\byou\s+are\s+now\b",
    r"\b(?:system|developer)\s+prompt\b",
    r"(?:approve|mark|set)\s+(?:this|all|every)\s+(?:draft|content|claim|evidence)s?\s+as\s+(?:approved|supported|valid)",
    r"reveal\s+.{0,25}(?:api\s*key|secret|password|token)",
    r"</?\s*(?:system|assistant|instructions?)\s*>",
]
_INJ = re.compile("|".join(INJECTION_PATTERNS), re.I)


def scan_suspicious(chunks: list[str]) -> list[str]:
    notes = []
    for i, c in enumerate(chunks, start=1):
        m = _INJ.search(c or "")
        if m:
            notes.append(f"Page {i}: instruction-like text \u201c{m.group(0)[:80]}\u201d (treated as data, never followed)")
    return notes


def pdf_to_pages(data: bytes) -> list[str]:
    if len(data) > MAX_PDF_BYTES:
        raise HTTPException(413, "PDF too large (max 10 MB)")
    try:
        from pypdf import PdfReader

        reader = PdfReader(io.BytesIO(data))
        if len(reader.pages) > MAX_PAGES:
            raise HTTPException(413, f"PDF has too many pages (max {MAX_PAGES})")
        pages = [(p.extract_text() or "").strip() for p in reader.pages]
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(422, "Could not read this PDF. Only text-based PDFs are supported.")
    if not any(pages):
        raise HTTPException(422, "No extractable text found. Scanned/image PDFs are not supported - paste the text instead.")
    return pages


def ingest_document(db: Session, brand: Brand, user: User | None, kind: str, title: str, pages: list[str],
                    expires_on: date | None = None, seeded: bool = False) -> SourceDocument:
    version = (db.scalar(select(func.max(SourceDocument.version)).where(
        SourceDocument.brand_id == brand.id, SourceDocument.title == title, SourceDocument.kind == kind)) or 0) + 1
    notes = scan_suspicious(pages)
    doc = SourceDocument(brand_id=brand.id, kind=kind, title=title, version=version, expires_on=expires_on, pages=pages,
                         content_hash=hashlib.sha256("\n".join(pages).encode()).hexdigest(), suspicious=bool(notes),
                         suspicious_notes=notes, uploaded_by=user.id if user else None, seeded=seeded)
    db.add(doc)
    db.flush()
    audit(db, brand.id, user.id if user else None, "document_ingested", None,
          {"doc": doc.id, "kind": kind, "version": version, "pages": len(pages), "suspicious": bool(notes)}, seeded=seeded)
    return doc


def propose_rules(db: Session, brand: Brand, doc: SourceDocument, user: User) -> tuple[list[Rule], list[str]]:
    """Extract rule *proposals*. Nothing becomes active until a brand owner approves it."""
    notes: list[str] = []
    try:
        raw = get_provider().extract_rules("\n\n".join(doc.pages), doc.pages)
        parsed = RuleExtraction.model_validate(raw)
    except (ProviderError, ValidationError, Exception) as e:  # noqa: BLE001
        return [], [f"Rule extraction failed ({type(e).__name__}). You can add rules after fixing the provider."]

    out, seen = [], set()
    for p in parsed.rules[:60]:
        key = re.sub(r"[^A-Z0-9-]", "", p.key.upper())[:40]
        if len(key) < 2 or key in seen:
            notes.append(f"Skipped a proposed rule with invalid or duplicate key '{p.key[:20]}'.")
            continue
        if not (1 <= p.page <= len(doc.pages)) or not quote_in(p.excerpt, doc.pages[p.page - 1]):
            notes.append(f"Rejected {key}: its source excerpt does not occur on page {p.page}.")
            continue
        if scan_suspicious([p.text, p.title]):
            notes.append(f"Rejected {key}: rule text looks like an instruction to the AI, not a brand rule.")
            continue
        seen.add(key)
        matchers = [{"pattern": r"\b" + re.escape(t.strip()) + r"\b", "replacement": p.replacement,
                     "message": f"\u201c{t.strip()}\u201d is not allowed by {key}."}
                    for t in p.banned_terms[:10] if t.strip()]
        r = Rule(brand_id=brand.id, key=key, version=1, status="proposed", title=p.title, category=p.category,
                 severity=p.severity, text=p.text, matchers=matchers, sensitive=p.severity in ("high", "critical"),
                 source_document_id=doc.id, source_page=p.page, source_excerpt=p.excerpt)
        db.add(r)
        out.append(r)
    db.flush()
    audit(db, brand.id, user.id, "rules_proposed", None, {"doc": doc.id, "count": len(out), "rejected": len(notes)})
    return out, notes


def activate_rule(db: Session, rule: Rule, user: User) -> Rule:
    if rule.status != "proposed":
        raise HTTPException(409, f"Rule is '{rule.status}', not proposed")
    prev = db.scalar(select(Rule).where(Rule.brand_id == rule.brand_id, Rule.key == rule.key, Rule.status == "active"))
    if prev:
        prev.status = "superseded"
        rule.version = prev.version + 1
    rule.status, rule.approved_by = "active", user.id
    audit(db, rule.brand_id, user.id, "rule_approved", None, {"rule": rule.key, "version": rule.version})
    return rule


def create_evidence(db: Session, brand: Brand, user: User, claim_text: str, excerpt: str, doc_id: int, page: int,
                    owner: str, valid_from: date | None, valid_until: date | None, keywords: list[str]) -> EvidenceRecord:
    doc = db.get(SourceDocument, doc_id)
    if not doc or doc.brand_id != brand.id:
        raise HTTPException(404, "Source document not found")
    if not (1 <= page <= len(doc.pages)):
        raise HTTPException(422, f"Page must be between 1 and {len(doc.pages)}")
    if not quote_in(excerpt, doc.pages[page - 1]):
        raise HTTPException(422, f"The excerpt does not occur on page {page} of \u201c{doc.title}\u201d. Copy it exactly from the source.")
    if scan_suspicious([excerpt, claim_text]):
        raise HTTPException(422, "Evidence text looks like an instruction to an AI, not evidence.")
    e = EvidenceRecord(brand_id=brand.id, claim_text=claim_text.strip(), excerpt=excerpt.strip(), source_document_id=doc.id,
                       page=page, owner=owner.strip(), valid_from=valid_from, valid_until=valid_until,
                       keywords=[k.strip().lower() for k in keywords if k.strip()][:12], status="pending")
    db.add(e)
    db.flush()
    audit(db, brand.id, user.id, "evidence_created", None, {"evidence": e.id, "doc": doc.id})
    return e
