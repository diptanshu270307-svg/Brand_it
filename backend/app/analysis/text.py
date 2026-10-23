"""Text helpers shared by the deterministic checks, the validator and the mock provider."""
import re
import unicodedata

STOPWORDS = set(
    """a an and are as at be been but by can for from has have in into is it its of on or our so than that the their
    them then there these they this to was we were will with you your us all any each every more most much not only
    out over per than very who what when where which while about after again also because before both between during
    just like make new now one other should some such these those through under until up use used using way""".split()
)

KNOWN_COMPLIANCE_TERMS = {"gdpr", "hipaa", "soc", "iso", "pci", "ccpa", "dpdp"}


def normalize(s: str) -> str:
    s = unicodedata.normalize("NFKC", s or "")
    s = s.replace("\u2019", "'").replace("\u2018", "'").replace("\u201c", '"').replace("\u201d", '"')
    s = s.replace("\u2013", "-").replace("\u2014", "-")
    return re.sub(r"\s+", " ", s).strip().lower()


def quote_in(quote: str, text: str) -> bool:
    """True when `quote` really occurs in `text` (whitespace/case/quote-style insensitive)."""
    q = normalize(quote)
    return bool(q) and q in normalize(text)


_NUM = re.compile(r"(?<![A-Za-z0-9])\d+(?:[.,]\d+)*")


def numbers(s: str) -> set[str]:
    out = set()
    for m in _NUM.findall(s or ""):
        out.add(m.replace(",", ""))
    return out


def required_tokens(claim: str) -> set[str]:
    """Things an evidence excerpt MUST contain to support the claim: every number and any
    named compliance regime. Presence is necessary, not sufficient."""
    req = numbers(claim)
    for w in re.findall(r"[A-Za-z0-9]+", claim):
        if w.lower() in KNOWN_COMPLIANCE_TERMS:
            req.add(w.lower())
    return req


def text_tokens(s: str) -> set[str]:
    return set(re.findall(r"[a-z0-9]+", normalize(s)))


def covers(req: set[str], blob: str) -> bool:
    """True when every required token (number / compliance regime) occurs in `blob`."""
    return bool(req) and req <= (numbers(blob) | text_tokens(blob))


def content_tokens(s: str, extra_stop: set[str] | None = None) -> set[str]:
    stop = STOPWORDS | (extra_stop or set())
    out = set()
    for w in re.findall(r"[a-z]+", normalize(s)):
        if len(w) < 3 or w in stop:
            continue
        if w.endswith("s") and len(w) > 4:
            w = w[:-1]
        out.add(w)
    return out


_SENT = re.compile(r"[^\n]+?(?:[.!?](?=\s|$)|(?=\n)|$)")


def sentences(text: str) -> list[tuple[int, int]]:
    """(start, end) character spans of sentences (trailing punctuation included, whitespace trimmed)."""
    spans = []
    for m in _SENT.finditer(text):
        s, e = m.start(), m.end()
        while s < e and text[s].isspace():
            s += 1
        while e > s and text[e - 1].isspace():
            e -= 1
        if e > s:
            spans.append((s, e))
    return spans
