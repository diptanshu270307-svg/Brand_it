"""Deterministic offline provider used when no API key is configured (and in tests).

It mimics what a hosted model would return - contextual hype-language findings, per-claim
evidence judgements, rule extraction and wording suggestions - using transparent heuristics,
so the full workflow is repeatable without network access. It goes through exactly the same
schema validation as a hosted model.
"""
import re
from collections import Counter

from ..analysis.text import content_tokens, covers, required_tokens
from . import LLMProvider

HYPE = re.compile(r"\b(game[- ]changing|revolutionary|unbeatable|mind[- ]blowing|life[- ]changing)\b", re.I)


class MockProvider(LLMProvider):
    name = "mock"
    hosted = False

    # ---- contextual analysis -------------------------------------------------
    def analyze(self, ctx: dict) -> dict:
        text = ctx["draft"]["text"]
        findings, judgements = [], []

        tone = next((r for r in ctx["rules"] if r["ref"].startswith("TONE-02")), None)
        if tone:
            for m in HYPE.finditer(text):
                findings.append({
                    "quote": m.group(0), "rule_ref": tone["ref"], "category": "tone", "severity": "low",
                    "explanation": f"'{m.group(0)}' is hype language; the tone rule asks for calm, specific benefits.",
                    "source_quote": tone["text"][:120], "suggested_replacement": None})

        for claim in ctx["claims"]:
            cands = ctx["evidence"].get(claim["ref"], [])
            req = required_tokens(claim["quote"])
            ctoks = content_tokens(claim["quote"])
            scored = []
            for c in cands:
                blob = f'{c["claim_text"]} {c["excerpt"]} {" ".join(c.get("keywords", []))}'
                topical = bool(ctoks & content_tokens(blob))
                full_req = covers(req, f'{c["claim_text"]} {c["excerpt"]}')
                scored.append((c, topical, full_req))
            supporting = [c for c, topical, full in scored if topical and full]
            supporting.sort(key=lambda c: 0 if c["state"] == "current" else 1)

            replacement = None
            for c, topical, _ in scored:
                if topical and c["state"] == "current" and c["claim_text"].strip() != claim["quote"].strip():
                    replacement = c["claim_text"]
                    break

            if supporting:
                best = supporting[0]
                judgements.append({"claim_ref": claim["ref"], "evidence_ref": best["ref"], "verdict": "supports",
                                   "supporting_quote": best["excerpt"],
                                   "explanation": f'{best["ref"]} states the figures used in this claim.',
                                   "suggested_replacement": replacement if best["state"] != "current" else None})
            elif scored and not req:
                judgements.append({"claim_ref": claim["ref"], "evidence_ref": None, "verdict": "uncertain",
                                   "supporting_quote": None,
                                   "explanation": "Related evidence exists but the claim is too vague to judge automatically.",
                                   "suggested_replacement": replacement})
            elif scored:
                top = next((c for c, topical, _ in scored if topical), scored[0][0])
                judgements.append({"claim_ref": claim["ref"], "evidence_ref": top["ref"], "verdict": "insufficient",
                                   "supporting_quote": None,
                                   "explanation": f'{top["ref"]} is on a related topic but does not state this claim (figures/terms differ).',
                                   "suggested_replacement": replacement})
            else:
                judgements.append({"claim_ref": claim["ref"], "evidence_ref": None, "verdict": "none",
                                   "supporting_quote": None, "explanation": "No approved evidence relates to this claim.",
                                   "suggested_replacement": None})
        return {"findings": findings, "claim_judgements": judgements}

    # ---- rule extraction -----------------------------------------------------
    def extract_rules(self, doc_text: str, pages: list[str]) -> dict:
        rules, auto = [], 0
        keyed = re.compile(r"^\s*([A-Z]{2,8}-\d{1,3})\s*[.:\-]\s*(.+?)\s*$")
        directive = re.compile(r"\b(must|never|always|avoid|do not|don't|should not|only)\b", re.I)
        for pno, page in enumerate(pages, start=1):
            for line in page.splitlines():
                line = line.strip()
                if len(line) < 12:
                    continue
                m = keyed.match(line)
                if m:
                    key, body = m.group(1), m.group(2)
                elif directive.search(line):
                    auto += 1
                    key, body = f"AUTO-{auto:02d}", line
                else:
                    continue
                low = body.lower()
                category = ("claims" if re.search(r"claim|evidence|guarantee|%|proof", low) else
                            "legal" if re.search(r"legal|competitor|compliance|regulat", low) else
                            "accessibility" if re.search(r"accessib|contrast|alt text|caps", low) else
                            "terminology" if re.search(r"term|spell|name|call", low) else "tone")
                severity = "high" if re.search(r"never|must not|do not|prohibit", low) else "medium" if "avoid" in low else "low"
                banned = re.findall(r"[\"\u201c']([^\"\u201d']{2,40})[\"\u201d']", body)
                banned = banned if re.search(r"never|avoid|do not|don't|not use", low) else []
                rules.append({"key": key, "title": body[:60].rstrip(" .,:;"), "category": category, "severity": severity,
                              "text": body, "excerpt": line, "page": pno, "banned_terms": banned, "replacement": None})
        return {"rules": rules}

    # ---- guideline health wording -------------------------------------------
    def suggest_wording(self, rule: dict, overrides: list[dict]) -> dict:
        reasons = [o["reason"].strip() for o in overrides if o.get("reason", "").strip()]
        top = Counter(reasons).most_common(3)
        base = rule["text"].strip().rstrip(".")
        if top:
            clarif = " ".join(f"{r.rstrip('.')}." for r, _ in top[:2])
            proposed = (f"{base}. Clarification (from reviewer feedback): {clarif} "
                        "Anything outside these cases still follows the rule as written.")
            rationale = (f"{len(overrides)} reviewer overrides; most common reasons: "
                         + "; ".join(f"\"{r}\" x{n}" for r, n in top) + ". The current wording does not say when exceptions apply.")
        else:
            proposed = base + ". Add the situations where this rule does not apply."
            rationale = "No reasons were recorded with the overrides; ask reviewers to record why."
        return {"proposed_text": proposed, "rationale": rationale}
