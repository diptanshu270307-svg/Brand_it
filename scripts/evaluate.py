"""Run the 18-draft benchmark evaluation and print the measured results.

Usage:
    backend/.venv/bin/python scripts/evaluate.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from sqlalchemy import select  # noqa: E402

from app.db import SessionLocal  # noqa: E402
from app.evaluation import run_benchmark  # noqa: E402
from app.models import User  # noqa: E402
from app.seed import seed_if_empty  # noqa: E402


def main() -> None:
    seed_if_empty()
    with SessionLocal() as db:
        user = db.scalar(select(User).limit(1))
        res = run_benchmark(db, 1, user)
    print("=== BrandLint Measured Evaluation (18 labelled drafts) ===")
    print(f"Drafts evaluated        : {res['drafts_total']} ({res['problematic_drafts']} problematic, {res['clean_drafts']} clean)")
    print(f"Expected issues         : {res['expected_issues']}")
    print(f"True positives          : {res['true_positives']}")
    print(f"Missed issues (FN)      : {res['missed_issues']}")
    print(f"False alarms (FP)       : {res['false_alarms']} (on clean drafts: {res['clean_draft_false_alarms']})")
    print(f"Precision / Recall      : {res['precision'] * 100:.1f}% / {res['recall'] * 100:.1f}%")
    print(f"Valid citations         : {res['citations_valid']}/{res['citations_checked']} ({res['citation_validity_rate'] * 100:.1f}%)")
    print(f"Avg check latency       : {res['avg_review_time_ms']} ms/draft (total {res['total_time_ms']} ms)")
    print("\nPer-draft results:")
    for c in res["cases"]:
        status = "PASS" if not c["missed"] and not c["false_alarms"] else "DIFF"
        print(f"  [{status}] {c['id']} ({c['latency_ms']} ms) {c['label']}")
        if c["missed"] or c["false_alarms"]:
            print(f"         expected={c['expected']} observed={c['observed']}")


if __name__ == "__main__":
    main()
