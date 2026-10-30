"""5-Dimensional Claim Verification & Extraction Engine.

Compares claims against evidence across five structured dimensions:
1. Product: brand or product name
2. Metric: quantitative measure, percentage, standard, or core assertion
3. Population: target audience, customer cohort, or scope
4. Timeframe: temporal condition or duration
5. Qualifiers: scope limitations, conditions, or guarantee strength

Matching a single number or finding token overlap is never enough to establish support.
"""
import re
from typing import Any

# Universal / Overbroad words that conflict with qualified evidence
UNIVERSAL_TOKENS = {
    "every", "all", "any", "everyone", "unconditionally", "universal", "always",
    "for every", "for all", "every customer", "all customers", "every team", "all teams",
    "every user", "all users", "every organization"
}

# Known metric concepts to distinguish metrics with same numbers (e.g. downtime vs cost)
METRIC_CONCEPTS = {
    "downtime": ["downtime", "outage", "availability", "uptime", "incident", "mttr"],
    "cost": ["cost", "costs", "spend", "expense", "expenses", "price", "pricing", "bill", "budget", "saving", "savings", "seat", "month", "starter"],
    "latency": ["latency", "speed", "response time", "load time", "fast", "faster", "delay"],
    "security": ["security", "secure", "breach", "vulnerability", "hack", "leak", "soc 2", "iso 27001", "gdpr", "hipaa", "compliant", "compliance"],
    "conversion": ["conversion", "signup", "revenue", "sales", "click", "ctr"],
    "productivity": ["productivity", "developer hours", "hours saved", "time saved", "efficiency", "faster deployment", "throughput"],
}


def extract_dimensions_from_text(text: str) -> dict[str, str]:
    """Extract 5 dimensions from a claim or evidence sentence."""
    norm = text.strip()

    # 1. Product extraction
    product = "Unspecified"
    prod_match = re.search(r"\b(Lumina(?:[ -]?[A-Z][a-z]+)?|Northwind|BrandLint)\b", norm, re.I)
    if prod_match:
        product = prod_match.group(0)

    # 2. Metric extraction
    metric = "Unspecified assertion"
    num_match = re.search(r"\b(\d+(?:\.\d+)?\s?(?:%|x\b|percent|times)|[$\u20ac\u00a3\u20b9]\s?\d+(?:,\d+)*(?:\.\d+)?)\b", norm, re.I)
    metric_word = None
    for concept, keywords in METRIC_CONCEPTS.items():
        for kw in keywords:
            if re.search(rf"\b{re.escape(kw)}\b", norm, re.I):
                metric_word = concept
                break
        if metric_word:
            break

    if num_match and metric_word:
        metric = f"{num_match.group(0)} {metric_word}"
    elif num_match:
        metric = f"{num_match.group(0)} quantitative figure"
    elif metric_word:
        metric = f"{metric_word} standard"
    elif re.search(r"\b(guarantee[sd]?|100%\s+secure|certified)\b", norm, re.I):
        m = re.search(r"\b(guarantee[sd]?|100%\s+secure|certified)\b", norm, re.I)
        metric = m.group(0) if m else "Promotional assertion"

    # 3. Population extraction
    population = "General audience"
    if re.search(r"\b(for every customer|for all customers|for every team|for all users|for everyone|for every organization|for all)\b", norm, re.I):
        population = "Every customer (universal)"
    elif re.search(r"\b(enterprise customers?|enterprise teams?|enterprise accounts?|qualifying accounts?)\b", norm, re.I):
        pop_match = re.search(r"\benterprise [a-z]+(?: with [^.,;]+)?\b", norm, re.I)
        population = pop_match.group(0) if pop_match else "Enterprise customers"
    elif re.search(r"\b(teams?|customers?|users?|organizations?)\b", norm, re.I):
        pop_match = re.search(r"\b(?:[a-z]+\s+)?(?:teams?|customers?|users?|organizations?)\b", norm, re.I)
        population = pop_match.group(0) if pop_match else "Specified customer cohort"

    # 4. Timeframe extraction
    timeframe = "Unspecified"
    time_match = re.search(r"\b(in \d{4}|over \d+ (?:months?|days)|within \d+ (?:days|hours|minutes)|annually|quarterly|per year|monthly|per month|immediately|24/7)\b", norm, re.I)
    if time_match:
        timeframe = time_match.group(0)

    # 5. Qualifiers extraction
    qualifiers = "None"
    if re.search(r"\b(guarantee[sd]?|unconditionally|100%|without exception|risk[- ]free)\b", norm, re.I):
        qualifiers = "Absolute / Unconditional guarantee"
    elif re.search(r"\b(with over \d+ [a-z]+|under optimal [a-z]+|on [a-z]+ plans?|for qualifying [a-z]+|with dedicated [a-z]+)\b", norm, re.I):
        q_match = re.search(r"\b(with over \d+ [a-z]+|under optimal [a-z]+|on [a-z]+ plans?|for qualifying [a-z]+|with dedicated [a-z]+)\b", norm, re.I)
        qualifiers = q_match.group(0) if q_match else "Conditional scope"

    return {
        "product": product,
        "metric": metric,
        "population": population,
        "timeframe": timeframe,
        "qualifiers": qualifiers,
    }


def compare_claim_to_evidence(
    claim_text: str,
    evidence: Any,
    claim_dims: dict[str, str] | None = None,
) -> dict[str, Any]:
    """Compare all 5 dimensions between a draft claim and an approved EvidenceRecord or candidate dict."""
    c_dims = claim_dims or extract_dimensions_from_text(claim_text)

    if evidence is None:
        dim_results = {
            k: {
                "claim": v,
                "evidence": "None (no evidence)",
                "status": "mismatch",
                "note": f"No approved evidence on file for {k}.",
            }
            for k, v in c_dims.items()
        }
        return {
            "dimensions": dim_results,
            "all_supported": False,
            "supported_count": 0,
            "total_dimensions": 5,
            "mismatches": ["No candidate evidence found in vault."],
            "uncertainty": "No approved evidence record exists to verify this claim.",
        }

    ev_claim = getattr(evidence, "claim_text", None) or (evidence.get("claim_text", "") if isinstance(evidence, dict) else "")
    ev_excerpt = getattr(evidence, "excerpt", None) or (evidence.get("excerpt", "") if isinstance(evidence, dict) else "")
    ev_text = f"{ev_claim} {ev_excerpt}"
    e_dims = extract_dimensions_from_text(ev_text)

    dim_results = {}
    mismatches = []

    # 1. Product comparison
    c_prod = c_dims["product"].lower()
    e_prod = e_dims["product"].lower()
    prod_ok = (
        c_prod == "unspecified"
        or e_prod == "unspecified"
        or c_prod in e_prod
        or e_prod in c_prod
        or ("lumina" in c_prod and "lumina" in e_prod)
    )
    dim_results["product"] = {
        "claim": c_dims["product"],
        "evidence": e_dims["product"],
        "status": "supported" if prod_ok else "mismatch",
        "note": "Product matches source." if prod_ok else f"Claim cites {c_dims['product']}, but evidence is for {e_dims['product']}.",
    }
    if not prod_ok:
        mismatches.append(f"Product mismatch: {c_dims['product']} vs {e_dims['product']}")

    # 2. Metric comparison (concept + figures)
    c_num = re.findall(r"\d+(?:\.\d+)?\s?(?:%|x\b)|[$\u20ac\u00a3\u20b9]\s?\d+", claim_text, re.I)
    e_num = re.findall(r"\d+(?:\.\d+)?\s?(?:%|x\b)|[$\u20ac\u00a3\u20b9]\s?\d+", ev_text, re.I)

    # Check metric concept
    c_concept = None
    e_concept = None
    for concept, keywords in METRIC_CONCEPTS.items():
        for kw in keywords:
            if re.search(rf"\b{re.escape(kw)}\b", claim_text, re.I):
                c_concept = concept
                break
        for kw in keywords:
            if re.search(rf"\b{re.escape(kw)}\b", ev_text, re.I):
                e_concept = concept
                break

    numbers_match = (not c_num) or any(cn.lower().replace(" ", "") in [en.lower().replace(" ", "") for en in e_num] for cn in c_num)
    concepts_match = (not c_concept or not e_concept) or (c_concept == e_concept)

    metric_ok = numbers_match and concepts_match
    metric_note = "Metric and figures match verified evidence."
    if c_concept and e_concept and c_concept != e_concept:
        metric_ok = False
        metric_note = f"Wrong metric: claim asserts {c_concept} ({c_dims['metric']}), but evidence measures {e_concept} ({e_dims['metric']})."
        mismatches.append(metric_note)
    elif c_num and not numbers_match:
        metric_ok = False
        metric_note = f"Figure mismatch: claim asserts {c_num[0]}, but evidence does not contain this number."
        mismatches.append(metric_note)

    dim_results["metric"] = {
        "claim": c_dims["metric"],
        "evidence": e_dims["metric"],
        "status": "supported" if metric_ok else "mismatch",
        "note": metric_note,
    }

    # 3. Population comparison
    c_pop = c_dims["population"].lower()
    e_pop = e_dims["population"].lower()
    pop_ok = True
    pop_note = "Target population matches evidence scope."

    # Universal claim vs qualified evidence check
    is_universal_claim = any(re.search(rf"\b{re.escape(u)}\b", claim_text, re.I) for u in [
        "every customer", "all customers", "every team", "all teams", "all users", "every user",
        "everyone", "for all", "for every", "universal", "any customer"
    ])
    is_qualified_evidence = any(re.search(rf"\b{re.escape(q)}\b", ev_text, re.I) for q in [
        "enterprise", "qualifying", "select", "dedicated", "over 100", "tier", "plan", "eligible"
    ])

    if is_universal_claim and is_qualified_evidence:
        pop_ok = False
        pop_note = "Missing qualifier: claim asserts universal scope ('every customer'), but evidence is limited to enterprise accounts."
        mismatches.append(pop_note)
    elif "enterprise" in e_pop and "enterprise" not in c_pop and is_universal_claim:
        pop_ok = False
        pop_note = f"Evidence is restricted to {e_dims['population']}, not general customers."
        mismatches.append(pop_note)

    dim_results["population"] = {
        "claim": c_dims["population"],
        "evidence": e_dims["population"],
        "status": "supported" if pop_ok else "mismatch",
        "note": pop_note,
    }

    # 4. Timeframe comparison
    c_time = c_dims["timeframe"]
    e_time = e_dims["timeframe"]
    time_ok = (c_time == "Unspecified") or (c_time.lower() in ev_text.lower())
    time_note = "Timeframe aligns with source." if time_ok else f"Claim asserts timeframe '{c_time}' not stated in evidence."
    dim_results["timeframe"] = {
        "claim": c_time,
        "evidence": e_time,
        "status": "supported" if time_ok else "mismatch" if c_time != "Unspecified" else "unstated",
        "note": time_note,
    }
    if not time_ok and c_time != "Unspecified":
        mismatches.append(time_note)

    # 5. Qualifiers comparison
    c_qual = c_dims["qualifiers"]
    e_qual = e_dims["qualifiers"]
    qual_ok = True
    qual_note = "Qualifiers and conditions align."

    if "guarantee" in claim_text.lower() and "guarantee" not in ev_text.lower():
        qual_ok = False
        qual_note = "Unwarranted guarantee: draft guarantees results, but source evidence contains no guarantee."
        mismatches.append(qual_note)
    elif e_dims["qualifiers"] != "None" and c_dims["qualifiers"] == "None":
        q_words = [w for w in re.findall(r"\w+", e_dims["qualifiers"].lower()) if len(w) > 3 and w not in ("with", "over", "under", "plans", "plan")]
        if q_words and not any(qw in claim_text.lower() for qw in q_words):
            qual_ok = False
            qual_note = f"Missing qualifier: evidence specifies '{e_dims['qualifiers']}', but draft omits this condition."
            mismatches.append(qual_note)

    dim_results["qualifiers"] = {
        "claim": c_qual,
        "evidence": e_qual,
        "status": "supported" if qual_ok else "mismatch",
        "note": qual_note,
    }

    supported_count = sum(1 for v in dim_results.values() if v["status"] == "supported")
    all_supported = prod_ok and metric_ok and pop_ok and time_ok and qual_ok

    uncertainty = None
    if mismatches:
        uncertainty = "; ".join(mismatches[:2])
    elif not numbers_match:
        uncertainty = "Quantitative figure could not be verified."

    return {
        "dimensions": dim_results,
        "all_supported": all_supported,
        "supported_count": supported_count,
        "total_dimensions": 5,
        "mismatches": mismatches,
        "uncertainty": uncertainty,
    }
