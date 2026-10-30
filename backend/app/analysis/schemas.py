"""Schemas for model output. Anything the LLM returns is parsed through these and then
further validated against the real draft / rules / evidence before it can be shown."""
from typing import Literal

from pydantic import BaseModel, Field

Severity = Literal["info", "low", "medium", "high", "critical"]


class LLMFinding(BaseModel):
    quote: str = Field(min_length=1, max_length=600)
    rule_ref: str  # e.g. "TONE-01@1" - must be one of the rules supplied in the prompt
    category: str = "tone"
    severity: Severity = "medium"
    explanation: str = Field(min_length=1, max_length=1200)
    source_quote: str = Field(min_length=1, max_length=800)  # must be quoted from the rule / its source
    suggested_replacement: str | None = Field(default=None, max_length=800)


class LLMClaimExtraction(BaseModel):
    quote: str = Field(min_length=1, max_length=600)
    kind: str = "factual"  # numeric | compliance | superlative | guarantee | factual
    product: str | None = None
    metric: str | None = None
    population: str | None = None
    timeframe: str | None = None
    qualifiers: str | None = None


class LLMClaimJudgement(BaseModel):
    claim_ref: str  # "C1" ...
    evidence_ref: str | None = None  # "EV-3" - must be a candidate supplied for that claim
    verdict: Literal["supports", "insufficient", "none", "uncertain"]
    supporting_quote: str | None = Field(default=None, max_length=800)  # must be quoted from the evidence excerpt
    explanation: str = Field(default="", max_length=1200)
    suggested_replacement: str | None = Field(default=None, max_length=800)
    dimensions: dict = Field(default_factory=dict)
    uncertainty: str | None = None


class LLMOutput(BaseModel):
    findings: list[LLMFinding] = []
    extracted_claims: list[LLMClaimExtraction] = []
    claim_judgements: list[LLMClaimJudgement] = []


class ProposedRule(BaseModel):
    key: str = Field(min_length=2, max_length=40)
    title: str = Field(min_length=1, max_length=200)
    category: Literal["terminology", "claims", "tone", "legal", "accessibility"] = "tone"
    severity: Literal["low", "medium", "high", "critical"] = "medium"
    text: str = Field(min_length=1, max_length=1500)
    excerpt: str = Field(min_length=1, max_length=1500)  # must occur in the page text
    page: int = 1
    banned_terms: list[str] = []  # literal phrases only (never regex)
    replacement: str | None = None


class RuleExtraction(BaseModel):
    rules: list[ProposedRule] = []


class WordingSuggestion(BaseModel):
    proposed_text: str = Field(min_length=1, max_length=1500)
    rationale: str = Field(default="", max_length=1500)
