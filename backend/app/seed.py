"""Seed a fictional brand: 10 rules, evidence (one expired source, one pending), three problematic drafts,
and *clearly labelled* sample review history. Dates are relative to today so the demo never goes stale."""
import sys
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import get_settings
from .db import Base, SessionLocal, engine, init_db
from .library import ingest_document
from .models import (Brand, Draft, EvidenceRecord, Membership, ReviewDecision, Rule, RuleEvent, User, utcnow)
from .security import audit, hash_password
from .service import create_revision

PROTECTED = ["Lumina Flow", "Lumina Insights"]
COMPETITORS = ["Asana", "Monday.com", "Trello"]


def _rules(competitors: list[str]) -> list[dict]:
    comp = "|".join(c.replace(".", r"\.") for c in competitors)
    return [
        dict(key="TERM-01", page=1, title="Product name", category="terminology", severity="medium", sensitive=False,
             text='Always write the product name as "Lumina Flow" - two words, capital L and F. Never write LuminaFlow or Lumina flow.',
             matchers=[{"pattern": r"\bLumina\s?Flow\b", "replacement": "Lumina Flow", "skip_if_equals": "Lumina Flow",
                        "message": 'The product name must be written "Lumina Flow".'}]),
        dict(key="TERM-02", page=1, title='Say "customers"', category="terminology", severity="low", sensitive=False,
             text='Refer to the people who buy our product as "customers" in external copy. Avoid "users" and "clients".',
             matchers=[{"pattern": r"\busers\b", "replacement": "customers", "message": 'Use "customers" instead of "users".'},
                       {"pattern": r"\buser\b", "replacement": "customer", "message": 'Use "customer" instead of "user".'},
                       {"pattern": r"\bclients\b", "replacement": "customers", "message": 'Use "customers" instead of "clients".'},
                       {"pattern": r"\bclient\b", "replacement": "customer", "message": 'Use "customer" instead of "client".'}]),
        dict(key="CLAIM-01", page=2, title="No guarantees", category="claims", severity="high", sensitive=True,
             claim_kind="guarantee",
             text='Never use the words guarantee, guarantees or guaranteed in external copy. Use measured language such as "helps deliver".',
             matchers=[{"pattern": r"\bguarantees\b", "replacement": "helps deliver", "message": "Guarantee language is prohibited."},
                       {"pattern": r"\bguaranteed\b", "replacement": "designed to deliver", "message": "Guarantee language is prohibited."},
                       {"pattern": r"\bguarantee\b", "replacement": "aim to deliver", "message": "Guarantee language is prohibited."}]),
        dict(key="CLAIM-02", page=2, title="Superlatives need proof", category="claims", severity="high", sensitive=True,
             claim_kind="superlative",
             text='Superlatives such as "#1", "best" or "leading" need approved current evidence naming the market, the metric and the period.',
             matchers=[]),
        dict(key="CLAIM-03", page=2, title="Numeric claims need an Evidence Passport", category="claims", severity="high",
             sensitive=True, claim_kind="numeric",
             text="Every numeric performance, savings or percentage claim must link to an approved, unexpired Evidence Passport before publication.",
             matchers=[]),
        dict(key="CLAIM-04", page=2, title="Security & compliance claims", category="claims", severity="critical",
             sensitive=True, claim_kind="compliance",
             text='Never claim that the product is "100% secure" or unhackable. Security and compliance statements (SOC 2, GDPR, ISO) need current evidence from the Security team.',
             matchers=[{"pattern": r"\b100%\s+secure\b", "replacement": None, "message": '"100% secure" is an absolute security claim and is prohibited.'},
                       {"pattern": r"\bunhackable\b", "replacement": None, "message": '"Unhackable" is an absolute security claim and is prohibited.'}]),
        dict(key="TONE-01", page=3, title="Professional, friendly voice", category="tone", severity="medium", sensitive=False,
             text='Keep a professional, friendly voice. Avoid slang and casual address such as "buddy", "guys" or "dude".',
             matchers=[{"pattern": r",?\s*\bbuddy\b", "replacement": "", "message": 'Casual address ("buddy") is off-brand.'},
                       {"pattern": r",?\s*\bdude\b", "replacement": "", "message": 'Casual address ("dude") is off-brand.'},
                       {"pattern": r"\bguys\b", "replacement": "everyone", "message": 'Casual address ("guys") is off-brand.'}]),
        dict(key="TONE-02", page=3, title="No hype or pressure", category="tone", severity="medium", sensitive=False,
             text='Avoid hype and pressure tactics: no "game-changing" or "revolutionary", and no "don\'t miss out" urgency.',
             matchers=[{"pattern": r"\bdon'?t miss out\b", "replacement": None, "message": "Pressure/urgency phrasing is off-brand."}]),
        dict(key="LEGAL-01", page=3, title="No competitor naming", category="legal", severity="high", sensitive=True,
             text='Never name competitors or make comparative claims about them (for example "better than Asana").',
             matchers=[{"pattern": rf"\b(?:{comp})\b", "replacement": None,
                        "message": "Naming a competitor creates a comparative claim that legal has not cleared."}]),
        dict(key="ACC-01", page=3, title="No ALL-CAPS text", category="accessibility", severity="low", sensitive=False,
             text="Do not write in ALL CAPS beyond a single acronym; screen readers may spell out capitalised words.",
             matchers=[{"pattern": r"\b[A-Z][A-Z']{2,}(?:[ ,]+[A-Z][A-Z']{2,})+", "case_sensitive": True, "transform": "sentence_case",
                        "message": "Runs of ALL-CAPS words are hard to read and may be spelled out by screen readers."}]),
    ]


def seed(db: Session) -> None:
    pw = hash_password(get_settings().demo_password)
    today = date.today()

    def user(email, name):
        u = User(email=email, name=name, password_hash=pw)
        db.add(u)
        return u

    casey, riley, sam, olivia, noah = (user("casey@lumina.demo", "Casey Morgan"), user("riley@lumina.demo", "Riley Chen"),
                                       user("sam@lumina.demo", "Sam Patel"), user("olivia@lumina.demo", "Olivia Brooks"),
                                       user("noah@northwind.demo", "Noah Winter"))
    brand = Brand(name="Lumina Analytics (fictional demo brand)",
                  description="Fictional B2B workflow software company used for the BrandLint demo.",
                  protected_terms=PROTECTED, competitors=COMPETITORS)
    other = Brand(name="Northwind Outfitters (separate tenant)", description="Second tenant used to demonstrate brand isolation.",
                  protected_terms=["Northwind"], competitors=[])
    db.add_all([brand, other])
    db.flush()
    for u, role in ((casey, "creator"), (riley, "reviewer"), (sam, "senior_reviewer"), (olivia, "brand_owner")):
        db.add(Membership(user_id=u.id, brand_id=brand.id, role=role))
    db.add(Membership(user_id=noah.id, brand_id=other.id, role="brand_owner"))

    # ---- guideline source + 10 active rules
    specs = _rules(COMPETITORS)
    pages = {1: ["LUMINA BRAND VOICE & CLAIMS GUIDELINES v3.2 (fictional demo content)", "Section 1 - Names and terminology"],
             2: ["Section 2 - Claims and evidence"], 3: ["Section 3 - Tone, legal and accessibility"]}
    for s in specs:
        pages[s["page"]].append(f'{s["key"]}: {s["text"]}')
    guide = ingest_document(db, brand, olivia, "guideline", "Lumina Brand Voice & Claims Guidelines", ["\n".join(pages[i]) for i in (1, 2, 3)], seeded=True)
    for s in specs:
        db.add(Rule(brand_id=brand.id, key=s["key"], version=1, status="active", title=s["title"], category=s["category"],
                    severity=s["severity"], text=s["text"], sensitive=s["sensitive"], matchers=s["matchers"],
                    claim_kind=s.get("claim_kind"), source_document_id=guide.id, source_page=s["page"],
                    source_excerpt=s["text"], approved_by=olivia.id))

    # ---- evidence sources + records
    def evidence(title, page_text, expires, claim, excerpt, owner, kw, valid_until, status="approved"):
        d = ingest_document(db, brand, olivia, "evidence", title, [page_text], expires, seeded=True)
        db.add(EvidenceRecord(brand_id=brand.id, claim_text=claim, excerpt=excerpt, source_document_id=d.id, page=1, owner=owner,
                              keywords=kw, valid_from=today - timedelta(days=200), valid_until=valid_until, status=status,
                              approved_by=olivia.id if status == "approved" else None))

    ex = "Across 212 customer teams surveyed in Q1 2025, teams using Lumina Flow reported 18% higher task throughput after 90 days."
    evidence("Customer Productivity Study 2025", f"Customer Productivity Study 2025 - Key findings\n{ex}", today + timedelta(days=500),
             "Teams using Lumina Flow reported 18% higher task throughput after 90 days.", ex, "Priya Nair (Research)",
             ["productivity", "throughput", "performance", "efficiency", "faster", "tasks"], today + timedelta(days=400))
    ex = "92% of 640 surveyed customers rated onboarding as good or excellent."
    evidence("Customer Satisfaction Survey 2026", f"Customer Satisfaction Survey 2026\n{ex}", today + timedelta(days=300),
             "92% of surveyed customers rated Lumina Flow onboarding as good or excellent.", ex, "Marcus Lee (Customer Success)",
             ["onboarding", "satisfaction", "customers", "love", "rating", "rate"], today + timedelta(days=250))
    ex = "Lumina Flow completed a SOC 2 Type II examination covering security and availability for the period ending 30 June 2026 with no exceptions noted."
    evidence("SOC 2 Type II Report Summary 2025", f"SOC 2 Type II Report - Summary\n{ex}", today + timedelta(days=200),
             "Lumina Flow completed a SOC 2 Type II examination covering security and availability.", ex, "Ana Ruiz (Security)",
             ["security", "secure", "soc2", "soc", "compliance", "compliant", "audit"], today + timedelta(days=200))
    ex = "In the 2023 pilot with 14 teams, we observed a 40% increase in productivity."
    evidence("2023 Pilot Results Memo (EXPIRED SOURCE)", f"2023 Pilot Results Memo\n{ex}", today - timedelta(days=120),
             "Lumina Flow delivers a 40% increase in productivity.", ex, "Priya Nair (Research)",
             ["productivity", "performance", "pilot"], today - timedelta(days=120))
    ex = "Lumina Flow Starter costs $12 per seat per month, billed annually."
    evidence("Pricing & Plans Sheet 2026", f"Pricing & Plans 2026\n{ex}", today + timedelta(days=300),
             "Lumina Flow Starter costs $12 per seat per month, billed annually.", ex, "Dana Kim (Finance)",
             ["price", "pricing", "plans", "cost", "seat"], today + timedelta(days=300), status="pending")

    # ---- three problematic drafts (start un-checked so the demo begins at "Check")
    def draft(title, channel, text, aud, purpose, cta):
        d = Draft(brand_id=brand.id, author_id=casey.id, title=title, channel=channel)
        db.add(d)
        db.flush()
        create_revision(db, d, casey, text, aud, purpose, cta, "Initial draft")
        return d

    draft("Launch email - productivity claim", "Email",
          "Introducing LuminaFlow, built for operations teams.\nOur platform guarantees 40% higher productivity.\nStart your free trial today!",
          "Operations leaders at mid-size companies", "Announce the launch and drive trial sign-ups", "Start your free trial")
    draft("Social post - India campaign", "Instagram",
          "We are the #1 workflow tool in India! Grab it now, buddy!\nOur users love it: 92% rate onboarding as great.\nPlans start at $12 per seat.",
          "Small-business owners", "Build awareness and drive sign-ups", "Grab it now")
    draft("Security announcement - enterprise email", "Email",
          "Lumina Flow is 100% secure and fully GDPR compliant, unlike Asana.\nLIMITED TIME OFFER, DON'T MISS OUT!\nBook a demo.",
          "IT and security buyers at enterprises", "Reassure on security and drive demo bookings", "Book a demo")

    # ---- seeded sample history (clearly labelled, never presented as live results)
    def seeded_draft(title, status, text, decision_kind, decision_body, reviewer):
        d = Draft(brand_id=brand.id, author_id=casey.id, title=f"{title} [SEEDED SAMPLE]", channel="Email", seeded=True, status=status)
        db.add(d)
        db.flush()
        rev = create_revision(db, d, casey, text, "Customers", "Newsletter", "Book a demo", "Seeded sample revision")
        d.status = status
        if status == "approved":
            d.approved_revision_id = rev.id
        d.route = "standard"
        db.add(ReviewDecision(draft_id=d.id, revision_id=rev.id, user_id=reviewer.id, kind=decision_kind, body=f"[Seeded sample] {decision_body}",
                              route="standard", seeded=True))
        audit(db, brand.id, reviewer.id, decision_kind, d.id, {"seeded_sample": True}, seeded=True)

    seeded_draft("Spring newsletter", "approved", "Teams using Lumina Flow reported 18% higher task throughput after 90 days. Book a demo.",
                 "approved", "Claim verified against the 2025 study; tone fine.", riley)
    seeded_draft("Webinar invite", "changes_requested", "Hey guys, join our webinar. Book a demo.",
                 "changes_requested", "Please replace casual address before this goes out.", riley)

    def events(key, kind, n, reasons=None, excerpts=None):
        for i in range(n):
            db.add(RuleEvent(brand_id=brand.id, rule_key=key, rule_version=1, kind=kind, seeded=True,
                             reason=(reasons[i % len(reasons)] if reasons else ""),
                             excerpt=(excerpts[i % len(excerpts)] if excerpts else ""),
                             created_at=utcnow() - timedelta(days=30 - i)))

    events("TONE-01", "flagged", 12)
    events("TONE-01", "accepted", 3, excerpts=["guys", "dude"])
    events("TONE-01", "overridden", 6,
           reasons=["Informal greeting is on-brand for Instagram", "Informal greeting is on-brand for Instagram",
                    "Informal greeting is on-brand for Instagram", "Quoted customer language, not our own voice",
                    "Quoted customer language, not our own voice", "Regional slang is accepted in India social campaigns"],
           excerpts=["Hey guys!", "What's up, buddy", "Thanks dude", "\"you guys rock\" - Priya, customer", "\"dude it works\" - customer review", "Grab it now, yaar"])
    events("TERM-01", "flagged", 9)
    events("CLAIM-03", "flagged", 8)
    events("TERM-02", "flagged", 6)
    events("TERM-02", "accepted", 2, excerpts=["our users", "clients"])
    events("TERM-02", "overridden", 2, reasons=["Customer testimonial quotes the word 'users' verbatim"],
           excerpts=["\"our users love it\" - testimonial", "\"power users\" - customer quote"])
    events("ACC-01", "flagged", 5)
    events("ACC-01", "accepted", 1, excerpts=["NEW LAUNCH TODAY"])
    events("ACC-01", "overridden", 3, reasons=["Event name is stylised in capitals by its owner"],
           excerpts=["BRANDCON INDIA", "WORKFLOW SUMMIT", "WORKFLOW SUMMIT 2026"])
    events("CLAIM-02", "flagged", 4)
    events("LEGAL-01", "flagged", 2)
    db.commit()


def reset_and_seed() -> None:
    Base.metadata.drop_all(engine)
    init_db()
    with SessionLocal() as db:
        seed(db)


def seed_if_empty() -> None:
    init_db()
    with SessionLocal() as db:
        if db.scalar(select(User.id).limit(1)) is None:
            seed(db)


if __name__ == "__main__":
    if "--reset" in sys.argv:
        reset_and_seed()
        print("Database reset and seeded.")
    else:
        seed_if_empty()
        print("Seeded (if empty).")
