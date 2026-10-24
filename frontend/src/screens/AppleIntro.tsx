import React, { useState } from "react";

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
      { text: "› Ingesting 10 brand guidelines & Evidence Vault candidate proofs...", cls: "dim" },
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
      { text: "✓ Ready for human sign-off: Route Senior Reviewer", cls: "ok" },
    ],
  },
];

export const AppleIntro: React.FC<Props> = ({
  onOpenScreen,
  onLaunchDraft,
  onLaunchStep,
}) => {
  const [selectedDemo, setSelectedDemo] = useState(SAMPLE_DEMOS[0]);

  return (
    <div className="apple-intro">
      {/* 1. APPLE HERO SECTION */}
      <header className="hero" id="top">
        <div className="wrap">
          <div className="eyebrow" style={{ marginBottom: 12 }}>
            SPELL-CHECK FOR YOUR BRAND
          </div>
          <h1>Every claim verified. Every approval human.</h1>
          <p className="lead">
            Upload approved guidelines and evidence, test marketing drafts against deterministic and
            AI checks, inspect proof passports, and obtain senior human sign-off before publishing.
          </p>
          <div className="cta">
            <button
              className="btn"
              onClick={() => onLaunchDraft(1, "casey@lumina.demo")}
            >
              Try Hero Demo (40% Claim) ›
            </button>
            <button
              className="btn ghost"
              onClick={() => onOpenScreen("review")}
            >
              Open Review Desk
            </button>
            <button
              className="btn ghost"
              onClick={() => onOpenScreen("vault")}
            >
              Evidence Vault ›
            </button>
          </div>
        </div>

        {/* 2. THE STAGE (Apple Curvature + Glowing Terminal) */}
        <div className="wrap">
          <div className="stage">
            {/* Interactive Draft Selector Pills */}
            <div className="term-picker">
              <span className="term-picker-label">CHOOSE A MARKETING DRAFT:</span>
              <div className="term-picker-pills">
                {SAMPLE_DEMOS.map((d) => (
                  <button
                    key={d.id}
                    className={`term-pill ${selectedDemo.id === d.id ? "active" : ""}`}
                    onClick={() => setSelectedDemo(d)}
                  >
                    Draft #{d.id}: {d.quote}
                  </button>
                ))}
              </div>
            </div>

            {/* Apple Terminal Window */}
            <div className="term" role="region" aria-label="BrandLint Realtime Engine Terminal">
              <div className="bar">
                <i></i>
                <i></i>
                <i></i>
                <span className="term-title">brandlint-engine · v1.2</span>
                <span className="term-status">
                  <span className="ai-dot"></span> LIVE EVALUATION
                </span>
              </div>
              <pre key={selectedDemo.id}>
                {selectedDemo.lines.map((line, idx) => (
                  <span
                    key={idx}
                    className={`line ${line.cls}`}
                    style={{ animationDelay: `${idx * 0.12 + 0.1}s` }}
                  >
                    {line.text}
                  </span>
                ))}
              </pre>

              <div className="term-footer">
                <span className="term-quote">
                  Active Draft: <strong>"{selectedDemo.quote}"</strong>
                </span>
                <button
                  className="btn btn-sm btn-term-launch"
                  onClick={() => onLaunchDraft(selectedDemo.draftId, selectedDemo.persona)}
                >
                  Inspect in Review Desk ↗
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* 3. APPLE BENTO TILES (The 3 Flagship USPs) */}
      <section id="features">
        <div className="wrap">
          <div className="eyebrow">THE THREE FLAGSHIP INNOVATIONS</div>
          <h2>Everything your brand needs to stay compliant.</h2>
          <p className="sub">
            BrandLint connects every finding to a rule, every promotional claim to evidence, and
            every approval to a human reviewer.
          </p>

          <div className="bento">
            {/* Tile A: Claim Evidence Passport */}
            <div
              className="tile t-a"
              onClick={() => onOpenScreen("vault")}
              style={{ cursor: "pointer" }}
            >
              <div>
                <span className="tile-eyebrow">USP #1 · CITATIONS BECOME APPROVAL GATES</span>
                <h3>Claim Evidence Passport</h3>
                <p>
                  Every promotional claim links to an approved source, exact supporting excerpt,
                  evidence owner, and validity date. Missing or expired evidence strictly blocks
                  approval and cannot be overridden.
                </p>
                <div style={{ marginTop: 20 }}>
                  <button className="btn btn-sm">Inspect Evidence Vault ›</button>
                </div>
              </div>
              <div className="big">100%</div>
            </div>

            {/* Tile B: Intent-Preserving Fixes */}
            <div
              className="tile t-b t-dark"
              onClick={() => onOpenScreen("review")}
              style={{ cursor: "pointer" }}
            >
              <div>
                <span className="tile-eyebrow" style={{ color: "var(--mint)" }}>
                  USP #2 · CREATOR CONTROL
                </span>
                <h3>Intent-Preserving Fixes</h3>
                <p>
                  Captures the draft's audience, purpose, and CTA. Shows visible before/after diffs
                  while protecting product names, numbers, and facts with explicit review gates.
                </p>
              </div>
              <div className="big" style={{ fontSize: 44 }}>
                Diffs
              </div>
            </div>

            {/* Tile C: Guideline Health */}
            <div
              className="tile t-c"
              onClick={() => onOpenScreen("insights")}
              style={{ cursor: "pointer" }}
            >
              <div>
                <span className="tile-eyebrow">USP #3 · SELF-IMPROVING RULES</span>
                <h3>Guideline Health</h3>
                <p>
                  Tracks which rules reviewers repeatedly override and why. Suggests clearer wording
                  requiring brand-owner approval without automatic rule changes.
                </p>
              </div>
              <div className="big">v1 → v2</div>
            </div>

            {/* Tile D: Dual-Engine & Schema Validator */}
            <div
              className="tile t-d"
              onClick={() => onOpenScreen("library")}
              style={{ cursor: "pointer" }}
            >
              <div>
                <span className="tile-eyebrow">DUAL-ENGINE ACCELERATION</span>
                <h3>Deterministic Terminology + Strict AI Validation</h3>
                <p>
                  Fast regex terminology and expiry checks run first. AI findings and rewrites are
                  strictly validated against JSON schemas—rejecting invented citations and prompt
                  injections.
                </p>
                <div style={{ marginTop: 16 }}>
                  <button className="btn btn-sm ghost">Inspect Brand Library ›</button>
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

      {/* 4. APPLE DARK BAND: SCALE & GOVERNANCE */}
      <section className="dark" id="scale">
        <div className="wrap">
          <div className="eyebrow" style={{ color: "var(--mint)" }}>
            MEASURED BENCHMARKS & GOVERNANCE
          </div>
          <h2>Built for strict enterprise compliance.</h2>
          <p className="sub">
            Verified across 18 benchmark drafts with zero false alarms and 100% citation integrity.
          </p>

          <div className="grid3">
            <div>
              <div className="stat">100%</div>
              <h4>Citation Validity</h4>
              <p>Every claim links to an approved source excerpt or is marked as missing/expired.</p>
            </div>
            <div>
              <div className="stat">0%</div>
              <h4>False Alarm Rate</h4>
              <p>Clean, guideline-compliant drafts produce 0 blocking findings or false positives.</p>
            </div>
            <div>
              <div className="stat">100%</div>
              <h4>Enforceable Approval Gates</h4>
              <p>Edits create new revisions and instantly invalidate previous human approval.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. STEP-BY-STEP PITCH WALKTHROUGH */}
      <section id="walkthrough">
        <div className="wrap">
          <div className="eyebrow">REPEATABLE HACKATHON PITCH</div>
          <h2>Step-by-step review journey.</h2>
          <p className="sub">
            Follow the complete review desk lifecycle: check a draft, inspect evidence, accept fixes,
            and sign off as a senior reviewer.
          </p>

          <div className="pitch-cards">
            {[
              {
                step: 1,
                title: "Check the Hero Draft",
                desc: "Submit “Our platform guarantees 40% higher productivity.” and run BrandLint checks.",
                action: () => onLaunchStep(0),
              },
              {
                step: 2,
                title: "Inspect Expired Proof",
                desc: "Open EV-4 passport. Accept tone fix, then test approval gate—expired proof still blocks!",
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
                className="pitch-card"
                onClick={card.action}
                style={{ cursor: "pointer" }}
              >
                <div className="pitch-card-step">0{card.step}</div>
                <h4>{card.title}</h4>
                <p>{card.desc}</p>
                <span className="pitch-card-link">Launch step →</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. FINAL APPLE CTA SECTION */}
      <section className="final dark" id="launch">
        <div className="wrap">
          <div className="eyebrow" style={{ color: "var(--mint)" }}>
            TRY BRANDLINT NOW
          </div>
          <h2>Spell-check your brand before the world reads it.</h2>
          <div className="cta">
            <button
              className="btn"
              onClick={() => onLaunchDraft(1, "casey@lumina.demo")}
            >
              Launch Hero Demo Draft ›
            </button>
            <button
              className="btn ghost"
              onClick={() => onOpenScreen("library")}
              style={{ color: "#8fb0ff" }}
            >
              Upload Brand Guidelines ›
            </button>
          </div>
        </div>
      </section>

      {/* 7. APPLE-STYLE FOOTER */}
      <footer>
        <div className="wrap">
          <span>© 2026 BrandLint, Inc. · Built for Hackathon Demo</span>
          <span>Citations · Intent Preservation · Guideline Health</span>
        </div>
      </footer>
    </div>
  );
};
