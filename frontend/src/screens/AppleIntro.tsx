import React, { useRef, useState } from "react";
import { Count, useIntroMotion } from "../components/Motion";
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
  const [showCli, setShowCli] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useIntroMotion(rootRef);

  return (
    <div className="crypgo-page" ref={rootRef} id="top">
      {/* 1. HERO SECTION (Split 2-Column Grid matching reference image) */}
      <section className="crypgo-hero">
        <div className="crypgo-wrap">
          <div className="crypgo-hero-grid">
            {/* Left Column: Heading, description, CTA buttons */}
            <div className="crypgo-hero-left">
              <div className="crypgo-pill-badge">
                <span className="pill-dot-green"></span>
                <span className="pill-text-mint">Future of brand governance</span>
              </div>

              <h1 className="crypgo-hero-title">
                Fast and Secure Brand Governance Exchange
              </h1>

              <p className="crypgo-hero-lead">
                Verify promotional claims with ease, security, and advanced intent-preserving
                features on our cutting-edge review platform.
              </p>

              <div className="crypgo-hero-cta">
                <button
                  type="button"
                  className="btn-crypgo-green"
                  onClick={() => onOpenScreen("review")}
                >
                  Explore Review Desk →
                </button>
                <button
                  type="button"
                  className="btn-crypgo-ghost"
                  onClick={() => onOpenScreen("vault")}
                >
                  Inspect Evidence Vault
                </button>
              </div>

              <div className="crypgo-hero-stats-row">
                <div className="mini-stat">
                  <div className="mini-stat-num">
                    <Count to={100} suffix="%" />
                  </div>
                  <div className="mini-stat-lbl">Citation Validity</div>
                </div>
                <div className="mini-stat-div" />
                <div className="mini-stat">
                  <div className="mini-stat-num">
                    <Count to={0} suffix="%" />
                  </div>
                  <div className="mini-stat-lbl">False Alarm Rate</div>
                </div>
                <div className="mini-stat-div" />
                <div className="mini-stat">
                  <div className="mini-stat-num">Zero Bypass</div>
                  <div className="mini-stat-lbl">Human Gate Lock</div>
                </div>
              </div>
            </div>

            {/* Right Column: High-tech Phone Mockup + Floating VISA Passport Card */}
            <div className="crypgo-hero-right">
              <div className="device-showcase-wrap">
                {/* Smartphone Device Container */}
                <div className="device-frame">
                  <div className="device-top-notch" />

                  {/* Device Header */}
                  <div className="device-header">
                    <div>
                      <div className="device-sublabel">Policy Health</div>
                      <div className="device-title">Compliance Score <span className="stat-pill">+94.8%</span></div>
                    </div>
                    {/* Glowing Circular Progress Ring */}
                    <div className="device-circle-meter">
                      <svg width="44" height="44" viewBox="0 0 40 40">
                        <circle cx="20" cy="20" r="16" fill="transparent" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
                        <circle cx="20" cy="20" r="16" fill="transparent" stroke="#22c55e" strokeWidth="3" strokeDasharray="100" strokeDashoffset="6" strokeLinecap="round" transform="rotate(-90 20 20)" />
                      </svg>
                      <span className="meter-val">100%</span>
                    </div>
                  </div>

                  {/* Live Waveform Graph */}
                  <div className="device-chart-area">
                    <svg viewBox="0 0 260 90" className="device-chart-svg" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#22c55e" stopOpacity="0.35" />
                          <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <path d="M0,60 C40,75 70,30 110,45 C150,60 180,15 220,25 C240,30 250,10 260,15 L260,90 L0,90 Z" fill="url(#chartGrad)" />
                      <path d="M0,60 C40,75 70,30 110,45 C150,60 180,15 220,25 C240,30 250,10 260,15" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" />
                    </svg>
                    <div className="chart-timeline-labels">
                      <span>1m</span><span>15m</span><span>1h</span><span>24h</span><span className="time-active">1w</span>
                    </div>
                  </div>

                  {/* Device Bottom List */}
                  <div className="device-bottom-list">
                    <div className="device-list-item">
                      <div className="coin-dot dot-btc">✓</div>
                      <div className="item-info">
                        <span className="item-name">Rule TONE-01</span>
                        <span className="item-sub">Zero Absolutes · Intent Preserved</span>
                      </div>
                      <span className="item-status status-ok">Enforced</span>
                    </div>
                    <div className="device-list-item">
                      <div className="coin-dot dot-eth">🛡</div>
                      <div className="item-info">
                        <span className="item-name">Passport EV-1</span>
                        <span className="item-sub">18% Throughput Benchmark</span>
                      </div>
                      <span className="item-status status-ok">Verified</span>
                    </div>
                  </div>
                </div>

                {/* Floating Claim Evidence Passport Card */}
                <div className="floating-visa-card">
                  <div className="visa-top-row">
                    <div className="visa-chip">
                      <svg width="28" height="22" viewBox="0 0 28 22" fill="none">
                        <rect width="28" height="22" rx="4" fill="#22c55e" />
                        <line x1="0" y1="11" x2="28" y2="11" stroke="#15803d" />
                        <line x1="14" y1="0" x2="14" y2="22" stroke="#15803d" />
                      </svg>
                    </div>
                    <span className="visa-wordmark" style={{ fontSize: "11px", letterSpacing: "0.1em", color: "#4ade80" }}>
                      PASSPORT EV-1
                    </span>
                  </div>

                  <div className="visa-card-number" style={{ fontSize: "11.5px" }}>
                    EV-2025-BENCHMARK-01
                  </div>

                  <div className="visa-bottom-row">
                    <div>
                      <div className="visa-label">PROOF CLAIM</div>
                      <div className="visa-val" style={{ fontSize: "9.5px", maxWidth: "120px" }}>18% Throughput p.2</div>
                    </div>
                    <div>
                      <div className="visa-label">VALIDITY</div>
                      <div className="visa-val" style={{ color: "#22c55e" }}>DEC 2026</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. TRUSTED BY LOGO STRIP */}
      <section className="crypgo-trust-section">
        <div className="crypgo-wrap">
          <div className="trust-label">
            Trusted by enterprise marketing & compliance teams at
          </div>

          <div className="trust-logos-row">
            <div className="trust-logo-item">
              <span className="logo-symbol">❖</span> Lumina
            </div>
            <div className="trust-logo-item">
              <span className="logo-symbol green">✦</span> DataCore
            </div>
            <div className="trust-logo-item">
              <span className="logo-symbol orange">☼</span> CloudScale
            </div>
            <div className="trust-logo-item">
              <span className="logo-symbol purple">◒</span> Veloce
            </div>
            <div className="trust-logo-item">
              <span className="logo-symbol cyan">◎</span> Apex Cloud
            </div>
            <div className="trust-logo-item">
              <span className="logo-symbol lime">◉</span> Horizon
            </div>
          </div>
        </div>
      </section>

      {/* 3. 4 FEATURED GOVERNANCE BENCHMARK CARDS */}
      <section className="crypgo-cards-section" id="metrics">
        <div className="crypgo-wrap">
          <div className="section-head-center">
            <span className="eyebrow-mint">CORE GOVERNANCE BENCHMARKS</span>
            <h2>Real-Time Compliance & Audit Metrics</h2>
          </div>

          <div className="crypgo-grid-4">
            {/* Card 1: Tone Policy Enforcement */}
            <div className="crypgo-stat-card" onClick={() => onLaunchStep(0)}>
              <div className="card-coin-icon coin-gold">
                <span>🛡</span>
              </div>
              <div className="card-coin-pair">Tone Policy <span className="pair-sub">TONE-01</span></div>
              <div className="card-coin-price">0 Bypasses</div>
              <div className="card-coin-sub">Absolute Guarantees Blocked</div>
            </div>

            {/* Card 2: Evidence Vault Verification */}
            <div className="crypgo-stat-card active-card" onClick={() => onLaunchStep(2)}>
              <div className="card-coin-icon coin-orange">
                <span>📜</span>
              </div>
              <div className="card-coin-pair">Evidence Vault <span className="pair-sub">EV-1</span></div>
              <div className="card-coin-price">100%</div>
              <div className="card-coin-sub">Citation Validity Verified</div>
            </div>

            {/* Card 3: Deterministic Scanner */}
            <div className="crypgo-stat-card" onClick={() => onLaunchStep(1)}>
              <div className="card-coin-icon coin-cyan">
                <span>⚡</span>
              </div>
              <div className="card-coin-pair">Deterministic Scanner <span className="pair-sub">REGEX</span></div>
              <div className="card-coin-price">0.0%</div>
              <div className="card-coin-sub">Zero False Alarm Rate</div>
            </div>

            {/* Card 4: Human Sign-Off Gate */}
            <div className="crypgo-stat-card" onClick={() => onLaunchStep(3)}>
              <div className="card-coin-icon coin-bronze">
                <span>🔒</span>
              </div>
              <div className="card-coin-pair">Approval Gate <span className="pair-sub">MULTI-ROLE</span></div>
              <div className="card-coin-price">Zero Bypass</div>
              <div className="card-coin-sub">Human Sign-off Enforced</div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. BOTTOM FEATURES SPLIT SECTION */}
      <section className="crypgo-features-section" id="features">
        <div className="crypgo-wrap">
          <div className="crypgo-features-grid">
            {/* Left: Headline & 3 Icon Benefit Rows */}
            <div className="features-left-col">
              <div className="eyebrow-mint">Why Choose BrandLint Enterprise</div>
              <h2>Intelligent Brand Governance & Real-Time Evidence Verification</h2>

              <div className="feature-rows-list">
                <div className="feature-benefit-item" onClick={() => onOpenScreen("review")}>
                  <div className="benefit-icon-box">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                    </svg>
                  </div>
                  <div>
                    <h4>Deterministic Terminology & Pre-Flight Scans</h4>
                    <p>Instant regex checks for brand terms, prohibited phrasing, and capitalization rules before LLM inference.</p>
                  </div>
                </div>

                <div className="feature-benefit-item" onClick={() => onOpenScreen("vault")}>
                  <div className="benefit-icon-box">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                      <path d="m9 12 2 2 4-4"/>
                    </svg>
                  </div>
                  <div>
                    <h4>Evidence Vault Proof Citations (EV-1 to EV-4)</h4>
                    <p>Every performance statistic links to peer-reviewed whitepapers with author provenance and expiry dates.</p>
                  </div>
                </div>

                <div className="feature-benefit-item" onClick={() => onOpenScreen("queue")}>
                  <div className="benefit-icon-box">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <circle cx="12" cy="12" r="3"/>
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                    </svg>
                  </div>
                  <div>
                    <h4>Immutable Multi-Role Human Gate Lock</h4>
                    <p>Text edits automatically invalidate prior approvals, requiring explicit Senior Reviewer sign-off.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Live Drafts in Review Workflow (formerly crypto portfolio) */}
            <div className="features-right-col">
              <div className="portfolio-glass-card">
                <div className="portfolio-head">
                  <span className="portfolio-label">Active Drafts in Review Workflow</span>
                  <span className="portfolio-badge-green">Live Pipeline</span>
                </div>

                <div className="portfolio-items-list">
                  <div className="portfolio-row" onClick={() => onLaunchDraft(1, "casey@lumina.demo")}>
                    <div className="portfolio-coin-badge badge-orange">01</div>
                    <div className="portfolio-details">
                      <div className="coin-name">Hero Launch Email</div>
                      <div className="coin-symbol">Lumina Cloud · Casey</div>
                    </div>
                    <div className="portfolio-sparkline">
                      <svg width="60" height="20" viewBox="0 0 60 20">
                        <path d="M0,15 Q15,5 30,12 T60,4" fill="none" stroke="#ef4444" strokeWidth="2"/>
                      </svg>
                    </div>
                    <div className="portfolio-percent" style={{ color: "#ef4444" }}>1 Blocker (EV-4)</div>
                  </div>

                  <div className="portfolio-row" onClick={() => onLaunchDraft(2, "casey@lumina.demo")}>
                    <div className="portfolio-coin-badge badge-cyan">02</div>
                    <div className="portfolio-details">
                      <div className="coin-name">Nimbus Pricing Post</div>
                      <div className="coin-symbol">Social Promo · Casey</div>
                    </div>
                    <div className="portfolio-sparkline">
                      <svg width="60" height="20" viewBox="0 0 60 20">
                        <path d="M0,8 Q20,16 40,6 T60,10" fill="none" stroke="#f59e0b" strokeWidth="2"/>
                      </svg>
                    </div>
                    <div className="portfolio-percent" style={{ color: "#f59e0b" }}>2 Warnings</div>
                  </div>

                  <div className="portfolio-row" onClick={() => onLaunchDraft(3, "riley@lumina.demo")}>
                    <div className="portfolio-coin-badge badge-gold">03</div>
                    <div className="portfolio-details">
                      <div className="coin-name">Benchmark Case Study</div>
                      <div className="coin-symbol">Whitepaper Promo · Riley</div>
                    </div>
                    <div className="portfolio-sparkline">
                      <svg width="60" height="20" viewBox="0 0 60 20">
                        <path d="M0,18 Q15,10 30,14 T60,6" fill="none" stroke="#22c55e" strokeWidth="2"/>
                      </svg>
                    </div>
                    <div className="portfolio-percent green">100% Ready (EV-1)</div>
                  </div>

                  <div className="portfolio-row" onClick={() => onOpenScreen("queue")}>
                    <div className="portfolio-coin-badge badge-silver">04</div>
                    <div className="portfolio-details">
                      <div className="coin-name">SOC-2 Security Update</div>
                      <div className="coin-symbol">Compliance Blog · Olivia</div>
                    </div>
                    <div className="portfolio-sparkline">
                      <svg width="60" height="20" viewBox="0 0 60 20">
                        <path d="M0,12 Q20,4 40,15 T60,8" fill="none" stroke="#22c55e" strokeWidth="2"/>
                      </svg>
                    </div>
                    <div className="portfolio-percent green">In Queue</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. INTERACTIVE CLI ENGINE CONSOLE (Accessible directly on landing page) */}
      <section className="crypgo-console-section" id="platform">
        <div className="crypgo-wrap">
          <SecuritySealsRow />

          <div className="console-expand-bar">
            <div>
              <span className="eyebrow-mint">LIVE COMPLIANCE ENGINE CONSOLE</span>
              <h3 style={{ margin: "4px 0 0", color: "#ffffff", fontSize: "22px" }}>
                Test Marketing Drafts Against Real-Time Rule Engine
              </h3>
            </div>
            <button
              type="button"
              className="btn-crypgo-ghost"
              onClick={() => setShowCli(!showCli)}
            >
              {showCli ? "Minimize Console ▲" : "Launch Interactive Terminal ▼"}
            </button>
          </div>

          {showCli && (
            <div className="stage" style={{ marginTop: 18 }}>
              <div className="term-picker">
                <span className="term-picker-label">SELECT A MARKETING DRAFT TO TEST:</span>
                <div className="term-picker-pills">
                  {SAMPLE_DEMOS.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      className={`term-pill ${selectedDemo.id === d.id ? "active" : ""}`}
                      onClick={() => setSelectedDemo(d)}
                    >
                      Draft #{d.id}: “{d.quote}”
                    </button>
                  ))}
                </div>
              </div>

              <div className="term" role="region" aria-label="BrandLint Verification Console">
                <div className="bar">
                  <div className="bar-dots">
                    <i></i><i></i><i></i>
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
                    type="button"
                    className="btn btn-sm btn-primary"
                    onClick={() => onLaunchDraft(selectedDemo.draftId, selectedDemo.persona)}
                  >
                    Open in Review Desk →
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 6. FOOTER */}
      <footer className="crypgo-footer">
        <div className="crypgo-wrap footer-inner">
          <div className="footer-left">
            <span className="footer-brand">BrandLint Enterprise Review Desk</span>
            <span className="footer-tag">Audit-Grade Brand Protection & Claim Citations</span>
          </div>
          <div className="footer-links">
            <button type="button" className="footer-link-btn" onClick={() => onOpenScreen("library")}>Brand Library</button>
            <button type="button" className="footer-link-btn" onClick={() => onOpenScreen("review")}>Draft Review</button>
            <button type="button" className="footer-link-btn" onClick={() => onOpenScreen("vault")}>Evidence Vault</button>
            <button type="button" className="footer-link-btn" onClick={() => onOpenScreen("queue")}>Review Queue</button>
            <button type="button" className="footer-link-btn" onClick={() => onOpenScreen("insights")}>Insights</button>
          </div>
        </div>
      </footer>
    </div>
  );
};
