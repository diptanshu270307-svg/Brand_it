"""Real evaluation benchmark over 18 labelled drafts (13 with issues, 5 clean examples).

Runs the actual `run_analysis` pipeline in a savepoint/rolled-back transaction against the
active brand rules and evidence vault, and reports only measured numbers:
- true positives, missed issues (false negatives), false alarms (false positives)
- clean-draft false-alarm count
- citation validity rate (rule ref exists, quote in draft, source/evidence quote in source page)
- measured check time (ms per draft and total ms)
"""
import time

from sqlalchemy.orm import Session

from .analysis.pipeline import run_analysis
from .analysis.text import quote_in
from .models import Draft, DraftRevision, Rule, User

# Each item specifies the draft text and the expected non-supported issue keys:
# - rule keys like "TERM-01", "CLAIM-01", "TONE-01", "TONE-02", "LEGAL-01", "ACC-01", "CLAIM-04"
# - claim statuses like "CLAIM:expired", "CLAIM:missing", "CLAIM:insufficient"
# Clean drafts have expected = [] (supported claims are info-level passports, not issues).
BENCHMARK_DRAFTS: list[dict] = [
    {
        "id": "B01",
        "label": "Hero demo draft (typo + guarantee + expired 40% claim)",
        "text": "Introducing LuminaFlow, built for operations teams. Our platform guarantees 40% higher productivity.",
        "expected": ["TERM-01", "CLAIM-01", "CLAIM:expired"],
        "clean": False,
    },
    {
        "id": "B02",
        "label": "Clean draft with supported 18% throughput claim",
        "text": "Teams using Lumina Flow reported 18% higher task throughput after 90 days.",
        "expected": [],
        "clean": True,
    },
    {
        "id": "B03",
        "label": "Clean draft with supported 92% onboarding satisfaction claim",
        "text": "92% of surveyed customers rated Lumina Flow onboarding as good or excellent.",
        "expected": [],
        "clean": True,
    },
    {
        "id": "B04",
        "label": "Clean draft with supported SOC 2 Type II statement",
        "text": "Lumina Flow completed a SOC 2 Type II examination covering security and availability for the period ending 30 June 2026.",
        "expected": [],
        "clean": True,
    },
    {
        "id": "B05",
        "label": "Clean product announcement without promotional claims",
        "text": "Lumina Flow brings project timelines, approvals and handoffs into one calm workspace for operations customers.",
        "expected": [],
        "clean": True,
    },
    {
        "id": "B06",
        "label": "Clean customer webinar invitation",
        "text": "Join our product walkthrough on Thursday to see how Lumina Flow helps operations customers coordinate launches.",
        "expected": [],
        "clean": True,
    },
    {
        "id": "B07",
        "label": "Unsupported #1 superlative + casual slang",
        "text": "We are the #1 workflow platform in India! Grab it now, buddy!",
        "expected": ["TONE-01", "CLAIM:missing"],
        "clean": False,
    },
    {
        "id": "B08",
        "label": "Terminology ('users' and 'clients') + product spacing error",
        "text": "LuminaFlow helps our users and clients finish weekly handoffs with less friction.",
        "expected": ["TERM-01", "TERM-02"],
        "clean": False,
    },
    {
        "id": "B09",
        "label": "Absolute security claim + unverified GDPR claim + competitor name",
        "text": "Lumina Flow is 100% secure and GDPR compliant, unlike Asana.",
        "expected": ["CLAIM-04", "LEGAL-01", "CLAIM:insufficient"],
        "clean": False,
    },
    {
        "id": "B10",
        "label": "Urgency pressure + ALL-CAPS banner",
        "text": "LIMITED TIME OFFER FOR OPERATIONS TEAMS, don't miss out on Lumina Flow.",
        "expected": ["ACC-01", "TONE-02"],
        "clean": False,
    },
    {
        "id": "B11",
        "label": "Pending-only pricing evidence ($12 per seat)",
        "text": "Lumina Flow Starter costs $12 per seat per month for growing customer teams.",
        "expected": ["CLAIM:missing"],
        "clean": False,
    },
    {
        "id": "B12",
        "label": "Exaggerated 55% throughput claim (contradicts 18% study)",
        "text": "Teams using Lumina Flow reported 55% higher task throughput after 90 days.",
        "expected": ["CLAIM:insufficient"],
        "clean": False,
    },
    {
        "id": "B13",
        "label": "Hype adjective ('game-changing') + casual address ('guys')",
        "text": "Hey guys, see our game-changing workflow board in Lumina Flow.",
        "expected": ["TONE-01", "TONE-02"],
        "clean": False,
    },
    {
        "id": "B14",
        "label": "Competitor comparison against Monday.com and Trello",
        "text": "Switch from Monday.com or Trello to Lumina Flow for clearer cross-team handoffs.",
        "expected": ["LEGAL-01"],
        "clean": False,
    },
    {
        "id": "B15",
        "label": "Prohibited 'guaranteed' + 'unhackable' claim",
        "text": "With Lumina Flow, your workspace is unhackable and guaranteed to pass every audit.",
        "expected": ["CLAIM-04", "CLAIM-01", "CLAIM:missing"],
        "clean": False,
    },
    {
        "id": "B16",
        "label": "Unsupported 3x ROI numeric claim",
        "text": "Customers achieve 3x ROI within their first quarter on Lumina Flow.",
        "expected": ["CLAIM:missing"],
        "clean": False,
    },
    {
        "id": "B17",
        "label": "Casual 'dude' + 'revolutionary' hype",
        "text": "Look at this revolutionary release, dude - Lumina Flow automates status updates.",
        "expected": ["TONE-01", "TONE-02"],
        "clean": False,
    },
    {
        "id": "B18",
        "label": "Lowercase product name ('Lumina flow') + 'users'",
        "text": "Lumina flow gives our users a single checklist for launch readiness.",
        "expected": ["TERM-01", "TERM-02"],
        "clean": False,
    },
]


def _observed_tags(findings) -> set[str]:
    tags: set[str] = set()
    for f in findings:
        if f.is_claim:
            if f.evidence_status and f.evidence_status != "supported":
                tags.add(f"CLAIM:{f.evidence_status}")
        elif f.severity != "info" and f.rule_key:
            tags.add(f.rule_key)
    return tags


def run_benchmark(db: Session, brand_id: int, author: User) -> dict:
    from .models import Finding

    author_id = author.id
    rules_by_id = {
        r.id: (r.text, r.source_excerpt)
        for r in db.query(Rule).filter(Rule.brand_id == brand_id).all()
    }
    rows = []
    tp_total = fn_total = fp_total = clean_fp_total = 0
    citations_checked = citations_valid = 0
    t0 = time.perf_counter()

    for item in BENCHMARK_DRAFTS:
        sp = db.begin_nested()
        t_item = time.perf_counter()
        try:
            d = Draft(brand_id=brand_id, author_id=author_id, title=f"eval-{item['id']}", channel="Eval")
            db.add(d)
            db.flush()
            rev = DraftRevision(
                draft_id=d.id,
                number=1,
                text=item["text"],
                audience="Operations leaders",
                purpose="Product marketing benchmark",
                cta="Book a demo",
                created_by=author_id,
            )
            db.add(rev)
            db.flush()
            d.current_revision_id = rev.id
            analysis = run_analysis(db, d, rev, triggered_by="benchmark")
            findings = db.query(Finding).filter(Finding.analysis_id == analysis.id).all()
            elapsed_ms = round((time.perf_counter() - t_item) * 1000, 2)

            # Verify every citation on every emitted finding
            for f in findings:
                citations_checked += 1
                in_draft = f.quote in item["text"]
                rule_ok = True
                if f.rule_id is not None:
                    r_pair = rules_by_id.get(f.rule_id)
                    rule_ok = r_pair is not None and (
                        not f.source_excerpt or quote_in(f.source_excerpt, r_pair[0]) or quote_in(f.source_excerpt, r_pair[1])
                    )
                ev_ok = True
                if f.evidence is not None:
                    page_txt = f.evidence.source_document.pages[f.evidence.page - 1]
                    ev_ok = quote_in(f.evidence.excerpt, page_txt)
                if in_draft and rule_ok and ev_ok:
                    citations_valid += 1

            expected = set(item["expected"])
            observed = _observed_tags(findings)
            tp = len(expected & observed)
            fn = len(expected - observed)
            fp = len(observed - expected)
            tp_total += tp
            fn_total += fn
            fp_total += fp
            if item["clean"] and fp > 0:
                clean_fp_total += fp
            rows.append({
                "id": item["id"],
                "label": item["label"],
                "clean": item["clean"],
                "expected": sorted(expected),
                "observed": sorted(observed),
                "tp": tp,
                "missed": sorted(expected - observed),
                "false_alarms": sorted(observed - expected),
                "latency_ms": elapsed_ms,
            })
        finally:
            sp.rollback()
            db.expunge_all()

    total_ms = round((time.perf_counter() - t0) * 1000, 2)
    precision = round(tp_total / (tp_total + fp_total), 3) if (tp_total + fp_total) else 1.0
    recall = round(tp_total / (tp_total + fn_total), 3) if (tp_total + fn_total) else 1.0
    citation_rate = round(citations_valid / citations_checked, 3) if citations_checked else 1.0
    return {
        "drafts_total": len(BENCHMARK_DRAFTS),
        "clean_drafts": sum(1 for x in BENCHMARK_DRAFTS if x["clean"]),
        "problematic_drafts": sum(1 for x in BENCHMARK_DRAFTS if not x["clean"]),
        "expected_issues": tp_total + fn_total,
        "true_positives": tp_total,
        "missed_issues": fn_total,
        "false_alarms": fp_total,
        "clean_draft_false_alarms": clean_fp_total,
        "precision": precision,
        "recall": recall,
        "citations_checked": citations_checked,
        "citations_valid": citations_valid,
        "citation_validity_rate": citation_rate,
        "total_time_ms": total_ms,
        "avg_review_time_ms": round(total_ms / len(BENCHMARK_DRAFTS), 2),
        "cases": rows,
    }
