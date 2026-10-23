"""Intent-preserving fix checks: flag suggestions that touch protected content."""
from .text import numbers


def protected_flags(original: str, replacement: str, protected_terms: list[str], cta: str = "",
                    is_claim: bool = False) -> list[str]:
    """Return human-readable reasons a suggested edit needs explicit confirmation.
    An empty list means the edit is a plain wording/tone change."""
    flags: list[str] = []
    orig_nums, new_nums = numbers(original), numbers(replacement)
    if orig_nums != new_nums:
        flags.append(f"Changes numbers ({', '.join(sorted(orig_nums)) or 'none'} \u2192 {', '.join(sorted(new_nums)) or 'none'})")

    squash = lambda s: s.lower().replace(" ", "")  # noqa: E731
    for term in protected_terms:
        if term in original and term not in replacement:
            flags.append(f"Changes product name \u201c{term}\u201d")
        elif term not in original and squash(term) in squash(original):
            flags.append(f"Alters product name formatting (\u201c{term}\u201d)")

    if is_claim and original.strip() != replacement.strip():
        flags.append("Rewrites a factual claim")

    cta_l = (cta or "").strip().lower()
    if cta_l and cta_l in original.lower() and cta_l not in replacement.lower():
        flags.append("Changes the call to action")

    if len(original) > 40 and len(replacement.strip()) < 0.25 * len(original):
        flags.append("Removes most of the sentence and may change the message")
    return flags
