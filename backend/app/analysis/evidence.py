"""Evidence state + candidate retrieval.

Retrieval combines PostgreSQL full-text search (`to_tsvector` / `websearch_to_tsquery` when running
on PostgreSQL) with lexical token & number overlap so it works identically in zero-setup local dev.
Retrieval only yields *candidates*: a candidate being on-topic never proves a claim (see pipeline.resolve_claim).
"""
from datetime import date

from sqlalchemy import text as sql_text
from sqlalchemy.orm import Session

from ..models import EvidenceRecord
from .text import content_tokens, covers, required_tokens


def evidence_state(e: EvidenceRecord, today: date | None = None) -> str:
    """current | expired | not_yet_valid | pending | rejected"""
    today = today or date.today()
    if e.status == "rejected":
        return "rejected"
    if e.status != "approved":
        return "pending"
    if e.valid_from and today < e.valid_from:
        return "not_yet_valid"
    doc = e.source_document
    if (e.valid_until and today > e.valid_until) or (doc and doc.expires_on and today > doc.expires_on):
        return "expired"
    return "current"


def effective_expiry(e: EvidenceRecord) -> date | None:
    dates = [d for d in (e.valid_until, e.source_document.expires_on if e.source_document else None) if d]
    return min(dates) if dates else None


def _pg_fts_ranks(db: Session | None, brand_id: int | None, claim: str) -> dict[int, float]:
    """Use PostgreSQL built-in full-text search when connected to a PostgreSQL database."""
    if db is None or brand_id is None:
        return {}
    bind = db.get_bind()
    if bind is None or bind.dialect.name != "postgresql":
        return {}
    terms = " OR ".join(sorted(content_tokens(claim)))
    if not terms:
        return {}
    rows = db.execute(
        sql_text(
            """
            SELECT id,
                   ts_rank(
                     to_tsvector('english', coalesce(claim_text, '') || ' ' || coalesce(excerpt, '')),
                     websearch_to_tsquery('english', :q)
                   ) AS rank
            FROM evidence
            WHERE brand_id = :brand_id
              AND to_tsvector('english', coalesce(claim_text, '') || ' ' || coalesce(excerpt, ''))
                  @@ websearch_to_tsquery('english', :q)
            """
        ),
        {"brand_id": brand_id, "q": terms},
    ).fetchall()
    return {int(r[0]): float(r[1]) for r in rows}


def retrieve_candidates(
    claim: str,
    records: list[EvidenceRecord],
    stop: set[str],
    limit: int = 4,
    db: Session | None = None,
    brand_id: int | None = None,
) -> list[EvidenceRecord]:
    ctoks = content_tokens(claim, stop)
    req = required_tokens(claim)
    pg_ranks = _pg_fts_ranks(db, brand_id, claim)
    scored = []
    for e in records:
        blob = f"{e.claim_text} {e.excerpt} {' '.join(e.keywords or [])}"
        overlap = len(ctoks & content_tokens(blob, stop))
        fts_boost = pg_ranks.get(e.id, 0.0)
        full = covers(req, f"{e.claim_text} {e.excerpt}")
        if overlap == 0 and fts_boost == 0.0 and not (full and req):
            continue
        score = overlap + (fts_boost * 3.0) + (2 if full else 0) + (1 if e.status == "approved" else 0)
        scored.append((score, e))
    scored.sort(key=lambda t: -t[0])
    return [e for _, e in scored[:limit]]
