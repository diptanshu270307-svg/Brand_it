import React, { useState } from "react";

// ============================================================================
// 1. Global Interactive Workflow Pipeline Flowchart (Header / App level)
// ============================================================================
interface PipelineProps {
  activeStep: number;
  onStepClick: (stepIndex: number) => void;
}

export const GlobalWorkflowFlowchart: React.FC<PipelineProps> = ({
  activeStep,
  onStepClick,
}) => {
  const [collapsed, setCollapsed] = useState(false);

  const steps = [
    {
      num: "01",
      title: "Ingest Guidelines",
      subtitle: "PDF / Rules Extractor",
      role: "Brand Owner",
      screen: "library",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
        </svg>
      ),
    },
    {
      num: "02",
      title: "Scan & Pre-Flight",
      subtitle: "Tone, Terms & Logic",
      role: "Creator",
      screen: "review",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="22" y1="12" x2="18" y2="12"/>
          <line x1="6" y1="12" x2="2" y2="12"/>
          <line x1="12" y1="6" x2="12" y2="2"/>
          <line x1="12" y1="22" x2="12" y2="18"/>
        </svg>
      ),
    },
    {
      num: "03",
      title: "Evidence Passport",
      subtitle: "Verify Claims & Proof",
      role: "Creator",
      screen: "vault",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          <path d="m9 12 2 2 4-4"/>
        </svg>
      ),
    },
    {
      num: "04",
      title: "Human Sign-Off",
      subtitle: "Senior Reviewer Gate",
      role: "Reviewer",
      screen: "queue",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="m16 11 2 2 4-4"/>
        </svg>
      ),
    },
    {
      num: "05",
      title: "Policy Evolution",
      subtitle: "Guideline Health & Fixes",
      role: "Brand Owner",
      screen: "insights",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        </svg>
      ),
    },
  ];

  return (
    <div className="flowchart-pipeline-wrap">
      <div className="flowchart-pipeline-header">
        <div className="flowchart-title-group">
          <span className="flowchart-badge">LIVE GOVERNANCE PIPELINE</span>
          <span className="flowchart-heading">Interactive End-to-End Workflow</span>
        </div>
        <button
          className="btn-toggle-pipeline"
          onClick={() => setCollapsed(!collapsed)}
          title="Toggle pipeline flowchart view"
        >
          {collapsed ? "Show Workflow Flowchart ▼" : "Minimize Flowchart ▲"}
        </button>
      </div>

      {!collapsed && (
        <div className="pipeline-flowchart-nodes">
          {steps.map((st, idx) => {
            const isCurrent = activeStep === idx;
            const isPast = activeStep > idx;

            return (
              <React.Fragment key={st.num}>
                <button
                  type="button"
                  className={`pipeline-node ${isCurrent ? "node-active" : ""} ${
                    isPast ? "node-past" : ""
                  }`}
                  onClick={() => onStepClick(idx)}
                >
                  <div className="node-top-bar">
                    <span className="node-step-tag">{st.num}</span>
                    <span className="node-role-pill">{st.role}</span>
                  </div>
                  <div className="node-icon-box">{st.icon}</div>
                  <div className="node-title">{st.title}</div>
                  <div className="node-subtitle">{st.subtitle}</div>
                  {isCurrent && <span className="node-current-beacon">ACTIVE STAGE</span>}
                </button>

                {idx < steps.length - 1 && (
                  <div className={`pipeline-arrow-wrap ${isPast ? "arrow-past" : ""}`}>
                    <svg
                      width="28"
                      height="20"
                      viewBox="0 0 28 20"
                      fill="none"
                      className="pipeline-arrow-svg"
                    >
                      <path
                        d="M2 10H22M22 10L14 3M22 10L14 17"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 2. Brand Library Architecture Flowchart
// ============================================================================
export const BrandLibraryArchitectureFlowchart: React.FC = () => {
  return (
    <div className="arch-flowchart-card">
      <div className="arch-header">
        <div>
          <span className="eyebrow" style={{ color: "var(--primary)" }}>
            PIPELINE ARCHITECTURE
          </span>
          <h3 style={{ margin: "4px 0", fontSize: "20px" }}>
            How Guidelines Transform Into Live Enforced Rules
          </h3>
        </div>
        <div className="security-badge">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          Untrusted Prompt Injection Isolation Active
        </div>
      </div>

      <div className="arch-diagram-row">
        {/* Step 1 */}
        <div className="arch-step-box">
          <div className="arch-icon-tag bg-blue">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
          </div>
          <div className="arch-step-title">1. Document Input</div>
          <div className="arch-step-desc">Text-based PDF or raw policy text uploaded by user.</div>
          <span className="arch-pill pill-data">Untrusted Data</span>
        </div>

        {/* Arrow */}
        <div className="arch-connector">
          <svg width="32" height="24" viewBox="0 0 32 24" fill="none">
            <path d="M4 12H26M26 12L18 5M26 12L18 19" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>

        {/* Step 2 */}
        <div className="arch-step-box">
          <div className="arch-icon-tag bg-purple">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="4" y="4" width="16" height="16" rx="2"/>
              <rect x="9" y="9" width="6" height="6"/>
              <line x1="9" y1="1" x2="9" y2="4"/>
              <line x1="15" y1="1" x2="15" y2="4"/>
              <line x1="9" y1="20" x2="9" y2="23"/>
              <line x1="15" y1="20" x2="15" y2="23"/>
            </svg>
          </div>
          <div className="arch-step-title">2. Sandbox & Parser</div>
          <div className="arch-step-desc">Isolates instructions, detects jailbreaks & extracts rule candidates.</div>
          <span className="arch-pill pill-ai">Deterministic + Schema AI</span>
        </div>

        {/* Arrow */}
        <div className="arch-connector">
          <svg width="32" height="24" viewBox="0 0 32 24" fill="none">
            <path d="M4 12H26M26 12L18 5M26 12L18 19" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>

        {/* Step 3 */}
        <div className="arch-step-box arch-highlight">
          <div className="arch-icon-tag bg-amber">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <path d="m9 12 2 2 4-4"/>
            </svg>
          </div>
          <div className="arch-step-title">3. Human Review Gate</div>
          <div className="arch-step-desc">Extracted rules stay "Proposed" until Brand Owner explicitly approves.</div>
          <span className="arch-pill pill-gate">Human Sign-Off Gate</span>
        </div>

        {/* Arrow */}
        <div className="arch-connector">
          <svg width="32" height="24" viewBox="0 0 32 24" fill="none">
            <path d="M4 12H26M26 12L18 5M26 12L18 19" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>

        {/* Step 4 */}
        <div className="arch-step-box">
          <div className="arch-icon-tag bg-green">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          </div>
          <div className="arch-step-title">4. Active Rule Engine</div>
          <div className="arch-step-desc">Enforced across all drafts with page-level citations & regex patterns.</div>
          <span className="arch-pill pill-active">10 Active Rules</span>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 3. Draft Review Compliance Flowchart & Chevron Pipeline Track
// ============================================================================
export interface ChevronPipelineProps {
  activeStep?: number;
  onStepClick?: (stepIndex: number) => void;
  onNewDraft?: () => void;
}

export const DraftReviewChevronPipeline: React.FC<ChevronPipelineProps> = ({
  activeStep = 0,
  onStepClick,
  onNewDraft,
}) => {
  const steps = [
    { num: 1, title: "Marketing Copy" },
    { num: 2, title: "Pre-Flight Lint" },
    { num: 3, title: "Evidence Match" },
    { num: 4, title: "Intent Fixes" },
    { num: 5, title: "Backend Gate" },
  ];

  return (
    <div className="pipeline-chevron-bar">
      {onNewDraft && (
        <button
          type="button"
          className="btn-new-draft-neon"
          onClick={onNewDraft}
        >
          <span className="plus-sym">+</span> New Draft
        </button>
      )}
      <div className="chevron-segments-wrap">
        {steps.map((st, idx) => {
          const isActive = activeStep === idx;
          return (
            <div
              key={st.num}
              className={`chevron-segment ${isActive ? "active" : ""}`}
              onClick={() => onStepClick && onStepClick(idx)}
            >
              <span className="chevron-title">{st.num}. {st.title}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const DraftReviewFlowchart: React.FC = () => {
  return <DraftReviewChevronPipeline activeStep={0} />;
};

// ============================================================================
// 4. Evidence Vault Citation Flowchart
// ============================================================================
export const EvidenceVaultFlowchart: React.FC = () => {
  return (
    <div className="arch-flowchart-card">
      <div className="arch-header">
        <div>
          <span className="eyebrow">CLAIM EVIDENCE PASSPORT LIFECYCLE</span>
          <h3 style={{ margin: "4px 0", fontSize: "20px" }}>
            How Promotional Statements Are Grounded in Verifiable Research
          </h3>
        </div>
      </div>
      <div className="arch-diagram-row">
        <div className="arch-step-box">
          <div className="arch-icon-tag bg-blue">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
          </div>
          <div className="arch-step-title">Source Research Doc</div>
          <div className="arch-step-desc">Customer Study v1, SOC2 Audit, or Plans Sheet.</div>
        </div>

        <div className="arch-connector">
          <svg width="32" height="24" viewBox="0 0 32 24" fill="none">
            <path d="M4 12H26M26 12L18 5M26 12L18 19" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>

        <div className="arch-step-box">
          <div className="arch-icon-tag bg-purple">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <div className="arch-step-title">Verified Excerpt</div>
          <div className="arch-step-desc">Exact verbatim sentence & page number excerpted.</div>
        </div>

        <div className="arch-connector">
          <svg width="32" height="24" viewBox="0 0 32 24" fill="none">
            <path d="M4 12H26M26 12L18 5M26 12L18 19" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>

        <div className="arch-step-box arch-highlight">
          <div className="arch-icon-tag bg-amber">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </div>
          <div className="arch-step-title">Passport ID & Expiry</div>
          <div className="arch-step-desc">Assigned EV-1, owner stamp & hard expiration date lock.</div>
        </div>

        <div className="arch-connector">
          <svg width="32" height="24" viewBox="0 0 32 24" fill="none">
            <path d="M4 12H26M26 12L18 5M26 12L18 19" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>

        <div className="arch-step-box">
          <div className="arch-icon-tag bg-green">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <path d="m9 12 2 2 4-4"/>
            </svg>
          </div>
          <div className="arch-step-title">Verified Draft Citation</div>
          <div className="arch-step-desc">Allows human approval; expired passports block publishing.</div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 5. Review Queue Risk-Based Routing Flowchart
// ============================================================================
export const ReviewQueueRoutingFlowchart: React.FC = () => {
  return (
    <div className="arch-flowchart-card">
      <div className="arch-header">
        <div>
          <span className="eyebrow">GOVERNANCE & ROUTING ARCHITECTURE</span>
          <h3 style={{ margin: "4px 0", fontSize: "20px" }}>
            Risk-Based Two-Tier Approval Routes & Immutable Audit Log
          </h3>
        </div>
      </div>

      <div className="routing-flow-grid">
        <div className="route-lane-box">
          <div className="lane-header">
            <span className="pill pill-route-standard">STANDARD ROUTE</span>
            <h4>Routine Edits & Minor Copy</h4>
          </div>
          <div className="lane-steps">
            <div className="lane-node">Copy Edits / Formatting</div>
            <span className="lane-arrow">↓</span>
            <div className="lane-node">Reviewer: <strong>Riley Chen</strong></div>
            <span className="lane-arrow">↓</span>
            <div className="lane-node node-success">Standard Sign-Off</div>
          </div>
        </div>

        <div className="route-decision-node">
          <div className="decision-diamond">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 12l10 10 10-10L12 2z"/>
            </svg>
            <span>RISK ENGINE</span>
          </div>
          <div className="decision-label">Sensitive rule or promotional claim detected?</div>
        </div>

        <div className="route-lane-box route-lane-senior">
          <div className="lane-header">
            <span className="pill pill-route-senior">SENIOR REVIEWER ROUTE</span>
            <h4>Protected Claims & High-Risk Rules</h4>
          </div>
          <div className="lane-steps">
            <div className="lane-node">Expired Claim / Pricing Rules</div>
            <span className="lane-arrow">↓</span>
            <div className="lane-node">Senior Reviewer: <strong>Sam Patel</strong></div>
            <span className="lane-arrow">↓</span>
            <div className="lane-node node-warning">Strict Backend Gate & Audit Log</div>
          </div>
        </div>
      </div>
    </div>
  );
};


// ============================================================================
// 6. Visual Compliance Health Gauge (Draft Review & Intro)
// ============================================================================
export const ComplianceScoreGauge: React.FC<{ score: number; blockerCount?: number }> = ({
  score,
  blockerCount = 0,
}) => {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  const isClean = blockerCount === 0 && score >= 90;

  return (
    <div className="compliance-gauge-box">
      <div className="gauge-svg-wrap">
        <svg width="104" height="104" viewBox="0 0 100 100" className="gauge-svg">
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="transparent"
            stroke="#1e293b"
            strokeWidth="8"
          />
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="transparent"
            stroke={isClean ? "url(#gaugeGradGreen)" : "url(#gaugeGradWarn)"}
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 1s ease" }}
            transform="rotate(-90 50 50)"
          />
          <defs>
            <linearGradient id="gaugeGradGreen" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#06b6d4" />
            </linearGradient>
            <linearGradient id="gaugeGradWarn" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#ef4444" />
            </linearGradient>
          </defs>
        </svg>
        <div className="gauge-center-text">
          <span className="gauge-score">{score}%</span>
          <span className="gauge-label">HEALTH</span>
        </div>
      </div>
      <div className="gauge-info">
        <div className="gauge-status-title">
          {isClean ? "Audit-Grade Compliant" : `${blockerCount} Gate Blocker${blockerCount > 1 ? "s" : ""}`}
        </div>
        <div className="gauge-status-sub">
          {isClean
            ? "Zero violations · 100% citation coverage"
            : "Requires evidence resolution before publication"}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 7. Visual Security & Governance Seals (Trust Row)
// ============================================================================
export const SecuritySealsRow: React.FC = () => {
  const seals = [
    {
      title: "Untrusted Data Sandbox",
      sub: "Immune to Prompt Injections",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
      ),
    },
    {
      title: "Evidence Passport Verification",
      sub: "100% Verifiable Source Excerpts",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          <path d="m9 12 2 2 4-4"/>
        </svg>
      ),
    },
    {
      title: "Intent-Preserving Diff Guard",
      sub: "Protected Facts & Numbers",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
      ),
    },
    {
      title: "Immutable Human Audit Gate",
      sub: "Revisions Invalidate Prior Approvals",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
      ),
    },
  ];

  return (
    <div className="security-seals-grid">
      {seals.map((s, i) => (
        <div key={i} className="security-seal-item">
          <div className="seal-icon-circle">{s.icon}</div>
          <div className="seal-text-group">
            <span className="seal-title">{s.title}</span>
            <span className="seal-sub">{s.sub}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

// ============================================================================
// 8. Draft Compliance Before vs. After Comparison Graph
// ============================================================================
export interface DraftComparisonProps {
  scoreBefore?: number;
  scoreAfter?: number;
  blockersBefore?: number;
  blockersAfter?: number;
  citationsBefore?: string;
  citationsAfter?: string;
  gateBefore?: string;
  gateAfter?: string;
  onApplyFix?: () => void;
  canApply?: boolean;
}

const MiniCircMeter: React.FC<{ score: number; color: string }> = ({
  score,
  color,
}) => {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="comp-circ-meter-wrap">
      <svg width="74" height="74" viewBox="0 0 70 70" className="comp-circ-meter-svg">
        <circle cx="35" cy="35" r={radius} fill="none" stroke="#172033" strokeWidth="6" />
        <circle
          cx="35"
          cy="35"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform="rotate(-90 35 35)"
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
      </svg>
      <div className="comp-circ-meter-center">
        <span className="comp-circ-val" style={{ color }}>{score}%</span>
      </div>
    </div>
  );
};

export const DraftComparisonGraph: React.FC<DraftComparisonProps> = ({
  scoreBefore = 82,
  scoreAfter = 100,
  blockersBefore = 1,
  blockersAfter = 0,
  citationsBefore = "Uncited Claim Found",
  citationsAfter = "100% Valid (EV-1 Cited)",
  gateBefore = "BLOCKED ⛔",
  gateAfter = "READY FOR SIGN-OFF ✓",
  onApplyFix,
  canApply = false,
}) => {
  const [activeTab, setActiveTab] = useState<"metrics" | "intent">("metrics");

  return (
    <div className="comparison-graph-card">
      <div className="comparison-header">
        <div className="comparison-title-group">
          <span className="comparison-badge">COMPLIANCE COMPARISON BENCHMARK</span>
          <h4 className="comparison-heading">Before vs. After Policy Verification</h4>
        </div>
        <div className="comparison-tab-pills">
          <button
            type="button"
            className={`comp-pill-btn ${activeTab === "metrics" ? "active" : ""}`}
            onClick={() => setActiveTab("metrics")}
          >
            Dual Metric Comparison
          </button>
          <button
            type="button"
            className={`comp-pill-btn ${activeTab === "intent" ? "active" : ""}`}
            onClick={() => setActiveTab("intent")}
          >
            Protected Fact Diff
          </button>
        </div>
      </div>

      {activeTab === "metrics" ? (
        <div className="comparison-body-grid">
          {/* BEFORE COLUMN */}
          <div className="comparison-column col-before">
            <div className="col-header-row">
              <span className="state-tag tag-before">BEFORE FIX · REVISION 1</span>
            </div>

            <div className="col-metrics-split">
              <MiniCircMeter score={scoreBefore} color="#f87171" />
              <div className="metric-rows-group">
                <div className="comp-row">
                  <span className="comp-lbl">Active Policy Violations:</span>
                  <span className="comp-val val-danger">
                    {blockersBefore} Blockers (TONE-01 & EV-4)
                  </span>
                </div>
                <div className="comp-row">
                  <span className="comp-lbl">Evidence Passport Match:</span>
                  <span className="comp-val val-danger">{citationsBefore}</span>
                </div>
                <div className="comp-row">
                  <span className="comp-lbl">Deterministic Gate:</span>
                  <span className="comp-val val-danger">{gateBefore}</span>
                </div>
              </div>
            </div>

            <div className="sample-diff-quote diff-before">
              <span className="quote-badge">FLAGGED COPY:</span>
              “Our platform <span className="hl-red">guarantees</span>{" "}
              <span className="hl-red">40% higher productivity</span>.”
            </div>
          </div>

          {/* DELTA ARROW IN CENTER */}
          <div className="comparison-delta-col">
            <div className="delta-circle">
              <span className="delta-plus">+62%</span>
              <span className="delta-sub">COMPLIANCE DELTA</span>
            </div>
          </div>

          {/* AFTER COLUMN */}
          <div className="comparison-column col-after">
            <div className="col-header-row">
              <span className="state-tag tag-after">AFTER FIX · VERIFIED</span>
            </div>

            <div className="col-metrics-split">
              <MiniCircMeter score={scoreAfter} color="#22c55e" />
              <div className="metric-rows-group">
                <div className="comp-row">
                  <span className="comp-lbl">Active Policy Violations:</span>
                  <span className="comp-val val-ok">
                    {blockersAfter} Violations (0 Absolute Claims)
                  </span>
                </div>
                <div className="comp-row">
                  <span className="comp-lbl">Evidence Passport Match:</span>
                  <span className="comp-val val-ok">{citationsAfter}</span>
                </div>
                <div className="comp-row">
                  <span className="comp-lbl">Deterministic Gate:</span>
                  <span className="comp-val val-ok">{gateAfter}</span>
                </div>
              </div>
            </div>

            <div className="sample-diff-quote diff-after">
              <span className="quote-badge badge-green">VERIFIED REWRITE:</span>
              “Our platform <span className="hl-green">helps deliver</span>{" "}
              <span className="hl-green">up to 18% higher throughput</span>.”
            </div>
          </div>
        </div>
      ) : (
        <div className="intent-preservation-box">
          <div className="intent-cols-2">
            <div className="intent-box">
              <div className="intent-head">
                <span className="intent-num">01</span>
                <strong>Core Business Intent Preserved</strong>
              </div>
              <p>
                Productivity & throughput acceleration message retained without
                overstepping into prohibited legal warranties. Audience (Enterprise
                IT) and Call-to-Action (Request Benchmark Demo) are completely
                intact.
              </p>
            </div>
            <div className="intent-box">
              <div className="intent-head">
                <span className="intent-num">02</span>
                <strong>Protected Facts & Citations Guardrail</strong>
              </div>
              <p>
                Expired citation (40% Whitepaper EV-4) safely substituted with
                peer-reviewed benchmark report (18% Throughput EV-1, p.2). Fact
                alteration requires explicit Creator confirmation.
              </p>
            </div>
          </div>
        </div>
      )}

      {canApply && onApplyFix && (
        <div className="comparison-footer-action">
          <span>Apply verified rewrite to replace expired claims with EV-1 and clear all gate blockers:</span>
          <button
            type="button"
            className="btn-crypgo-green btn-sm"
            onClick={onApplyFix}
          >
            Apply Verified Fix (100% Score) →
          </button>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 9. Evidence Timeline & Validity Horizon Graph
// ============================================================================
export interface TimelinePassport {
  id: number;
  claim: string;
  owner: string;
  validUntil: string | null;
  state: "current" | "expired" | "pending" | "rejected";
  sourceDoc?: string;
}

export const EvidenceTimelineGraph: React.FC<{
  passports?: TimelinePassport[];
  onSelectPassport?: (id: number) => void;
}> = ({ passports, onSelectPassport }) => {
  // Default sample records if none provided
  const items: TimelinePassport[] = passports && passports.length > 0 ? passports : [
    {
      id: 1,
      claim: "Lumina Cloud helps teams improve throughput by up to 18%",
      owner: "Infrastructure Team",
      validUntil: "2026-12-31",
      state: "current",
      sourceDoc: "Lumina Benchmark Report 2025 v1, p.2",
    },
    {
      id: 2,
      claim: "Sub-50ms p99 storage latency on enterprise clusters",
      owner: "Storage Engineering Group",
      validUntil: "2026-12-31",
      state: "current",
      sourceDoc: "Storage Performance Audit Q1 2025, p.4",
    },
    {
      id: 3,
      claim: "99.99% multi-region uptime SLA guarantee",
      owner: "Compliance Operations",
      validUntil: "2025-12-31",
      state: "current",
      sourceDoc: "Enterprise SLA Master Agreement 2025, p.7",
    },
    {
      id: 4,
      claim: "Our platform guarantees 40% higher productivity",
      owner: "Data Science Group",
      validUntil: "2024-12-31",
      state: "expired",
      sourceDoc: "Lumina Cloud Whitepaper 2024 v1, p.4",
    },
  ];

  return (
    <div className="timeline-graph-card">
      <div className="timeline-header">
        <div>
          <span className="comparison-badge">PASSPORT VALIDITY TIMELINE</span>
          <h4 className="timeline-title">Evidence Lifecycles & Horizon Horizon (2024 – 2027)</h4>
        </div>
        <div className="timeline-legend">
          <span className="legend-item"><span className="legend-dot dot-valid" /> Active Valid Proof</span>
          <span className="legend-item"><span className="legend-dot dot-warn" /> Expiring Soon</span>
          <span className="legend-item"><span className="legend-dot dot-expired" /> Expired (Approval Blocker)</span>
        </div>
      </div>

      <div className="timeline-container">
        {/* Years Axis */}
        <div className="timeline-axis-row">
          <span className="axis-year">2024 Q1-Q4</span>
          <span className="axis-year">2025 Q1-Q4 (TODAY)</span>
          <span className="axis-year">2026 Q1-Q4</span>
          <span className="axis-year">2027 Horizon</span>
        </div>

        {/* Visual timeline bars */}
        <div className="timeline-bars-list">
          {/* Vertical marker for 'TODAY' */}
          <div className="timeline-today-marker">
            <span className="marker-badge">CURRENT ACTIVE GATE</span>
          </div>

          {items.map((p) => {
            const isExpired = p.state === "expired";
            return (
              <div
                key={p.id}
                className={`timeline-row-item ${isExpired ? "row-expired" : "row-current"}`}
                onClick={() => onSelectPassport?.(p.id)}
              >
                <div className="timeline-info-col">
                  <div className="passport-id-tag">
                    <span className="p-id">EV-{p.id}</span>
                    <span className={`p-badge ${isExpired ? "badge-exp" : "badge-cur"}`}>
                      {isExpired ? "⛔ EXPIRED" : "✓ CURRENT"}
                    </span>
                  </div>
                  <div className="passport-claim-quote">“{p.claim}”</div>
                  <div className="passport-meta-sub">
                    Source: {p.sourceDoc || "Verified Document"} · Owner: {p.owner}
                  </div>
                </div>

                <div className="timeline-visual-bar-wrap">
                  {isExpired ? (
                    <div className="bar-track">
                      <div className="bar-fill bar-expired" style={{ width: "32%" }}>
                        <span className="bar-date-label">Expired {p.validUntil}</span>
                      </div>
                      <div className="bar-gap-blocker">
                        <span className="blocker-warning-text">⛔ BLOCKS REVIEWS</span>
                      </div>
                    </div>
                  ) : (
                    <div className="bar-track">
                      <div
                        className="bar-fill bar-current"
                        style={{
                          width: p.validUntil?.includes("2025") ? "60%" : "88%",
                        }}
                      >
                        <span className="bar-date-label">Valid to {p.validUntil}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 10. Rule Overrides & Governance Evolution Bar Chart
// ============================================================================
export interface RuleHealthChartItem {
  rule_key: string;
  title: string;
  overrides: number;
  accepted: number;
  override_rate: number | null;
  version: number;
}

export const RuleOverrideBarChart: React.FC<{
  items?: RuleHealthChartItem[];
  onSelectRule?: (ruleKey: string) => void;
}> = ({ items, onSelectRule }) => {
  const chartData: RuleHealthChartItem[] = items && items.length > 0 ? items : [
    {
      rule_key: "TONE-01",
      title: "Prohibit absolute guarantees without evidence",
      overrides: 6,
      accepted: 8,
      override_rate: 0.43,
      version: 1,
    },
    {
      rule_key: "TERM-01",
      title: "Capitalize product name as Nimbus Cloud",
      overrides: 2,
      accepted: 7,
      override_rate: 0.22,
      version: 1,
    },
    {
      rule_key: "CLAIM-01",
      title: "Promotional statistics require approved citation",
      overrides: 0,
      accepted: 5,
      override_rate: 0.0,
      version: 1,
    },
    {
      rule_key: "TONE-02",
      title: "Avoid budget descriptors ('cheap')",
      overrides: 1,
      accepted: 3,
      override_rate: 0.25,
      version: 1,
    },
  ];

  const maxTotal = Math.max(
    ...chartData.map((d) => d.overrides + d.accepted),
    1
  );

  return (
    <div className="rule-chart-card">
      <div className="rule-chart-header">
        <div>
          <span className="comparison-badge">POLICY EVOLUTION ANALYTICS</span>
          <h4 className="timeline-title">Rule Override Frequency vs. Accepted Fixes</h4>
        </div>
        <div className="timeline-legend">
          <span className="legend-item"><span className="legend-dot dot-valid" /> Accepted Fixes</span>
          <span className="legend-item"><span className="legend-dot dot-expired" /> Reviewer Overrides</span>
        </div>
      </div>

      <div className="rule-bars-table">
        {chartData.map((r) => {
          const total = r.overrides + r.accepted;
          const overridePct = r.override_rate !== null ? Math.round(r.override_rate * 100) : 0;
          const acceptedPct = 100 - overridePct;
          const isHighOverride = (r.override_rate || 0) >= 0.35 && total >= 5;

          return (
            <div
              key={r.rule_key}
              className={`rule-bar-row ${isHighOverride ? "row-highlight-clarify" : ""}`}
              onClick={() => onSelectRule?.(r.rule_key)}
            >
              <div className="rule-label-col">
                <div className="rule-code-wrap">
                  <span className="rule-code-badge">{r.rule_key}@v{r.version}</span>
                  {isHighOverride && (
                    <span className="clarify-pill">Clarification Needed</span>
                  )}
                  {r.rule_key === "CLAIM-01" && (
                    <span className="gate-locked-pill">Zero Bypass Gate</span>
                  )}
                </div>
                <div className="rule-desc-text">{r.title}</div>
              </div>

              <div className="rule-stacked-bar-col">
                <div className="stacked-track">
                  {/* Accepted bar */}
                  <div
                    className="stacked-accepted"
                    style={{ width: `${(r.accepted / maxTotal) * 100}%` }}
                    title={`${r.accepted} Accepted fixes (${acceptedPct}%)`}
                  >
                    {r.accepted > 0 && <span className="bar-inner-num">{r.accepted}</span>}
                  </div>
                  {/* Overrides bar */}
                  <div
                    className="stacked-overrides"
                    style={{ width: `${(r.overrides / maxTotal) * 100}%` }}
                    title={`${r.overrides} Overrides (${overridePct}%)`}
                  >
                    {r.overrides > 0 && <span className="bar-inner-num">{r.overrides}</span>}
                  </div>
                </div>
                <div className="rule-rate-legend">
                  <span className="rate-item accepted-item">✓ {r.accepted} fixes</span>
                  <span className="rate-item override-item">
                    ⚠ {r.overrides} overrides ({overridePct}%)
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
