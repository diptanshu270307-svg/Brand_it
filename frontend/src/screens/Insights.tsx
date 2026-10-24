import React, { useEffect, useState } from "react";
import { api, EvaluationData, GuidelineHealthItem, InsightsData } from "../api";

interface Props {
  brandId: number;
  role: string;
}

export const Insights: React.FC<Props> = ({ brandId, role }) => {
  const [data, setData] = useState<InsightsData | null>(null);
  const [evalData, setEvalData] = useState<EvaluationData | null>(null);
  const [showCases, setShowCases] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string>("");
  const [error, setError] = useState("");
  const [editedText, setEditedText] = useState<Record<number, string>>({});
  const [bannerMsg, setBannerMsg] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [ins, ev] = await Promise.all([
        api.getInsights(brandId),
        api.getEvaluation(brandId),
      ]);
      setData(ins);
      setEvalData(ev);
      const map: Record<number, string> = {};
      for (const h of ins.health) {
        if (h.proposal) map[h.proposal.id] = h.proposal.proposed_text;
      }
      setEditedText(map);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load insights");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [brandId]);

  const handleSuggest = async (ruleKey: string) => {
    setBusyKey(ruleKey);
    setError("");
    setBannerMsg("");
    try {
      const p = await api.suggestWording(brandId, ruleKey);
      setEditedText((prev) => ({ ...prev, [p.id]: p.proposed_text }));
      await load();
      setBannerMsg(
        `Generated proposed clarification for ${ruleKey}. Rule v1 remains unchanged until the Brand Owner approves.`
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not generate wording suggestion");
    } finally {
      setBusyKey("");
    }
  };

  const handleProposalDecision = async (
    proposalId: number,
    ruleKey: string,
    decision: "approve" | "reject"
  ) => {
    setBusyKey(ruleKey);
    setError("");
    setBannerMsg("");
    try {
      await api.decideProposal(brandId, proposalId, decision, editedText[proposalId]);
      await load();
      setBannerMsg(
        decision === "approve"
          ? `Approved new wording for ${ruleKey}! Published as a new rule version; future checks will pin to the updated version.`
          : `Rejected proposed wording for ${ruleKey}.`
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Proposal decision failed");
    } finally {
      setBusyKey("");
    }
  };

  const isOwner = role === "brand_owner";
  const canSuggest = role === "brand_owner" || role === "senior_reviewer" || role === "reviewer";

  return (
    <div className="screen-container">
      <div className="screen-header">
        <div>
          <div className="eyebrow">SCREEN 5 · GUIDELINE HEALTH & GOVERNANCE ANALYTICS</div>
          <h2>Insights — Override Patterns, Guideline Health & Measured Evaluation</h2>
          <p className="subtitle">
            BrandLint tracks which rules reviewers repeatedly override and why, suggests clearer
            wording for the Brand Owner to approve, and labels small samples as{" "}
            <strong>Insufficient History</strong>. Rules are never changed automatically.
          </p>
        </div>
      </div>

      {data && (
        <div className="banner banner-info">
          <strong>Sample History Transparency:</strong> {data.note}
        </div>
      )}

      {error && <div className="banner banner-error">{error}</div>}
      {bannerMsg && <div className="banner banner-ok">{bannerMsg}</div>}

      {loading || !data ? (
        <div className="card">Loading Insights & Guideline Health...</div>
      ) : (
        <>
          {/* USP #3: Guideline Health */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="eyebrow">FLAGSHIP FEATURE · IMPROVE THE GUIDELINES THEMSELVES</div>
                <h3>Guideline Health — Reviewer Overrides, Reasons & Proposed Clarifications</h3>
              </div>
              {!isOwner && (
                <span className="pill pill-warn">
                  Switch to Olivia Brooks (Brand Owner) to approve proposed rule wording
                </span>
              )}
            </div>

            <div className="health-grid">
              {data.health.map((h: GuidelineHealthItem) => (
                <div
                  key={h.rule_key}
                  className={`health-card ${
                    h.insufficient_history ? "health-insufficient" : "health-actionable"
                  }`}
                >
                  <div className="health-top">
                    <div className="btn-row">
                      <span className="rule-key">
                        {h.rule_key}@{h.version}
                      </span>
                      <strong>{h.title}</strong>
                      <span className="pill">{h.category}</span>
                    </div>
                    {h.insufficient_history ? (
                      <span
                        className="pill pill-warn"
                        title={`Fewer than ${h.min_sample} overrides (${h.overrides}/${h.min_sample})`}
                      >
                        ⚠️ Insufficient History ({h.overrides}/{h.min_sample} min sample)
                      </span>
                    ) : (
                      <span className="pill pill-ev-expired">
                        High Override Pattern ({h.overrides} overrides ·{" "}
                        {Math.round((h.override_rate || 0) * 100)}% override rate)
                      </span>
                    )}
                  </div>

                  <div className="quote-box" style={{ marginTop: 8 }}>
                    <span className="meta-label">CURRENT ACTIVE WORDING (v{h.version})</span>
                    <div>{h.rule_text}</div>
                  </div>

                  <div className="health-stats">
                    <span>
                      <strong>{h.overrides}</strong> total overrides ({h.live_overrides} live ·{" "}
                      <span className="pill pill-seeded">
                        {h.seeded_overrides} seeded sample
                      </span>
                      )
                    </span>
                    <span>
                      <strong>{h.accepted}</strong> accepted fixes
                    </span>
                    <span>
                      Override rate:{" "}
                      <strong>
                        {h.override_rate !== null ? `${Math.round(h.override_rate * 100)}%` : "—"}
                      </strong>
                    </span>
                  </div>

                  <div className="two-col" style={{ marginTop: 10 }}>
                    <div>
                      <span className="meta-label">WHY REVIEWERS OVERRODE THIS RULE</span>
                      <ul className="compact-list">
                        {h.reasons.map((r, idx) => (
                          <li key={idx}>
                            “{r.reason}” — <strong>×{r.count}</strong>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <span className="meta-label">OVERRIDDEN DRAFT EXAMPLES</span>
                      <ul className="compact-list">
                        {h.examples.map((ex, idx) => (
                          <li key={idx}>
                            <code>“{ex.excerpt}”</code> — {ex.reason}{" "}
                            {ex.seeded && <span className="pill pill-seeded">SEEDED</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Proposed Clarification */}
                  {h.proposal ? (
                    <div className="proposal-box">
                      <div className="eyebrow">
                        PENDING BRAND OWNER APPROVAL · DOES NOT AUTO-MODIFY RULES
                      </div>
                      <p className="muted-sm" style={{ marginBottom: 6 }}>
                        <strong>Rationale:</strong> {h.proposal.rationale}
                      </p>
                      <div className="diff-lines">
                        <div className="diff-del">
                          <span className="diff-sign">− v{h.version}</span> {h.proposal.current_text}
                        </div>
                        <div className="diff-add">
                          <span className="diff-sign">+ v{h.version + 1}</span>{" "}
                          {h.proposal.proposed_text}
                        </div>
                      </div>
                      {isOwner && (
                        <label style={{ display: "block", marginTop: 8 }}>
                          <span className="meta-label">
                            Edit proposed wording before approving (optional):
                          </span>
                          <textarea
                            rows={2}
                            value={editedText[h.proposal.id] ?? h.proposal.proposed_text}
                            onChange={(e) =>
                              setEditedText((prev) => ({
                                ...prev,
                                [h.proposal!.id]: e.target.value,
                              }))
                            }
                          />
                        </label>
                      )}
                      <div className="btn-row" style={{ marginTop: 8 }}>
                        <button
                          className="btn btn-primary btn-sm"
                          disabled={!isOwner || busyKey === h.rule_key}
                          onClick={() =>
                            handleProposalDecision(h.proposal!.id, h.rule_key, "approve")
                          }
                        >
                          ✓ Approve & Publish {h.rule_key}@{h.version + 1} (Brand Owner)
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          disabled={!isOwner || busyKey === h.rule_key}
                          onClick={() =>
                            handleProposalDecision(h.proposal!.id, h.rule_key, "reject")
                          }
                        >
                          ✕ Reject Proposal
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="btn-row" style={{ marginTop: 10 }}>
                      <button
                        className="btn btn-sm"
                        disabled={!canSuggest || busyKey === h.rule_key}
                        onClick={() => handleSuggest(h.rule_key)}
                      >
                        {busyKey === h.rule_key
                          ? "Generating Suggestion..."
                          : `✨ Suggest Clearer Wording for ${h.rule_key}`}
                      </button>
                      {!canSuggest && (
                        <span className="muted-sm">
                          Switch to Reviewer / Brand Owner to propose clearer wording
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Recurring Issues Table */}
          <div className="two-col">
            <div className="card">
              <div className="card-header">
                <div>
                  <div className="eyebrow">RECURRING ISSUES BY RULE</div>
                  <h3>Live Checks vs. Seeded Sample History</h3>
                </div>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Rule</th>
                    <th>Title</th>
                    <th>Category</th>
                    <th>Live Checks</th>
                    <th>Seeded Sample</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recurring_issues.map((row) => (
                    <tr key={row.rule_key}>
                      <td>
                        <code>{row.rule_key}</code>
                      </td>
                      <td>{row.title}</td>
                      <td>{row.category}</td>
                      <td>
                        <strong>{row.live_count}</strong>
                      </td>
                      <td>
                        <span className="pill pill-seeded">{row.seeded_count}</span>
                      </td>
                      <td>
                        <strong>{row.total}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Step 6: Measured Evaluation Benchmark */}
            {evalData && (
              <div className="card">
                <div className="card-header">
                  <div>
                    <div className="eyebrow">STEP 6 · MEASURED EVALUATION BENCHMARK</div>
                    <h3>
                      {evalData.drafts_total} Labelled Drafts ({evalData.problematic_drafts}{" "}
                      Problematic, {evalData.clean_drafts} Clean)
                    </h3>
                  </div>
                  <button className="btn btn-sm" onClick={() => setShowCases(!showCases)}>
                    {showCases ? "Hide Per-Draft Breakdown" : "Inspect All 18 Drafts"}
                  </button>
                </div>
                <p className="muted-sm" style={{ marginBottom: 12 }}>
                  Every metric below is measured live by running the actual checking pipeline across
                  the 18-draft benchmark dataset (never hardcoded).
                </p>
                <div className="eval-grid">
                  <div className="eval-stat">
                    <div className="eval-val">
                      {evalData.citations_valid}/{evalData.citations_checked} (
                      {Math.round(evalData.citation_validity_rate * 100)}%)
                    </div>
                    <div className="eval-lbl">Valid Citations (Verbatim Quote + Rule/Source)</div>
                  </div>
                  <div className="eval-stat">
                    <div className="eval-val">{evalData.clean_draft_false_alarms}</div>
                    <div className="eval-lbl">
                      False Alarms on {evalData.clean_drafts} Clean Drafts
                    </div>
                  </div>
                  <div className="eval-stat">
                    <div className="eval-val">
                      {evalData.true_positives}/{evalData.expected_issues} (
                      {Math.round(evalData.recall * 100)}%)
                    </div>
                    <div className="eval-lbl">
                      Exact Issue Recall ({evalData.missed_issues} status diffs)
                    </div>
                  </div>
                  <div className="eval-stat">
                    <div className="eval-val">{evalData.avg_review_time_ms} ms</div>
                    <div className="eval-lbl">
                      Avg Check Latency per Draft ({evalData.total_time_ms} ms total)
                    </div>
                  </div>
                </div>

                {showCases && (
                  <table className="data-table" style={{ marginTop: 12 }}>
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Draft Scenario</th>
                        <th>Expected</th>
                        <th>Observed</th>
                        <th>Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {evalData.cases.map((c) => (
                        <tr key={c.id}>
                          <td>
                            <code>{c.id}</code>
                          </td>
                          <td>
                            {c.label}{" "}
                            {c.clean && <span className="pill pill-ev-supported">CLEAN</span>}
                          </td>
                          <td>
                            <code>{c.expected.join(", ") || "none"}</code>
                          </td>
                          <td>
                            <code>{c.observed.join(", ") || "none"}</code>
                          </td>
                          <td>{c.latency_ms} ms</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
