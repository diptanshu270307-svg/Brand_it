import React, { useEffect, useState } from "react";
import { api, ApiError, DraftDetail, DraftSummary, HistoryData, Passport } from "../api";
import { SourceModal } from "../components/SourceModal";
import { ReviewQueueRoutingFlowchart } from "../components/Flowcharts";

interface Props {
  brandId: number;
  role: string;
  selectedDraftId: number | null;
  onSelectDraft: (id: number) => void;
  onOpenEditor: (id: number) => void;
}

export const ReviewQueue: React.FC<Props> = ({
  brandId,
  role,
  selectedDraftId,
  onSelectDraft,
  onOpenEditor,
}) => {
  const [queue, setQueue] = useState<DraftSummary[]>([]);
  const [detail, setDetail] = useState<DraftDetail | null>(null);
  const [history, setHistory] = useState<HistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [gateAlert, setGateAlert] = useState<{
    ok: boolean;
    title: string;
    message: string;
    blockers?: { code: string; message: string }[];
  } | null>(null);

  const [comment, setComment] = useState("");
  const [decisionNote, setDecisionNote] = useState("");
  const [inspectPassport, setInspectPassport] = useState<Passport | null>(null);

  const loadQueue = async (pickId?: number | null) => {
    setLoading(true);
    setError("");
    try {
      const items = await api.getQueue(brandId);
      setQueue(items);
      const target =
        pickId ??
        selectedDraftId ??
        items.find((x) => x.actionable)?.id ??
        items.find((x) => !x.seeded)?.id ??
        items[0]?.id ??
        null;
      if (target) {
        onSelectDraft(target);
        await loadItem(target);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load queue");
    } finally {
      setLoading(false);
    }
  };

  const loadItem = async (id: number) => {
    try {
      const [det, hist] = await Promise.all([
        api.getDraft(brandId, id),
        api.getHistory(brandId, id),
      ]);
      setDetail(det);
      setHistory(hist);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not load draft review packet");
    }
  };

  useEffect(() => {
    loadQueue(selectedDraftId);
  }, [brandId, role]);

  useEffect(() => {
    if (selectedDraftId && detail?.id !== selectedDraftId) {
      setGateAlert(null);
      loadItem(selectedDraftId);
    }
  }, [selectedDraftId]);

  const handleApprove = async () => {
    if (!detail) return;
    setBusy(true);
    setError("");
    setGateAlert(null);
    try {
      const note =
        decisionNote.trim() || "Verified against brand guidelines and Evidence Vault.";
      const updated = await api.approveDraft(brandId, detail.id, detail.revision_id, note);
      setDetail(updated);
      setDecisionNote("");
      await loadQueue(detail.id);
      setGateAlert({
        ok: true,
        title: `Approved Revision #${updated.revision}`,
        message:
          "Backend re-ran checks on the current revision, confirmed zero blockers and recorded your approval in the audit trail.",
      });
    } catch (e: unknown) {
      await loadItem(detail.id);
      if (e instanceof ApiError) {
        const d = e.detail as {
          code?: string;
          message?: string;
          blockers?: { code: string; message: string }[];
        };
        setGateAlert({
          ok: false,
          title: `Backend Approval Gate Denied (${d?.code || e.status})`,
          message: d?.message || e.message,
          blockers: d?.blockers,
        });
      } else {
        setError(e instanceof Error ? e.message : "Approval failed");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleRequestChanges = async () => {
    if (!detail) return;
    setBusy(true);
    setError("");
    setGateAlert(null);
    try {
      const reason =
        decisionNote.trim() ||
        "Please resolve open claim evidence blockers before resubmitting.";
      const updated = await api.requestChanges(brandId, detail.id, reason);
      setDetail(updated);
      setDecisionNote("");
      await loadQueue(detail.id);
      setGateAlert({
        ok: true,
        title: "Changes Requested",
        message: "Returned to creator with your feedback and recorded in the audit log.",
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not request changes");
    } finally {
      setBusy(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail || !comment.trim()) return;
    setBusy(true);
    try {
      const h = await api.addComment(brandId, detail.id, comment);
      setHistory(h);
      setComment("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not add comment");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="screen-container">
      <div className="screen-header">
        <div>
          <div className="draft-desk-eyebrow-row">
            <span className="eyebrow" style={{ color: "#22c55e", fontWeight: 800 }}>
              HUMAN REVIEW DESK
            </span>
            <span className="desk-sub-badge">Review Queue</span>
            <span className="live-engine-pill">
              <span className="pulse-dot"></span> AUDIT TRAIL LIVE
            </span>
          </div>
          <p className="subtitle">
            Two-tier reviewer routes, deterministic pre-flight gates & immutable audit logs.
          </p>
        </div>
      </div>

      {/* Visual Risk-Based Routing Flowchart */}
      <ReviewQueueRoutingFlowchart />

      {error && <div className="banner banner-error">{error}</div>}

      {gateAlert && (
        <div className={`banner ${gateAlert.ok ? "banner-ok" : "banner-error"}`}>
          <div>
            <strong>{gateAlert.title}:</strong> {gateAlert.message}
            {gateAlert.blockers && gateAlert.blockers.length > 0 && (
              <ul style={{ marginTop: 6 }}>
                {gateAlert.blockers.map((b, i) => (
                  <li key={i}>
                    <code>{b.code}</code>: {b.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => setGateAlert(null)}>
            Dismiss
          </button>
        </div>
      )}

      <div className="desk-grid">
        {/* LEFT: Queue list */}
        <div className="desk-left">
          <div className="card">
            <div className="card-header">
              <div>
                <div className="eyebrow">ACTIVE ROLE: {role.toUpperCase()}</div>
                <h3>Drafts in Workflow ({queue.length})</h3>
              </div>
            </div>
            {loading ? (
              <div className="muted">Loading queue...</div>
            ) : (
              <div className="queue-list">
                {queue.map((item) => {
                  const cleanTitle = item.title.replace(/\[SEEDED SAMPLE\]/gi, "").trim();
                  return (
                    <div
                      key={item.id}
                      className={`queue-row ${detail?.id === item.id ? "active" : ""}`}
                      onClick={() => onSelectDraft(item.id)}
                    >
                      <div className="queue-row-top">
                        <strong>{cleanTitle}</strong>
                        {item.seeded && <span className="pill pill-seeded">SEEDED</span>}
                        {item.actionable && (
                          <span className="pill pill-ev-supported">Actionable</span>
                        )}
                      </div>
                      <div className="btn-row" style={{ marginTop: 6 }}>
                        <span className={`pill pill-status-${item.status}`}>
                          {item.status.replace("_", " ")}
                        </span>
                        {item.route && (
                          <span className={`pill pill-route-${item.route}`}>
                            Route: {item.route}
                          </span>
                        )}
                        <span className="muted-sm">
                          Rev #{item.revision} · {item.author}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Selected draft review packet + approval gate + history */}
        <div className="desk-right">
          {!detail ? (
            <div className="card">Select a draft to inspect review packet.</div>
          ) : (
            <>
              <div className="card">
                <div className="card-header">
                  <div>
                    <div className="eyebrow">
                      REVIEW PACKET · REVISION #{detail.revision}
                    </div>
                    <h3>
                      {detail.title.replace(/\[SEEDED SAMPLE\]/gi, "").trim()}{" "}
                      {detail.seeded && <span className="pill pill-seeded">SEEDED</span>}
                    </h3>
                  </div>
                  <button className="btn btn-sm" onClick={() => onOpenEditor(detail.id)}>
                    ← Open in Draft Review Desk
                  </button>
                </div>

                <div className="quote-box" style={{ whiteSpace: "pre-wrap", marginBottom: 12 }}>
                  {detail.text}
                </div>

                <div className="intent-bar" style={{ marginBottom: 12 }}>
                  <div className="intent-item">
                    <span className="meta-label">AUDIENCE</span>
                    <div>{detail.audience || "—"}</div>
                  </div>
                  <div className="intent-item">
                    <span className="meta-label">PURPOSE</span>
                    <div>{detail.purpose || "—"}</div>
                  </div>
                  <div className="intent-item">
                    <span className="meta-label">CTA</span>
                    <div>{detail.cta || "—"}</div>
                  </div>
                </div>

                {/* Claim passports & blockers summary */}
                {detail.findings.filter((f) => f.is_claim).length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div className="meta-label" style={{ marginBottom: 6 }}>
                      PROMOTIONAL CLAIMS & EVIDENCE PASSPORTS
                    </div>
                    {detail.findings
                      .filter((f) => f.is_claim)
                      .map((f) => (
                        <div
                          key={f.id}
                          className={`passport-mini passport-mini-${f.evidence_status}`}
                        >
                          <div className="passport-mini-head">
                            <span>
                              <strong>“{f.quote}”</strong> —{" "}
                              <span className={`pill pill-ev-${f.evidence_status}`}>
                                {(f.evidence_status || "").toUpperCase()}
                              </span>
                            </span>
                            {f.passport && (
                              <button
                                className="btn btn-sm"
                                onClick={() => setInspectPassport(f.passport)}
                              >
                                Inspect Proof ({f.passport.ref}) ↗
                              </button>
                            )}
                          </div>
                          <div className="muted-sm">{f.explanation}</div>
                        </div>
                      ))}
                  </div>
                )}

                {detail.blockers.length > 0 ? (
                  <div className="blocker-box">
                    <div className="blocker-title">
                      ⛔ {detail.blockers.length} Backend Gate Blocker
                      {detail.blockers.length > 1 ? "s" : ""}
                    </div>
                    <ul>
                      {detail.blockers.map((b, i) => (
                        <li key={i}>{b.message}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="banner banner-ok">
                    ✓ All claims have valid Evidence Passports · Zero gate blockers.
                  </div>
                )}

                {/* Reviewer Decision Box */}
                <div className="decision-box">
                  <div className="eyebrow">HUMAN REVIEWER SIGN-OFF GATE</div>
                  <div className="btn-row" style={{ marginBottom: 8 }}>
                    <span className="pill">State: {detail.status}</span>
                    <span className={`pill pill-route-${detail.route || detail.computed_route || "standard"}`}>
                      Route: {detail.route || detail.computed_route || "standard"}
                    </span>
                    <span className="pill">Role: {role}</span>
                  </div>
                  <textarea
                    rows={2}
                    placeholder="Sign-off note or reason for changes..."
                    value={decisionNote}
                    onChange={(e) => setDecisionNote(e.target.value)}
                  />
                  <div className="btn-row" style={{ marginTop: 8 }}>
                    <button
                      className="btn btn-primary"
                      disabled={busy}
                      onClick={handleApprove}
                    >
                      ✓ Approve Revision #{detail.revision}
                    </button>
                    <button
                      className="btn btn-danger"
                      disabled={busy}
                      onClick={handleRequestChanges}
                    >
                      ↩ Request Changes
                    </button>
                  </div>
                </div>
              </div>

              {/* Review Decisions & Audit Trail */}
              {history && (
                <div className="two-col">
                  <div className="card">
                    <div className="card-header">
                      <div>
                        <div className="eyebrow">HUMAN DECISIONS</div>
                        <h3>Review History ({history.decisions.length})</h3>
                      </div>
                    </div>
                    <div className="timeline">
                      {history.decisions.map((d) => (
                        <div key={d.id} className="timeline-item">
                          <div className="timeline-top">
                            <span className={`pill pill-status-${d.kind}`}>{d.kind}</span>
                            <strong>{d.by}</strong>
                            {d.route && <span className="pill">route: {d.route}</span>}
                            {d.seeded && <span className="pill pill-seeded">SEEDED</span>}
                            <span className="muted-sm">
                              {new Date(d.at).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          <div className="timeline-body">{d.body}</div>
                        </div>
                      ))}
                    </div>
                    <form onSubmit={handleAddComment} className="btn-row" style={{ marginTop: 12 }}>
                      <input
                        type="text"
                        placeholder="Add review comment..."
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                      />
                      <button type="submit" className="btn btn-sm" disabled={busy}>
                        Post Comment
                      </button>
                    </form>
                  </div>

                  <div className="card">
                    <div className="card-header">
                      <div>
                        <div className="eyebrow">IMMUTABLE AUDIT LOG</div>
                        <h3>Audit Events ({history.audit.length})</h3>
                      </div>
                    </div>
                    <div className="timeline">
                      {history.audit.map((a) => (
                        <div key={a.id} className="timeline-item">
                          <div className="timeline-top">
                            <code>{a.action}</code>
                            <strong>{a.by}</strong>
                            {a.seeded && <span className="pill pill-seeded">SEEDED</span>}
                            <span className="muted-sm">
                              {new Date(a.at).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          <pre className="audit-json">{JSON.stringify(a.details)}</pre>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {inspectPassport && (
        <SourceModal
          brandId={brandId}
          docId={inspectPassport.document.id}
          initialPage={inspectPassport.page}
          highlightExcerpt={inspectPassport.excerpt}
          passport={inspectPassport}
          onClose={() => setInspectPassport(null)}
        />
      )}
    </div>
  );
};
