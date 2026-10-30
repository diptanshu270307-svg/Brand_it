"""The checking pipeline.

1. Deterministic: rule matchers (terminology / prohibited wording), claim detection,
   evidence retrieval and the evidence-expiry check. These never depend on the model.
2. Retrieval: applicable *active* rules and candidate evidence are selected.
3. LLM (behind the provider adapter): contextual findings, claim-support judgements, rewrites.
4. Validation: model output is schema-checked; invented rule/evidence/claim IDs and quotes that
   do not occur in the draft / rule / evidence excerpt are rejected. Uncertain support becomes
   `needs_review`, never `supported`. Retrieved evidence is only a *candidate*.
"""
import hashlib
import logging
import re
from dataclasses import dataclass, field
from datetime import date

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..llm import LLMProvider, ProviderError, get_provider
from ..models import Analysis, Brand, Draft, DraftRevision, EvidenceRecord, Finding, Rule
from .dimensions import compare_claim_to_evidence, extract_dimensions_from_text
from .evidence import effective_expiry, evidence_state, retrieve_candidates
from .protected import protected_flags
from .schemas import LLMOutput
from .text import content_tokens, covers, quote_in, required_tokens, sentences

log = logging.getLogger("brandlint.analysis")

SEV = {"info": 0, "low": 1, "medium": 2, "high": 3, "critical": 4}
MAX_RULES_IN_PROMPT = 15

CLAIM_TRIGGERS = [
    ("compliance", re.compile(
        r"\b(?:GDPR|HIPAA|SOC\s?2|ISO\s?27001|PCI(?:-DSS)?|CCPA|DPDP)\b|"
        r"\b(?:100%\s+secure|unhackable|bank-grade|military-grade|secure|compliant|certified)\b", re.I)),
    ("superlative", re.compile(
        r"#\s?1\b|\bnumber\s+(?:one|1)\b|\b(?:best|leading|fastest|top-rated|world[- ]class|most\s+(?:trusted|popular|secure|loved))\b",
        re.I)),
    ("numeric", re.compile(r"\d+(?:\.\d+)?\s?(?:%|x\b|percent|times)|[$\u20ac\u00a3\u20b9]\s?\d", re.I)),
    ("guarantee", re.compile(r"\bguarantee[sd]?\b", re.I)),
]


@dataclass
class Claim:
    ref: str
    start: int
    end: int
    quote: str
    kind: str


@dataclass
class F:
    origin: str
    category: str
    severity: str
    start: int
    end: int
    quote: str
    explanation: str
    rule: Rule | None = None
    source_excerpt: str = ""
    source_ref: str = ""
    is_claim: bool = False
    evidence: EvidenceRecord | None = None
    evidence_status: str | None = None
    needs_review: bool = False
    sensitive: bool = False
    replacement: str | None = None
    flags: list[str] = field(default_factory=list)
    dimensions: dict = field(default_factory=dict)
    uncertainty: str | None = None


def fingerprint(rule_key: str | None, category: str, quote: str) -> str:
    return hashlib.sha1(f"{rule_key}|{category}|{quote.strip().lower()}".encode()).hexdigest()[:16]


def doc_ref(rule: Rule) -> str:
    d = rule.source_document
    if not d:
        return f"{rule.ref}: wording approved by the brand owner (Guideline Health)"
    return f"{d.title} v{d.version}, p.{rule.source_page or 1}"


def detect_claims(text: str) -> list[Claim]:
    claims = []
    for s, e in sentences(text):
        seg = text[s:e]
        kinds = [k for k, rx in CLAIM_TRIGGERS if rx.search(seg)]
        if kinds:
            claims.append(Claim(f"C{len(claims) + 1}", s, e, seg, kinds[0]))
    return claims


def _adapt_case(match: str, repl: str) -> str:
    if repl and match[:1].isupper() and repl[:1].islower():
        return repl[0].upper() + repl[1:]
    return repl


def is_rule_exempt_on_channel(rule: Rule, channel: str = "") -> bool:
    ch = (channel or "").strip().lower()
    if not ch:
        return False
    if any((ec or "").strip().lower() == ch for ec in (rule.exempt_channels or [])):
        return True
    for cond in (rule.channel_conditions or []):
        cond_ch = (cond.get("channel") or "").strip().lower()
        cond_act = (cond.get("action") or "exempt").lower()
        cond_pats = cond.get("patterns") or []
        if cond_ch == ch and cond_act in ("allow", "exempt") and not cond_pats:
            return True
    return False


def run_matchers(text: str, rules: list[Rule], channel: str = "") -> list[F]:
    out = []
    ch = (channel or "").strip().lower()
    for rule in rules:
        if is_rule_exempt_on_channel(rule, channel):
            continue
        for m in rule.matchers or []:
            if ch:
                if any((ec or "").strip().lower() == ch for ec in (m.get("exempt_channels") or [])):
                    continue
                if m.get("channels") and not any((tc or "").strip().lower() == ch for tc in (m.get("channels") or [])):
                    continue
                # Channel condition with pattern-specific exemption
                m_exempt = False
                for cond in (rule.channel_conditions or []):
                    cond_ch = (cond.get("channel") or "").strip().lower()
                    cond_act = (cond.get("action") or "exempt").lower()
                    cond_pats = cond.get("patterns") or []
                    if cond_ch == ch and cond_act in ("allow", "exempt") and m.get("pattern") in cond_pats:
                        m_exempt = True
                        break
                if m_exempt:
                    continue

            flags = 0 if m.get("case_sensitive") else re.I
            try:
                rx = re.compile(m["pattern"], flags)
            except re.error:
                continue
            for hit in rx.finditer(text):
                if not hit.group(0).strip() or hit.group(0) == m.get("skip_if_equals"):
                    continue
                if m.get("transform") == "sentence_case":
                    repl = hit.group(0).capitalize()
                else:
                    repl = m.get("replacement")
                    repl = _adapt_case(hit.group(0), repl) if repl is not None else None
                out.append(F("deterministic", rule.category, rule.severity, hit.start(), hit.end(), hit.group(0),
                             m.get("message") or rule.title, rule, rule.source_excerpt, doc_ref(rule),
                             sensitive=rule.sensitive, replacement=repl))
    return out


def _rank_rules(rules: list[Rule], text: str) -> list[Rule]:
    if len(rules) <= MAX_RULES_IN_PROMPT:
        return rules
    toks = content_tokens(text)
    ranked = sorted(rules, key=lambda r: -len(toks & content_tokens(r.title + " " + r.text)))
    return ranked[:MAX_RULES_IN_PROMPT]


def _valid_replacement(repl: str | None, original: str, current_evidence: list[EvidenceRecord]) -> str | None:
    """A claim rewrite is only allowed if some *current approved* evidence contains every
    number/regime the rewrite states."""
    if not repl or repl.strip() == original.strip():
        return None
    req = required_tokens(repl)
    if not req:
        return None
    return repl if any(covers(req, e.excerpt) for e in current_evidence) else None


def resolve_claim(claim: Claim, cands: list[EvidenceRecord], judgement, today: date, notes: list[str]):
    """-> (status, evidence, explanation, dimensions, uncertainty). Deterministic expiry beats the model."""
    req = required_tokens(claim.quote)
    states = {e.id: evidence_state(e, today) for e in cands}
    if not cands:
        dim_res = compare_claim_to_evidence(claim.quote, None)
        return "missing", None, "No evidence in the vault relates to this claim. An Evidence Passport is required before approval.", dim_res["dimensions"], dim_res["uncertainty"]

    matching = [e for e in cands if req and covers(req, f"{e.claim_text} {e.excerpt}")]
    if matching and not any(states[e.id] == "current" for e in matching):
        stale = [e for e in matching if states[e.id] in ("expired", "not_yet_valid")]
        if stale:
            e = stale[0]
            exp = effective_expiry(e)
            dim_res = compare_claim_to_evidence(claim.quote, e)
            return ("expired", e,
                    f"Matching evidence {e.ref} ({e.source_document.title}) is no longer valid"
                    f"{f' (expired {exp.isoformat()})' if exp else ''}. Expired evidence cannot support approval.",
                    dim_res["dimensions"], f"Evidence {e.ref} expired.")
        e = matching[0]
        dim_res = compare_claim_to_evidence(claim.quote, e)
        return ("missing", e,
                f"Only unapproved evidence ({e.ref}, {states[e.id]}) matches this claim. A brand owner must approve it first.",
                dim_res["dimensions"], "Unapproved evidence.")

    usable = [e for e in cands if states[e.id] in ("current", "expired")]
    if not usable:
        dim_res = compare_claim_to_evidence(claim.quote, None)
        return "missing", None, "Related evidence exists but none of it is approved. A brand owner must approve it first.", dim_res["dimensions"], "No approved evidence."
    if judgement is None:
        best = usable[0]
        dim_res = compare_claim_to_evidence(claim.quote, best)
        return "needs_review", best, "Automated support check was unavailable or its output was rejected. A human must verify this claim.", dim_res["dimensions"], "Automated support check unavailable; human review required."

    by_ref = {e.ref: e for e in usable}
    if judgement.evidence_ref and judgement.evidence_ref not in by_ref:
        notes.append(f"Rejected model judgement for {claim.ref}: unknown evidence_ref '{judgement.evidence_ref}'.")
        dim_res = compare_claim_to_evidence(claim.quote, usable[0]) if usable else {"dimensions": {}, "uncertainty": "Invented citation"}
        return "needs_review", None, "Model cited evidence that was not retrieved for this claim; treated as unverified.", dim_res["dimensions"], "Model cited invented evidence reference."
    ev = by_ref.get(judgement.evidence_ref) if judgement.evidence_ref else usable[0]

    dim_res = compare_claim_to_evidence(claim.quote, ev)

    if judgement.verdict == "uncertain":
        return "needs_review", ev, judgement.explanation or "Support is uncertain; human review required.", dim_res["dimensions"], getattr(judgement, "uncertainty", None) or dim_res.get("uncertainty") or "Support is uncertain."
    if judgement.verdict in ("none", "insufficient") or ev is None:
        return "insufficient", ev, judgement.explanation or "Related evidence found, but it does not state this claim.", dim_res["dimensions"], getattr(judgement, "uncertainty", None) or dim_res.get("uncertainty") or "Evidence does not substantiate the claim."

    # verdict == supports: verify quotation and all 5 dimensions. Matching a number or quotation is NOT enough.
    if not judgement.supporting_quote or not quote_in(judgement.supporting_quote, ev.excerpt):
        notes.append(f"Rejected model judgement for {claim.ref}: supporting quote does not occur in {ev.ref}.")
        return "needs_review", ev, "Model's supporting quotation could not be found in the evidence excerpt; treated as unverified.", dim_res["dimensions"], "Supporting quotation not found in evidence excerpt."
    if not req:
        return "needs_review", ev, "This claim has no checkable figures or named standards; a human must confirm the evidence supports it.", dim_res["dimensions"], "Missing checkable standard or metric."
    if not covers(req, ev.excerpt):
        return "insufficient", ev, f"{ev.ref} does not contain every figure/term in this claim ({', '.join(sorted(req))}); related evidence is not enough.", dim_res["dimensions"], dim_res["uncertainty"]
    if states[ev.id] != "current":
        exp = effective_expiry(ev)
        return "expired", ev, f"{ev.ref} supports this claim but expired{f' on {exp.isoformat()}' if exp else ''}.", dim_res["dimensions"], f"Evidence expired{f' on {exp.isoformat()}' if exp else ''}."

    # 5-Dimensional Verification Gate: Product, Metric, Population, Timeframe, Qualifiers
    if not dim_res["all_supported"]:
        notes.append(f"Model judgement 'supports' rejected for {claim.ref}: dimension validation failed ({'; '.join(dim_res['mismatches'])}).")
        return "insufficient", ev, f"{ev.ref} does not fully support this claim: {'; '.join(dim_res['mismatches'])}", dim_res["dimensions"], dim_res["uncertainty"]

    return "supported", ev, "", dim_res["dimensions"], None


def compute_route(findings, dispositions: dict) -> str:
    """senior: any unresolved/unsupported claim, or any sensitive or high-severity issue.
    standard: ordinary edits that stay with creators + a normal reviewer."""
    for f in findings:
        if f.is_claim:
            if f.evidence_status != "supported":
                return "senior"
            continue
        d = dispositions.get(f.fingerprint)
        if d is not None and d.action == "accepted":
            continue
        if f.sensitive or SEV.get(f.severity, 0) >= SEV["high"]:
            return "senior"
    return "standard"


def run_analysis(db: Session, draft: Draft, revision: DraftRevision, triggered_by: str = "manual",
                 provider: LLMProvider | None = None, today: date | None = None) -> Analysis:
    today = today or date.today()
    brand = db.get(Brand, draft.brand_id)
    text = revision.text
    notes: list[str] = []

    rules = list(db.scalars(select(Rule).where(Rule.brand_id == draft.brand_id, Rule.status == "active")))
    evidence_all = list(db.scalars(select(EvidenceRecord).where(EvidenceRecord.brand_id == draft.brand_id)))
    stop = {t for term in (brand.protected_terms or []) for t in content_tokens(term)}
    claim_rules = {r.claim_kind: r for r in rules if r.claim_kind}

    # 1) deterministic terminology / prohibited wording ------------------------------
    fs: list[F] = run_matchers(text, rules, channel=draft.channel or "")

    # 2) claims + evidence candidates -------------------------------------------------
    claims = detect_claims(text)
    cands: dict[str, list[EvidenceRecord]] = {
        c.ref: retrieve_candidates(c.quote, evidence_all, stop, db=db, brand_id=draft.brand_id) for c in claims
    }
    current_evidence = [e for e in evidence_all if evidence_state(e, today) == "current"]

    # 3) contextual LLM review --------------------------------------------------------
    channel_rules = [r for r in rules if not is_rule_exempt_on_channel(r, draft.channel or "")]
    prompt_rules = _rank_rules(channel_rules, text)
    rules_by_ref = {r.ref: r for r in rules}
    judgements: dict[str, object] = {}
    llm_ok = False
    if claims or rules:
        ctx = {
            "draft": {"text": text, "audience": revision.audience, "purpose": revision.purpose, "cta": revision.cta, "channel": draft.channel or ""},
            "rules": [{"ref": r.ref, "title": r.title, "category": r.category, "severity": r.severity,
                       "text": r.text, "excerpt": r.source_excerpt} for r in prompt_rules],
            "claims": [{"ref": c.ref, "quote": c.quote, "kind": c.kind} for c in claims],
            "evidence": {c.ref: [{"ref": e.ref, "claim_text": e.claim_text, "excerpt": e.excerpt,
                                  "keywords": e.keywords or [], "state": evidence_state(e, today),
                                  "valid_until": (effective_expiry(e).isoformat() if effective_expiry(e) else None),
                                  "owner": e.owner}
                                 for e in cands[c.ref] if evidence_state(e, today) in ("current", "expired")]
                         for c in claims},
            "already_flagged": [{"quote": f.quote, "rule_ref": f.rule.ref} for f in fs if f.rule],
            "protected_terms": brand.protected_terms or [],
        }
        provider = provider or get_provider()
        try:
            raw = provider.analyze(ctx)
            out = LLMOutput.model_validate(raw)
            llm_ok = True
        except (ProviderError, ValidationError, Exception) as e:  # noqa: BLE001 - any failure must degrade safely
            kind = type(e).__name__
            notes.append(f"Contextual AI review unavailable ({kind}); deterministic checks only. "
                         "Claims were marked 'needs review' instead of being assumed supported.")
            log.warning("analysis degraded: %s", kind)
            out = LLMOutput()

        # validate contextual findings
        for lf in out.findings:
            rule = rules_by_ref.get(lf.rule_ref)
            if rule is None:
                notes.append(f"Rejected model finding: unknown rule_ref '{lf.rule_ref[:40]}'.")
                continue
            if is_rule_exempt_on_channel(rule, draft.channel or ""):
                notes.append(f"Rejected model finding for {rule.ref}: rule is exempt on channel '{draft.channel}'.")
                continue
            idx = text.find(lf.quote)
            if idx < 0:
                notes.append(f"Rejected model finding for {rule.ref}: quoted text does not occur in the draft.")
                continue
            if not (quote_in(lf.source_quote, rule.text) or quote_in(lf.source_quote, rule.source_excerpt)):
                notes.append(f"Rejected model finding for {rule.ref}: source quotation does not occur in the rule.")
                continue
            if any(f.rule and f.rule.id == rule.id and f.start < idx + len(lf.quote) and idx < f.end for f in fs):
                continue  # already covered deterministically
            sev = lf.severity if SEV[lf.severity] <= SEV[rule.severity] else rule.severity
            fs.append(F("llm", rule.category, sev, idx, idx + len(lf.quote), lf.quote, lf.explanation, rule,
                        lf.source_quote, doc_ref(rule), sensitive=rule.sensitive, replacement=lf.suggested_replacement))

        # validate extracted claims (unfamiliar claims discovered by model)
        for ec in out.extracted_claims:
            idx = text.find(ec.quote)
            if idx < 0:
                notes.append(f"Rejected model claim extraction: span '{ec.quote[:40]}' does not occur in the draft.")
                continue
            if any(c.start <= idx and idx + len(ec.quote) <= c.end for c in claims):
                continue
            new_ref = f"C{len(claims) + 1}"
            new_c = Claim(new_ref, idx, idx + len(ec.quote), ec.quote, ec.kind or "factual")
            claims.append(new_c)
            cands[new_ref] = retrieve_candidates(new_c.quote, evidence_all, stop, db=db, brand_id=draft.brand_id)

        for j in out.claim_judgements:
            if j.claim_ref not in cands:
                notes.append(f"Rejected model judgement: unknown claim_ref '{j.claim_ref[:20]}'.")
                continue
            judgements[j.claim_ref] = j

    # 4) resolve claims -> evidence passports ----------------------------------------
    for c in claims:
        status, ev, expl, dims, uncert = resolve_claim(c, cands[c.ref], judgements.get(c.ref) if llm_ok else None, today, notes)
        rule = claim_rules.get(c.kind)
        j = judgements.get(c.ref)
        repl = _valid_replacement(getattr(j, "suggested_replacement", None), c.quote, current_evidence) if status != "supported" else None
        if status == "supported":
            fs.append(F("evidence", "claims", "info", c.start, c.end, c.quote,
                        f"Supported by {ev.ref}: \u201c{ev.excerpt}\u201d", rule,
                        rule.source_excerpt if rule else "", doc_ref(rule) if rule else "",
                        is_claim=True, evidence=ev, evidence_status="supported",
                        dimensions=dims, uncertainty=uncert))
            continue
        sev = rule.severity if rule else "high"
        if SEV[sev] < SEV["high"]:
            sev = "high"
        fs.append(F("evidence", "claims", sev, c.start, c.end, c.quote, expl, rule,
                    rule.source_excerpt if rule else "", doc_ref(rule) if rule else "",
                    is_claim=True, evidence=ev, evidence_status=status, needs_review=(status == "needs_review"),
                    sensitive=True, replacement=repl, dimensions=dims, uncertainty=uncert))

    # 5) persist -----------------------------------------------------------------------
    seen: set[str] = set()
    findings: list[Finding] = []
    analysis = Analysis(draft_id=draft.id, revision_id=revision.id, provider=getattr(provider, "name", "none") if provider else "none",
                        triggered_by=triggered_by, notes=notes)
    db.add(analysis)
    db.flush()
    for f in sorted(fs, key=lambda x: (x.start, -x.end)):
        fp = fingerprint(f.rule.key if f.rule else None, f.category, f.quote)
        if fp in seen:
            continue
        seen.add(fp)
        orig = text[f.start:f.end]
        flags = protected_flags(orig, f.replacement, brand.protected_terms or [], revision.cta, f.is_claim) if f.replacement is not None else []
        findings.append(Finding(
            analysis_id=analysis.id, draft_id=draft.id, revision_id=revision.id, fingerprint=fp, origin=f.origin,
            category=f.category, severity=f.severity, start=f.start, end=f.end, quote=f.quote, explanation=f.explanation,
            rule_id=f.rule.id if f.rule else None, rule_key=f.rule.key if f.rule else None,
            rule_version=f.rule.version if f.rule else None, source_excerpt=f.source_excerpt, source_ref=f.source_ref,
            is_claim=f.is_claim, evidence_id=f.evidence.id if f.evidence else None, evidence_status=f.evidence_status,
            needs_review=f.needs_review, sensitive=f.sensitive,
            suggestion_original=orig if f.replacement is not None else None,
            suggestion_replacement=f.replacement, protected_flags=flags,
            dimensions=f.dimensions or {}, uncertainty=f.uncertainty))
    db.add_all(findings)

    used_docs = {r.source_document_id: r.source_document for r in rules if r.source_document}
    for lst in cands.values():
        for e in lst:
            used_docs[e.source_document_id] = e.source_document
    analysis.rule_versions = {r.key: r.version for r in rules}
    analysis.source_versions = {str(i): {"title": d.title, "version": d.version} for i, d in used_docs.items() if d}
    analysis.route = compute_route(findings, {})
    db.flush()
    return analysis
