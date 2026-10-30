"""Brand Library + Evidence Vault services. Uploaded documents are UNTRUSTED content."""
import hashlib
import io
import re
import time
from datetime import date
from pathlib import Path

from fastapi import HTTPException, UploadFile
from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .analysis.schemas import RuleExtraction
from .analysis.text import quote_in
from .config import get_settings
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


async def read_bounded_upload(file: UploadFile, max_bytes: int | None = None) -> bytes:
    """Read upload chunks with strict upper byte bound before file enters memory."""
    s = get_settings()
    max_bytes = max_bytes or s.max_upload_size_bytes
    chunks = []
    total = 0
    chunk_size = 64 * 1024
    while True:
        chunk = await file.read(chunk_size)
        if not chunk:
            break
        total += len(chunk)
        if total > max_bytes:
            raise HTTPException(413, f"Upload exceeds maximum permitted size of {max_bytes // (1024 * 1024)} MB")
        chunks.append(chunk)
    return b"".join(chunks)


def pdf_to_pages(data: bytes, max_bytes: int | None = None, max_pages: int | None = None,
                 max_chars: int | None = None, timeout_seconds: float | None = None) -> list[str]:
    """Extract pages from a text PDF with strict size, page-count, character and timeout bounds."""
    s = get_settings()
    max_bytes = max_bytes or s.max_upload_size_bytes
    max_pages = max_pages or s.max_pdf_pages
    max_chars = max_chars or s.max_extracted_text_chars
    timeout_seconds = timeout_seconds or s.pdf_parse_timeout_seconds

    if len(data) > max_bytes:
        raise HTTPException(413, f"PDF too large (max {max_bytes // (1024 * 1024)} MB)")

    # Magic byte signature check
    if not data.startswith(b"%PDF-"):
        raise HTTPException(400, "Invalid PDF signature. File does not have a valid %PDF- header.")

    start_time = time.monotonic()
    try:
        from pypdf import PdfReader

        reader = PdfReader(io.BytesIO(data))
        num_pages = len(reader.pages)
        if num_pages > max_pages:
            raise HTTPException(400, f"PDF has too many pages ({num_pages}). Maximum permitted is {max_pages} pages.")

        pages = []
        total_chars = 0
        for p in reader.pages:
            if time.monotonic() - start_time > timeout_seconds:
                raise HTTPException(408, f"PDF parsing timed out after {timeout_seconds} seconds.")
            txt = (p.extract_text() or "").strip()
            total_chars += len(txt)
            if total_chars > max_chars:
                raise HTTPException(400, f"PDF extracted text exceeds maximum limit of {max_chars} characters.")
            pages.append(txt)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(422, f"Could not read PDF. File may be malformed or corrupted ({type(e).__name__}).")

    if not any(pages):
        raise HTTPException(422, "No extractable text found. Scanned/image-only PDFs are not supported.")
    return pages


def parse_and_validate_document(filename: str, data: bytes, content_type: str | None = None) -> tuple[str, list[str]]:
    """Validate signatures and parse text from supported document formats (text PDFs and UTF-8 text)."""
    s = get_settings()
    fn_lower = filename.lower()

    if fn_lower.endswith(".pdf") or data.startswith(b"%PDF-"):
        pages = pdf_to_pages(data)
        return "pdf", pages

    ext = Path(fn_lower).suffix
    if ext in (".txt", ".md", ".text") or (content_type and "text/plain" in content_type.lower()):
        if b"\x00" in data:
            raise HTTPException(400, "Binary content detected. Only UTF-8 plain text files are supported.")
        try:
            decoded = data.decode("utf-8")
        except UnicodeDecodeError as e:
            raise HTTPException(400, "Uploaded text file is not valid UTF-8.") from e

        if len(decoded) > s.max_extracted_text_chars:
            raise HTTPException(413, f"Text file exceeds maximum limit of {s.max_extracted_text_chars} characters.")

        pages = [p.strip() for p in decoded.split("\f")] if "\f" in decoded else [decoded.strip()]
        if not any(pages):
            raise HTTPException(422, "Uploaded text file contains no extractable content.")
        return "text", pages

    raise HTTPException(400, f"Unsupported file type '{ext or 'unknown'}'. Only text-based PDFs (.pdf) and UTF-8 text (.txt, .md) are supported.")


def store_document_file(brand_id: int, company_id: int | None, filename: str, data: bytes, content_hash: str) -> str:
    """Store untrusted uploaded document in private, tenant-scoped storage outside public static directories."""
    s = get_settings()
    base_dir = Path(s.document_storage_dir).resolve()
    co_dir = f"company_{company_id or 'default'}"
    brand_dir = f"brand_{brand_id}"
    target_dir = base_dir / co_dir / brand_dir
    target_dir.mkdir(parents=True, exist_ok=True)

    safe_name = re.sub(r"[^a-zA-Z0-9_.-]", "_", Path(filename).name) or "document.bin"
    target_filename = f"{content_hash[:16]}_{safe_name}"
    target_path = target_dir / target_filename
    target_path.write_bytes(data)
    try:
        target_path.chmod(0o600)
    except Exception:
        pass
    return str(target_path.relative_to(base_dir))


def get_stored_document_path(rel_path: str) -> Path:
    """Validate relative storage path against traversal and return resolved path."""
    s = get_settings()
    base_dir = Path(s.document_storage_dir).resolve()
    target = (base_dir / rel_path).resolve()
    try:
        target.relative_to(base_dir)
    except ValueError as e:
        raise HTTPException(404, "Invalid document storage path") from e
    if not target.is_file():
        raise HTTPException(404, "Document storage file not found")
    return target


def ingest_document(db: Session, brand: Brand, user: User | None, kind: str, title: str, pages: list[str],
                    expires_on: date | None = None, seeded: bool = False,
                    file_data: bytes | None = None, file_name: str | None = None) -> SourceDocument:
    version = (db.scalar(select(func.max(SourceDocument.version)).where(
        SourceDocument.brand_id == brand.id, SourceDocument.title == title, SourceDocument.kind == kind)) or 0) + 1
    notes = scan_suspicious(pages)
    content_hash = hashlib.sha256("\n".join(pages).encode()).hexdigest()

    storage_path = None
    if file_data is not None and file_name:
        storage_path = store_document_file(brand.id, brand.company_id, file_name, file_data, content_hash)

    doc = SourceDocument(
        brand_id=brand.id,
        kind=kind,
        title=title,
        version=version,
        expires_on=expires_on,
        pages=pages,
        content_hash=content_hash,
        suspicious=bool(notes),
        suspicious_notes=notes,
        uploaded_by=user.id if user else None,
        seeded=seeded,
        storage_path=storage_path,
        file_name=file_name,
    )
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
