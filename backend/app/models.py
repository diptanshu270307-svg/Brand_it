"""Relational model.

Versioning notes:
* SourceDocument rows are immutable versions (title + version number).
* Rule rows are immutable versions too (rule_key + version). Approving a clarified wording
  creates a NEW row and marks the old one `superseded`, so findings pinned to an old row
  keep pointing at the exact wording they were checked against.
* Analysis pins `rule_versions` and `source_versions` (JSON) at check time.
"""
from datetime import date, datetime, timezone

from sqlalchemy import JSON, Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(200), unique=True)
    name: Mapped[str] = mapped_column(String(120))
    password_hash: Mapped[str] = mapped_column(String(300))


class AuthSession(Base):
    """Server-stored, revocable session. Only a SHA-256 hash of the cookie value is stored."""
    __tablename__ = "auth_sessions"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime)  # absolute expiry
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    revoked_reason: Mapped[str | None] = mapped_column(String(30), nullable=True)


class PasswordResetToken(Base):
    """Short-lived, single-use recovery token. Only a SHA-256 hash is stored."""
    __tablename__ = "password_reset_tokens"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class RateLimitEvent(Base):
    """Distributed rate limiting events shared across clustered instances."""
    __tablename__ = "rate_limit_events"
    id: Mapped[int] = mapped_column(primary_key=True)
    key: Mapped[str] = mapped_column(String(120), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)


class Company(Base):
    """Company tenant boundary. Brands belong to a company."""
    __tablename__ = "companies"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    slug: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    settings: Mapped[dict] = mapped_column(JSON, default=dict)

    brands: Mapped[list["Brand"]] = relationship(back_populates="company", cascade="all, delete-orphan")
    memberships: Mapped[list["CompanyMembership"]] = relationship(back_populates="company", cascade="all, delete-orphan")
    invitations: Mapped[list["CompanyInvitation"]] = relationship(back_populates="company", cascade="all, delete-orphan")


class CompanyMembership(Base):
    """Company-level tenant membership.
    roles: creator | reviewer | senior_reviewer | brand_owner"""
    __tablename__ = "company_memberships"
    __table_args__ = (UniqueConstraint("company_id", "user_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    role: Mapped[str] = mapped_column(String(30))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    company: Mapped[Company] = relationship(back_populates="memberships")
    user: Mapped[User] = relationship()


class CompanyInvitation(Base):
    """Company-scoped, single-use, expiring and revocable team invitation."""
    __tablename__ = "company_invitations"
    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), index=True)
    email: Mapped[str] = mapped_column(String(200), index=True)
    role: Mapped[str] = mapped_column(String(30))
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    invited_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    company: Mapped[Company] = relationship(back_populates="invitations")
    invited_by: Mapped[User] = relationship()


class Brand(Base):
    __tablename__ = "brands"
    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int | None] = mapped_column(ForeignKey("companies.id"), index=True, nullable=True)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    # Product names, numbers etc. that fixes must not silently change.
    protected_terms: Mapped[list] = mapped_column(JSON, default=list)
    competitors: Mapped[list] = mapped_column(JSON, default=list)

    company: Mapped[Company | None] = relationship(back_populates="brands")


class Membership(Base):
    """roles: creator | reviewer | senior_reviewer | brand_owner"""

    __tablename__ = "memberships"
    __table_args__ = (UniqueConstraint("user_id", "brand_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    brand_id: Mapped[int] = mapped_column(ForeignKey("brands.id"))
    role: Mapped[str] = mapped_column(String(30))
    user: Mapped[User] = relationship()


class SourceDocument(Base):
    __tablename__ = "source_documents"
    id: Mapped[int] = mapped_column(primary_key=True)
    brand_id: Mapped[int] = mapped_column(ForeignKey("brands.id"), index=True)
    kind: Mapped[str] = mapped_column(String(20))  # guideline | evidence
    title: Mapped[str] = mapped_column(String(300))
    version: Mapped[int] = mapped_column(Integer, default=1)
    expires_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    pages: Mapped[list] = mapped_column(JSON, default=list)  # list[str], page n = pages[n-1]
    content_hash: Mapped[str] = mapped_column(String(64), default="")
    suspicious: Mapped[bool] = mapped_column(Boolean, default=False)  # contains instruction-like text
    suspicious_notes: Mapped[list] = mapped_column(JSON, default=list)
    uploaded_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    storage_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    file_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    seeded: Mapped[bool] = mapped_column(Boolean, default=False)


class Rule(Base):
    """status: proposed | active | superseded | rejected"""

    __tablename__ = "rules"
    id: Mapped[int] = mapped_column(primary_key=True)
    brand_id: Mapped[int] = mapped_column(ForeignKey("brands.id"), index=True)
    key: Mapped[str] = mapped_column(String(40), index=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[str] = mapped_column(String(20), default="proposed")
    title: Mapped[str] = mapped_column(String(200))
    category: Mapped[str] = mapped_column(String(40))  # terminology|claims|tone|legal|accessibility
    severity: Mapped[str] = mapped_column(String(20))  # low|medium|high|critical
    text: Mapped[str] = mapped_column(Text)
    sensitive: Mapped[bool] = mapped_column(Boolean, default=False)
    # Deterministic matchers: [{"pattern": regex, "replacement": str|None, "message": str, "exempt_channels": list}]
    matchers: Mapped[list] = mapped_column(JSON, default=list)
    # Channels where this rule does not apply, e.g. ["Instagram"]
    exempt_channels: Mapped[list] = mapped_column(JSON, default=list)
    # Explicit structured channel conditions: [{"channel": str, "action": "allow"|"restrict", "reason": str}]
    channel_conditions: Mapped[list] = mapped_column(JSON, default=list)
    # claim_kind: if set, the rule governs a kind of claim (numeric|superlative|compliance|guarantee)
    claim_kind: Mapped[str | None] = mapped_column(String(30), nullable=True)
    source_document_id: Mapped[int | None] = mapped_column(ForeignKey("source_documents.id"), nullable=True)
    source_page: Mapped[int | None] = mapped_column(Integer, nullable=True)
    source_excerpt: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    approved_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    source_document: Mapped[SourceDocument | None] = relationship()

    @property
    def ref(self) -> str:
        return f"{self.key}@{self.version}"


class EvidenceRecord(Base):
    """status (approval): pending | approved | rejected. Validity is computed from dates."""

    __tablename__ = "evidence"
    id: Mapped[int] = mapped_column(primary_key=True)
    brand_id: Mapped[int] = mapped_column(ForeignKey("brands.id"), index=True)
    claim_text: Mapped[str] = mapped_column(Text)  # the approved wording of the claim
    excerpt: Mapped[str] = mapped_column(Text)  # exact supporting excerpt from the source page
    source_document_id: Mapped[int] = mapped_column(ForeignKey("source_documents.id"))
    page: Mapped[int] = mapped_column(Integer, default=1)
    owner: Mapped[str] = mapped_column(String(120))
    keywords: Mapped[list] = mapped_column(JSON, default=list)  # retrieval tags, e.g. ["productivity"]
    valid_from: Mapped[date | None] = mapped_column(Date, nullable=True)
    valid_until: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    approved_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    source_document: Mapped[SourceDocument] = relationship()

    @property
    def ref(self) -> str:
        return f"EV-{self.id}"


class Draft(Base):
    """status: draft | checked | in_review | senior_review | changes_requested | approved | needs_revalidation"""

    __tablename__ = "drafts"
    id: Mapped[int] = mapped_column(primary_key=True)
    brand_id: Mapped[int] = mapped_column(ForeignKey("brands.id"), index=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    title: Mapped[str] = mapped_column(String(200))
    channel: Mapped[str] = mapped_column(String(60), default="")
    status: Mapped[str] = mapped_column(String(30), default="draft")
    route: Mapped[str | None] = mapped_column(String(20), nullable=True)  # standard | senior
    current_revision_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    approved_revision_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    validity_status: Mapped[str] = mapped_column(String(30), default="valid")  # valid | needs_revalidation | reopened
    recall_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    assigned_reviewer_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    seeded: Mapped[bool] = mapped_column(Boolean, default=False)
    author: Mapped[User] = relationship(foreign_keys=[author_id])
    assigned_reviewer: Mapped[User | None] = relationship(foreign_keys=[assigned_reviewer_id])


class DraftRevision(Base):
    __tablename__ = "draft_revisions"
    id: Mapped[int] = mapped_column(primary_key=True)
    draft_id: Mapped[int] = mapped_column(ForeignKey("drafts.id"), index=True)
    number: Mapped[int] = mapped_column(Integer)
    text: Mapped[str] = mapped_column(Text)
    audience: Mapped[str] = mapped_column(String(300), default="")
    purpose: Mapped[str] = mapped_column(String(300), default="")
    cta: Mapped[str] = mapped_column(String(300), default="")
    edit_note: Mapped[str] = mapped_column(String(300), default="")
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Analysis(Base):
    __tablename__ = "analyses"
    id: Mapped[int] = mapped_column(primary_key=True)
    draft_id: Mapped[int] = mapped_column(ForeignKey("drafts.id"), index=True)
    revision_id: Mapped[int] = mapped_column(ForeignKey("draft_revisions.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    provider: Mapped[str] = mapped_column(String(40), default="mock")
    rule_versions: Mapped[dict] = mapped_column(JSON, default=dict)  # {"TERM-01": 1, ...}
    source_versions: Mapped[dict] = mapped_column(JSON, default=dict)  # {doc_id: version}
    route: Mapped[str] = mapped_column(String(20), default="standard")
    notes: Mapped[list] = mapped_column(JSON, default=list)  # pipeline notes (e.g. rejected model output)
    triggered_by: Mapped[str] = mapped_column(String(30), default="manual")


class Finding(Base):
    """evidence_status (claims only): supported | expired | missing | insufficient | needs_review"""

    __tablename__ = "findings"
    id: Mapped[int] = mapped_column(primary_key=True)
    analysis_id: Mapped[int] = mapped_column(ForeignKey("analyses.id"), index=True)
    draft_id: Mapped[int] = mapped_column(ForeignKey("drafts.id"), index=True)
    revision_id: Mapped[int] = mapped_column(Integer)
    fingerprint: Mapped[str] = mapped_column(String(32), index=True)
    origin: Mapped[str] = mapped_column(String(20))  # deterministic | llm | evidence
    category: Mapped[str] = mapped_column(String(40))
    severity: Mapped[str] = mapped_column(String(20))  # info|low|medium|high|critical
    start: Mapped[int] = mapped_column(Integer)
    end: Mapped[int] = mapped_column(Integer)
    quote: Mapped[str] = mapped_column(Text)
    explanation: Mapped[str] = mapped_column(Text)
    rule_id: Mapped[int | None] = mapped_column(ForeignKey("rules.id"), nullable=True)
    rule_key: Mapped[str | None] = mapped_column(String(40), nullable=True)
    rule_version: Mapped[int | None] = mapped_column(Integer, nullable=True)
    source_excerpt: Mapped[str] = mapped_column(Text, default="")
    source_ref: Mapped[str] = mapped_column(String(400), default="")
    is_claim: Mapped[bool] = mapped_column(Boolean, default=False)
    evidence_id: Mapped[int | None] = mapped_column(ForeignKey("evidence.id"), nullable=True)
    evidence_status: Mapped[str | None] = mapped_column(String(20), nullable=True)
    needs_review: Mapped[bool] = mapped_column(Boolean, default=False)
    sensitive: Mapped[bool] = mapped_column(Boolean, default=False)
    suggestion_original: Mapped[str | None] = mapped_column(Text, nullable=True)
    suggestion_replacement: Mapped[str | None] = mapped_column(Text, nullable=True)
    protected_flags: Mapped[list] = mapped_column(JSON, default=list)
    dimensions: Mapped[dict] = mapped_column(JSON, default=dict)
    uncertainty: Mapped[str | None] = mapped_column(String(300), nullable=True)
    evidence: Mapped[EvidenceRecord | None] = relationship()


class Disposition(Base):
    """Human decision on a finding, keyed by fingerprint so it survives re-checks.
    action: accepted | rejected"""

    __tablename__ = "dispositions"
    __table_args__ = (UniqueConstraint("draft_id", "fingerprint"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    draft_id: Mapped[int] = mapped_column(ForeignKey("drafts.id"), index=True)
    fingerprint: Mapped[str] = mapped_column(String(32))
    action: Mapped[str] = mapped_column(String(20))
    reason: Mapped[str] = mapped_column(Text, default="")
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    revision_id: Mapped[int] = mapped_column(Integer)
    rule_key: Mapped[str | None] = mapped_column(String(40), nullable=True)
    severity: Mapped[str] = mapped_column(String(20), default="low")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class ReviewDecision(Base):
    """kind: submitted | approved | changes_requested | comment | approval_invalidated"""

    __tablename__ = "review_decisions"
    id: Mapped[int] = mapped_column(primary_key=True)
    draft_id: Mapped[int] = mapped_column(ForeignKey("drafts.id"), index=True)
    revision_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    kind: Mapped[str] = mapped_column(String(30))
    body: Mapped[str] = mapped_column(Text, default="")
    route: Mapped[str | None] = mapped_column(String(20), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    seeded: Mapped[bool] = mapped_column(Boolean, default=False)
    user: Mapped[User] = relationship()


class AuditEvent(Base):
    """Never contains draft text; only ids, counts and hashes."""

    __tablename__ = "audit_events"
    id: Mapped[int] = mapped_column(primary_key=True)
    brand_id: Mapped[int] = mapped_column(ForeignKey("brands.id"), index=True)
    draft_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    action: Mapped[str] = mapped_column(String(60))
    details: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    seeded: Mapped[bool] = mapped_column(Boolean, default=False)
    user: Mapped[User | None] = relationship()


class RuleEvent(Base):
    """Per-rule history used by Insights and Guideline Health.
    kind: flagged | accepted | overridden"""

    __tablename__ = "rule_events"
    id: Mapped[int] = mapped_column(primary_key=True)
    brand_id: Mapped[int] = mapped_column(ForeignKey("brands.id"), index=True)
    rule_key: Mapped[str] = mapped_column(String(40), index=True)
    rule_version: Mapped[int] = mapped_column(Integer, default=1)
    kind: Mapped[str] = mapped_column(String(20))
    reason: Mapped[str] = mapped_column(Text, default="")
    excerpt: Mapped[str] = mapped_column(Text, default="")
    draft_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    channel: Mapped[str | None] = mapped_column(String(60), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    seeded: Mapped[bool] = mapped_column(Boolean, default=False)


class GuidelineProposal(Base):
    """Suggested clearer wording for a rule. Never applied without brand-owner approval.
    status: pending | approved | rejected"""

    __tablename__ = "guideline_proposals"
    id: Mapped[int] = mapped_column(primary_key=True)
    brand_id: Mapped[int] = mapped_column(ForeignKey("brands.id"), index=True)
    rule_id: Mapped[int] = mapped_column(ForeignKey("rules.id"))
    rule_key: Mapped[str] = mapped_column(String(40))
    current_text: Mapped[str] = mapped_column(Text)
    proposed_text: Mapped[str] = mapped_column(Text)
    rationale: Mapped[str] = mapped_column(Text, default="")
    override_count: Mapped[int] = mapped_column(Integer, default=0)
    channel_conditions: Mapped[list] = mapped_column(JSON, default=list)
    proposed_matchers: Mapped[list] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    decided_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    new_rule_id: Mapped[int | None] = mapped_column(Integer, nullable=True)


class BenchmarkCache(Base):
    """Cached execution results for expensive evaluation benchmarks."""

    __tablename__ = "benchmark_caches"
    id: Mapped[int] = mapped_column(primary_key=True)
    brand_id: Mapped[int] = mapped_column(ForeignKey("brands.id"), index=True)
    company_id: Mapped[int | None] = mapped_column(ForeignKey("companies.id"), index=True, nullable=True)
    run_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    result_json: Mapped[dict] = mapped_column(JSON, default=dict)


class BrandSetupProgress(Base):
    """Server-stored, resumable setup and onboarding progress for a brand workspace."""

    __tablename__ = "brand_setup_progress"
    id: Mapped[int] = mapped_column(primary_key=True)
    brand_id: Mapped[int] = mapped_column(ForeignKey("brands.id"), unique=True, index=True)
    company_id: Mapped[int | None] = mapped_column(ForeignKey("companies.id"), index=True, nullable=True)
    current_step: Mapped[str] = mapped_column(String(40), default="guidelines")
    skipped_invite: Mapped[bool] = mapped_column(Boolean, default=False)
    dismissed: Mapped[bool] = mapped_column(Boolean, default=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class RevisionDependency(Base):
    """Persisted evidence and rule dependencies from an approved revision."""

    __tablename__ = "revision_dependencies"
    id: Mapped[int] = mapped_column(primary_key=True)
    brand_id: Mapped[int] = mapped_column(ForeignKey("brands.id"), index=True)
    draft_id: Mapped[int] = mapped_column(ForeignKey("drafts.id"), index=True)
    revision_id: Mapped[int] = mapped_column(ForeignKey("draft_revisions.id"), index=True)
    dependency_type: Mapped[str] = mapped_column(String(20))  # evidence | rule
    evidence_id: Mapped[int | None] = mapped_column(ForeignKey("evidence.id"), nullable=True, index=True)
    rule_key: Mapped[str | None] = mapped_column(String(40), nullable=True, index=True)
    rule_version: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="valid")  # valid | needs_revalidation
    invalidated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    invalidation_reason: Mapped[str | None] = mapped_column(String(300), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class AppNotification(Base):
    """Auditable in-app notifications for review requests, decisions, and evidence recalls."""

    __tablename__ = "notifications"
    id: Mapped[int] = mapped_column(primary_key=True)
    brand_id: Mapped[int] = mapped_column(ForeignKey("brands.id"), index=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    kind: Mapped[str] = mapped_column(String(40))  # evidence_recall | review_requested | changes_requested | approved
    title: Mapped[str] = mapped_column(String(200))
    body: Mapped[str] = mapped_column(Text)
    draft_id: Mapped[int | None] = mapped_column(ForeignKey("drafts.id"), nullable=True, index=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class AnalysisJob(Base):
    """Durable, tenant-scoped analysis jobs with bounded retries, idempotency and progress tracking."""

    __tablename__ = "analysis_jobs"
    id: Mapped[int] = mapped_column(primary_key=True)
    job_id: Mapped[str] = mapped_column(String(36), unique=True, index=True)
    brand_id: Mapped[int] = mapped_column(ForeignKey("brands.id"), index=True)
    company_id: Mapped[int | None] = mapped_column(ForeignKey("companies.id"), nullable=True, index=True)
    draft_id: Mapped[int] = mapped_column(ForeignKey("drafts.id"), index=True)
    revision_id: Mapped[int] = mapped_column(ForeignKey("draft_revisions.id"), index=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="pending", index=True)  # pending | running | completed | failed | cancelled
    stage: Mapped[str] = mapped_column(String(60), default="queued")
    progress_pct: Mapped[int] = mapped_column(Integer, default=0)
    idempotency_key: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)
    retry_count: Mapped[int] = mapped_column(Integer, default=0)
    max_retries: Mapped[int] = mapped_column(Integer, default=3)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_code: Mapped[str | None] = mapped_column(String(60), nullable=True)
    analysis_id: Mapped[int | None] = mapped_column(ForeignKey("analyses.id"), nullable=True)
    stale_result_prevented: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    meta: Mapped[dict] = mapped_column(JSON, default=dict)


class WorkspaceUsageRecord(Base):
    """Server-side workspace usage accounting tracking monthly drafts, checks, and storage."""

    __tablename__ = "workspace_usage"
    __table_args__ = (UniqueConstraint("company_id", "period"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), index=True)
    period: Mapped[str] = mapped_column(String(7), index=True)  # YYYY-MM
    drafts_created: Mapped[int] = mapped_column(Integer, default=0)
    checks_run: Mapped[int] = mapped_column(Integer, default=0)
    storage_bytes: Mapped[int] = mapped_column(Integer, default=0)
    last_updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class SchemaMigration(Base):
    """Versioned database migrations tracking table."""

    __tablename__ = "schema_migrations"
    version: Mapped[str] = mapped_column(String(32), primary_key=True)
    applied_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    description: Mapped[str] = mapped_column(Text, default="")



