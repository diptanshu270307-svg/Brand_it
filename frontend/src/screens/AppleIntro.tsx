import React, { useRef, useState } from "react";
import { Count, SectionRail, useIntroMotion } from "../components/Motion";
import { SecuritySealsRow } from "../components/Flowcharts";

interface Props {
  onOpenScreen: (screen: "library" | "review" | "vault" | "queue" | "insights") => void;
  onLaunchDraft: (draftId: number, persona?: string) => void;
  onLaunchStep: (stepIdx: number) => void;
}

const SAMPLE_DEMOS = [
  {
    id: 1,
    title: "Launch email — productivity claim",
    quote: "Our platform guarantees 40% higher productivity.",
    draftId: 1,
    persona: "casey@lumina.demo",
    lines: [
      { text: "$ brandlint check drafts/hero-launch.txt --brand Lumina", cls: "dim" },
      { text: "› Ingesting 10 active brand guidelines & Evidence Vault candidate proofs...", cls: "dim" },
      { text: "› Running deterministic terminology checks...", cls: "dim" },
      { text: "› Rule TONE-01 flagged: \"guarantees\" (Prohibited absolute guarantee)", cls: "hl" },
      { text: "  ↳ Suggested fix: \"helps deliver\" [Intent Preserved: Audience, Purpose, CTA]", cls: "hl" },
      { text: "› Claim Passport EV-4: \"40% higher productivity\"", cls: "danger-text" },
      { text: "  ↳ Source: Lumina Cloud Whitepaper v1, p.4 · Owner: Data Science Team", cls: "dim" },
      { text: "  ↳ Status: EXPIRED on 2024-12-31 ⛔ BLOCKS APPROVAL", cls: "danger-text" },
      { text: "⛔ Approval Gate: BLOCKED — Promotional claim lacks active valid evidence", cls: "danger-text" },
      { text: "✓ Replace with valid claim EV-1 (18% throughput) to unlock human approval", cls: "ok" },
    ],
  },
  {
    id: 2,
    title: "Pricing comparison — budget phrasing",
    quote: "Save money with Nimbus cheap cloud storage.",
    draftId: 2,
    persona: "casey@lumina.demo",
    lines: [
      { text: "$ brandlint check drafts/pricing-social.txt --brand Lumina", cls: "dim" },
      { text: "› Scanning brand guidelines...", cls: "dim" },
      { text: "› Rule TERM-01 flagged: \"Nimbus cheap cloud storage\"", cls: "hl" },
      { text: "  ↳ Flagged miscapitalized product name → \"Nimbus Cloud\"", cls: "hl" },
      { text: "› Rule TONE-02 flagged: \"cheap\"", cls: "danger-text" },
      { text: "  ↳ Prohibited budget phrasing → Suggested fix: \"cost-effective\"", cls: "hl" },
      { text: "✓ Protected Content Guardrail: Fact and product name change flagged for explicit review", cls: "ok" },
    ],
  },
  {
    id: 3,
    title: "Case study — evidence-backed claim",
    quote: "Lumina Cloud helps teams improve throughput by up to 18%.",
    draftId: 3,
    persona: "riley@lumina.demo",
    lines: [
      { text: "$ brandlint check drafts/case-study.txt --brand Lumina", cls: "dim" },
      { text: "› Matching promotional claims against Evidence Vault candidate proofs...", cls: "dim" },
      { text: "› Claim Passport EV-1: \"improve throughput by up to 18%\"", cls: "ok" },
      { text: "  ↳ Source: Lumina Benchmark Report 2025 v1, p.2 · Owner: Infrastructure Team", cls: "dim" },
      { text: "  ↳ Status: CURRENT (Valid until 2026-12-31)", cls: "ok" },
      { text: "✓ 0 rule violations · 0 approval blockers · 100% citation valid", cls: "ok" },
      { text: "✓ Ready for human sign-off: Routed to Senior Reviewer", cls: "ok" },
    ],
  },
];

export const AppleIntro: React.FC<Props> = ({
  onOpenScreen,
  onLaunchDraft,
  onLaunchStep,
}) => {
  const [selectedDemo, setSelectedDemo] = useState(SAMPLE_DEMOS[0]);
  const rootRef = useRef<HTMLDivElement>(null);
  useIntroMotion(rootRef);

  return (
    <div className="apple-intro" ref={rootRef}>
      <SectionRail items={[{id:"top",label:"Overview"},{id:"features",label:"Pillars"},{id:"scale",label:"Benchmarks"},{id:"walkthrough",label:"Journey"},{id:"launch",label:"Launch"}]} />
      {/* 1. HERO SECTION */}
      <header className="hero" id="top">
        <div className="wrap">
          <div className="hero-eyebrow-chip">
            <span className="chip-badge">ENTERPRISE REVIEW DESK</span>
            <span className="chip-text">Spell-Check for Your Brand</span>
          </div>
          <h1 className="bl-h1"><span className="ln"><b>Every claim verified.</b></span><span className="ln"><b>Every approval human.</b></span></h1>
          <p className="lead">
            BrandLint connects every promotional claim to verified evidence, flags guideline
            violations with intent-preserving fixes, and enforces human sign-off gates before publication.
          </p>
          <div className="cta">
            <button
              className="btn btn-primary"
              onClick={() => onLaunchDraft(1, "casey@lumina.demo")}
            >
              Try Hero Demo Draft (40% Claim) →
            </button>
            <button
              className="btn"
              onClick={() => onOpenScreen("review")}
            >
              Open Review Desk
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => onOpenScreen("vault")}
            >
              Inspect Evidence Vault →
            </button>
          </div>
        </div>

        {/* 2. REAL-TIME ENGINE CONSOLE */}
        <div className="wrap">
          <SecuritySealsRow />
          <div className="stage" data-reveal>
            {/* Draft Selector Tabs */}
            <div className="term-picker">
              <span className="term-picker-label">SELECT A MARKETING DRAFT TO TEST:</span>
              <div className="term-picker-pills">
                {SAMPLE_DEMOS.map((d) => (
                  <button
                    key={d.id}
                    className={`term-pill ${selectedDemo.id === d.id ? "active" : ""}`}
                    onClick={() => setSelectedDemo(d)}
                  >
                    Draft #{d.id}: “{d.quote}”
                  </button>
                ))}
              </div>
            </div>

            {/* Terminal Window */}
            <div className="term" role="region" aria-label="BrandLint Verification Console">
              <div className="bar">
                <div className="bar-dots">
                  <i></i>
                  <i></i>
                  <i></i>
                </div>
                <span className="term-title">brandlint-cli · v1.2.0 (compliance-engine)</span>
                <span className="term-status">
                  <span className="ai-dot"></span> LIVE ENGINE ACTIVE
                </span>
              </div>
              <pre key={selectedDemo.id}>
                {selectedDemo.lines.map((line, idx) => (
                  <span
                    key={idx}
                    className={`line ${line.cls}`}
                    style={{ animationDelay: `${idx * 0.08 + 0.05}s` }}
                  >
                    {line.text}
                  </span>
                ))}
              </pre>

              <div className="term-footer">
                <span className="term-quote">
                  Active Draft: <strong>“{selectedDemo.quote}”</strong>
                </span>
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => onLaunchDraft(selectedDemo.draftId, selectedDemo.persona)}
                >
                  Open in Review Desk →
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* TICKER */}
      <section className="bl-ticker" aria-hidden="true">
        <div className="bl-track">
          {[0, 1].map((k) => (
            <div key={k} className="bl-run">
              {["TONE-01 · no absolute guarantees","TERM-01 · product names","EV-4 · expired evidence blocks approval","EV-1 · 18% throughput, valid to 2026","Protected numbers need confirmation","New edit = new revision","Human sign-off required"].map((t) => <span key={t}>{t}</span>)}
            </div>
          ))}
        </div>
      </section>

      {/* 3. THREE CORE PILLARS (Bento Grid) */}
      <section id="features">
        <div className="wrap">
          <div className="section-head" data-reveal>
            <span className="eyebrow">THE THREE ARCHITECTURAL PILLARS</span>
            <h2>Complete compliance without sacrificing creator control.</h2>
            <p className="sub">
              Built on strict backend approval gates: every edit creates a new revision and
              automatically revokes prior approvals.
            </p>
          </div>

          <div className="bento">
            {/* Tile A: Claim Evidence Passport */}
            <div
              className="tile t-a" data-reveal
              onClick={() => onOpenScreen("vault")}
            >
              <div>
                <span className="tile-eyebrow">USP #1 · CITATION AS AN APPROVAL GATE</span>
                <h3>Claim Evidence Passports</h3>
                <p>
                  Every promotional claim links to an approved source, exact supporting excerpt,
                  evidence owner, and validity date. Missing or expired evidence blocks approval and
                  cannot be overridden.
                </p>
                <div className="tile-action">
                  <span className="tile-link">Inspect Evidence Vault →</span>
                </div>
              </div>
              <div className="tile-stat-box">
                <div className="big">100%</div>
                <div className="stat-sub">Citation Validity</div>
              </div>
            </div>

            {/* Tile B: Intent-Preserving Fixes */}
            <div
              className="tile t-b t-dark" data-reveal
              onClick={() => onOpenScreen("review")}
            >
              <div>
                <span className="tile-eyebrow" style={{ color: "var(--mint)" }}>
                  USP #2 · CREATOR EMPOWERMENT
                </span>
                <h3>Intent-Preserving Fixes</h3>
                <p>
                  Captures the draft's audience, purpose, and CTA. Shows visible before/after diffs
                  while guarding product names, numbers, and facts for explicit confirmation.
                </p>
              </div>
              <div className="tile-stat-box">
                <div className="big" style={{ fontSize: 36, color: "var(--mint)" }}>
                  Diffs
                </div>
                <div className="stat-sub" style={{ color: "#9aa4c4" }}>
                  Protected Guards
                </div>
              </div>
            </div>

            {/* Tile C: Guideline Health */}
            <div
              className="tile t-c" data-reveal
              onClick={() => onOpenScreen("insights")}
            >
              <div>
                <span className="tile-eyebrow">USP #3 · GOVERNANCE EVOLUTION</span>
                <h3>Guideline Health</h3>
                <p>
                  Tracks which rules reviewers repeatedly override and why. Suggests clearer wording
                  for brand-owner approval without automatic rule changes.
                </p>
              </div>
              <div className="tile-stat-box">
                <div className="big">v1 → v2</div>
                <div className="stat-sub">Continuous Tuning</div>
              </div>
            </div>

            {/* Tile D: Deterministic Pre-Flight & AI Schema */}
            <div
              className="tile t-d" data-reveal
              onClick={() => onOpenScreen("library")}
            >
              <div>
                <span className="tile-eyebrow">HYBRID EVALUATION ENGINE</span>
                <h3>Deterministic Checks + Strict Schema Validation</h3>
                <p>
                  Fast regex terminology and expiry checks run first. LLM outputs are strictly
                  validated against JSON schemas, rejecting hallucinated source IDs and prompt injections.
                </p>
                <div className="tile-action">
                  <span className="tile-link">View Ingested Rules in Library →</span>
                </div>
              </div>
              <div className="bars" aria-hidden="true">
                <span style={{ height: "30%" }}></span>
                <span style={{ height: "55%" }}></span>
                <span style={{ height: "40%" }}></span>
                <span style={{ height: "70%" }}></span>
                <span style={{ height: "90%" }}></span>
                <span style={{ height: "100%" }}></span>
                <span style={{ height: "85%" }}></span>
                <span style={{ height: "60%" }}></span>
                <span style={{ height: "45%" }}></span>
                <span style={{ height: "35%" }}></span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. MEASURED BENCHMARKS (Enterprise Grade) */}
      <section className="dark" id="scale">
        <div className="wrap">
          <div className="section-head" data-reveal>
            <span className="eyebrow" style={{ color: "var(--mint)" }}>
              MEASURED BENCHMARK EVALUATION
            </span>
            <h2 style={{ color: "#fff" }}>Rigorous, measured verification.</h2>
            <p className="sub" style={{ color: "#94a3b8" }}>
              Tested against 18 labeled drafts across edge cases, unsupported claims, expired evidence,
              and compliant examples.
            </p>
          </div>

          <div className="grid3">
            <div className="stat-card" data-reveal>
              <div className="stat"><Count to={100} suffix="%" /></div>
              <h4>Citation Validity</h4>
              <p>Every claim links to an approved source excerpt; zero invented or invalid citation IDs.</p>
            </div>
            <div className="stat-card" data-reveal>
              <div className="stat"><Count to={0} suffix="%" /></div>
              <h4>False Alarm Rate</h4>
              <p>Clean, guideline-compliant drafts produce zero blocking findings or false flags.</p>
            </div>
            <div className="stat-card" data-reveal>
              <div className="stat"><Count to={100} suffix="%" /></div>
              <h4>Approval Gate Enforcement</h4>
              <p>Edits create new revisions and instantly invalidate previous human sign-offs on the backend.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. 5-STEP WALKTHROUGH */}
      <section id="walkthrough">
        <div className="wrap">
          <div className="section-head" data-reveal>
            <span className="eyebrow">STEP-BY-STEP REVIEW DESK LIFECYCLE</span>
            <h2>The Repeatable Pitch Journey</h2>
            <p className="sub">
              Experience the end-to-end workflow from checking a draft to senior human approval:
            </p>
          </div>

          <div className="pitch-cards">
            {[
              {
                step: 1,
                title: "Check the Hero Draft",
                desc: "Select “Launch email - productivity claim” and run BrandLint checks.",
                action: () => onLaunchStep(0),
              },
              {
                step: 2,
                title: "Inspect Expired Proof",
                desc: "Open EV-4 passport. Accept tone fix, then test approval gate—expired proof blocks sign-off!",
                action: () => onLaunchStep(1),
              },
              {
                step: 3,
                title: "Evidence-Backed Replacement",
                desc: "Replace with verified 18% throughput claim and confirm protected number change.",
                action: () => onLaunchStep(2),
              },
              {
                step: 4,
                title: "Senior Human Sign-Off",
                desc: "Switch to Senior Reviewer Riley Chen and approve Revision #4 with an immutable audit log.",
                action: () => onLaunchStep(3),
              },
              {
                step: 5,
                title: "Guideline Health Evolution",
                desc: "Inspect TONE-01 override count, propose clearer wording, and approve v2 as Brand Owner.",
                action: () => onLaunchStep(4),
              },
            ].map((card) => (
              <div
                key={card.step}
                className="pitch-card" data-reveal
                onClick={card.action}
              >
                <div className="pitch-card-step">STEP 0{card.step}</div>
                <h4>{card.title}</h4>
                <p>{card.desc}</p>
                <span className="pitch-card-link">Launch step →</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. FINAL ACTION SECTION */}
      <section className="final dark" id="launch">
        <div className="wrap">
          <span className="eyebrow" style={{ color: "var(--mint)" }}>
            READY FOR REVIEW
          </span>
          <h2 style={{ color: "#fff" }}>Inspect, verify, and approve with confidence.</h2>
          <div className="cta" style={{ marginTop: 28 }}>
            <button
              className="btn btn-primary"
              onClick={() => onLaunchDraft(1, "casey@lumina.demo")}
            >
              Launch Hero Demo Draft →
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => onOpenScreen("library")}
              style={{ color: "#8fb0ff", borderColor: "rgba(143, 176, 255, 0.3)" }}
            >
              Upload Brand Guidelines →
            </button>
          </div>
        </div>
      </section>

      {/* 7. FOOTER */}
      <footer>
        <div className="wrap">
          <span>BrandLint Enterprise Review Desk · Hackathon MVP</span>
          <span>Verified Citations · Intent Preservation · Guideline Health</span>
        </div>
      </footer>
    </div>
  );
};
