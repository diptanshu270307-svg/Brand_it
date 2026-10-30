"""Deterministic offline provider used when no API key is configured (and in tests).

It mimics what a hosted model would return - contextual hype-language findings, per-claim
evidence judgements, rule extraction and wording suggestions - using transparent heuristics,
so the full workflow is repeatable without network access. It goes through exactly the same
schema validation as a hosted model.
"""
import re
from collections import Counter

from ..analysis.dimensions import compare_claim_to_evidence, extract_dimensions_from_text
from ..analysis.text import content_tokens, covers, required_tokens, sentences
from . import LLMProvider

HYPE = re.compile(r"\b(game[- ]changing|revolutionary|unbeatable|mind[- ]blowing|life[- ]changing)\b", re.I)


class MockProvider(LLMProvider):
    name = "mock"
    hosted = False

    # ---- contextual analysis -------------------------------------------------
    def analyze(self, ctx: dict) -> dict:
        text = ctx["draft"]["text"]
        findings, judgements, extracted_claims = [], [], []

        # 1. Contextual Tone Review
        tone = next((r for r in ctx["rules"] if r["ref"].startswith("TONE-02")), None)
        if tone:
            for m in HYPE.finditer(text):
                findings.append({
                    "quote": m.group(0), "rule_ref": tone["ref"], "category": "tone", "severity": "low",
                    "explanation": f"'{m.group(0)}' is hype language; the tone rule asks for calm, specific benefits.",
                    "source_quote": tone["text"][:120], "suggested_replacement": None})

        # 2. Structured Claim Extraction (supplements fixed regexes for unfamiliar claims)
        existing_claim_quotes = {c["quote"].strip() for c in ctx.get("claims", [])}
        for s, e in sentences(text):
            seg = text[s:e].strip()
            if seg in existing_claim_quotes:
                continue
            # Look for factual statements regarding product architecture, storage, security, features
            if re.search(r"\b(Lumina|Northwind|BrandLint)\s+(?:stores|encrypts|operates|maintains|processes|hosts|features|delivers|reduces|achieves)\b", seg, re.I):
                dims = extract_dimensions_from_text(seg)
                extracted_claims.append({
                    "quote": seg,
                    "kind": "factual",
                    "product": dims["product"],
                    "metric": dims["metric"],
                    "population": dims["population"],
                    "timeframe": dims["timeframe"],
                    "qualifiers": dims["qualifiers"],
                })

        # 3. 5-Dimensional Claim Verification (No token overlap semantic simulation)
        for claim in ctx["claims"]:
            cands = ctx["evidence"].get(claim["ref"], [])
            if not cands:
                judgements.append({
                    "claim_ref": claim["ref"],
                    "evidence_ref": None,
                    "verdict": "none",
                    "supporting_quote": None,
                    "explanation": "No approved evidence relates to this claim.",
                    "suggested_replacement": None,
                    "dimensions": {},
                    "uncertainty": "No candidate evidence available in vault.",
                })
                continue

            # Compare candidates across 5 dimensions
            evaluated = []
            for c in cands:
                dim_res = compare_claim_to_evidence(claim["quote"], c)
                evaluated.append((c, dim_res))

            # Look for supported evidence where all 5 dimensions hold
            supported_candidates = [
                (c, res) for c, res in evaluated
                if c.get("state") == "current" and res["all_supported"]
            ]

            replacement = None
            for c, _ in evaluated:
                if c.get("state") == "current" and c.get("claim_text", "").strip() != claim["quote"].strip():
                    replacement = c.get("claim_text")
                    break

            if supported_candidates:
                best, dim_res = supported_candidates[0]
                judgements.append({
                    "claim_ref": claim["ref"],
                    "evidence_ref": best["ref"],
                    "verdict": "supports",
                    "supporting_quote": best["excerpt"],
                    "explanation": f'{best["ref"]} backs all 5 claim dimensions (product, metric, population, timeframe, qualifiers).',
                    "suggested_replacement": None,
                    "dimensions": dim_res["dimensions"],
                    "uncertainty": None,
                })
            else:
                # Check for explicit dimension mismatches (wrong metric, missing qualifier, etc.)
                mismatched = [(c, res) for c, res in evaluated if res["mismatches"]]
                if mismatched:
                    best, dim_res = mismatched[0]
                    judgements.append({
                        "claim_ref": claim["ref"],
                        "evidence_ref": best["ref"],
                        "verdict": "insufficient",
                        "supporting_quote": None,
                        "explanation": f'{best["ref"]} does not support this claim: {"; ".join(dim_res["mismatches"])}',
                        "suggested_replacement": replacement,
                        "dimensions": dim_res["dimensions"],
                        "uncertainty": dim_res["uncertainty"],
                    })
                else:
                    # Token overlap without exact match: do NOT simulate semantic proof! Require review.
                    best, dim_res = evaluated[0]
                    judgements.append({
                        "claim_ref": claim["ref"],
                        "evidence_ref": best["ref"],
                        "verdict": "uncertain",
                        "supporting_quote": None,
                        "explanation": "Claim wording differs from approved evidence; offline verifier requires human review.",
                        "suggested_replacement": replacement,
                        "dimensions": dim_res["dimensions"],
                        "uncertainty": "Offline verifier does not simulate semantic proof from token overlap; human review required.",
                    })

        return {
            "findings": findings,
            "extracted_claims": extracted_claims,
            "claim_judgements": judgements,
        }

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
