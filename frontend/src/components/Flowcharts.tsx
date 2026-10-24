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
// 3. Draft Review Compliance Flowchart
// ============================================================================
export const DraftReviewFlowchart: React.FC = () => {
  return (
    <div className="flowchart-compact-card">
      <div className="flowchart-compact-track">
        <div className="compact-node">
          <span className="c-step">1</span>
          <span className="c-title">Marketing Copy</span>
          <span className="c-sub">Audience, Purpose & CTA</span>
        </div>
        <span className="c-arrow">→</span>
        <div className="compact-node">
          <span className="c-step">2</span>
          <span className="c-title">Pre-Flight Lint</span>
          <span className="c-sub">Deterministic Tone & Terms</span>
        </div>
        <span className="c-arrow">→</span>
        <div className="compact-node node-accent">
          <span className="c-step">3</span>
          <span className="c-title">Evidence Match</span>
          <span className="c-sub">Passport Validity & Excerpts</span>
        </div>
        <span className="c-arrow">→</span>
        <div className="compact-node">
          <span className="c-step">4</span>
          <span className="c-title">Intent Fixes</span>
          <span className="c-sub">Guarded Numbers & Diffs</span>
        </div>
        <span className="c-arrow">→</span>
        <div className="compact-node node-success">
          <span className="c-step">5</span>
          <span className="c-title">Backend Gate</span>
          <span className="c-sub">Sign-Off or Block</span>
        </div>
      </div>
    </div>
  );
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
