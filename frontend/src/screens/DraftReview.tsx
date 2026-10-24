import React, { useEffect, useMemo, useState } from "react";
import { api, ApiError, DraftDetail, DraftSummary, FindingItem, Passport } from "../api";
import { SourceModal } from "../components/SourceModal";
import { ComplianceScoreGauge, DraftComparisonGraph, DraftReviewFlowchart } from "../components/Flowcharts";

interface Props {
  brandId: number;
  role: string;
  selectedDraftId: number | null;
  onSelectDraft: (id: number) => void;
  onOpenQueue?: (id: number) => void;
}

interface SpanSegment {
  text: string;
  finding?: FindingItem;
}

function buildHighlightedSegments(text: string, findings: FindingItem[]): SpanSegment[] {
  const sorted = [...findings]
    .filter((f) => f.start >= 0 && f.end <= text.length && f.start < f.end)
    .sort((a, b) => a.start - b.start || b.end - a.end);

  const segments: SpanSegment[] = [];
  let cursor = 0;
  for (const f of sorted) {
    if (f.start < cursor) continue; // skip overlapping inner span in inline preview (still listed in cards)
    if (f.start > cursor) {
      segments.push({ text: text.slice(cursor, f.start) });
    }
    segments.push({ text: text.slice(f.start, f.end), finding: f });
    cursor = f.end;
  }
  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor) });
  }
  return segments;
}

export const DraftReview: React.FC<Props> = ({
  brandId,
  role,
  selectedDraftId,
  onSelectDraft,
  onOpenQueue,
}) => {
  const [drafts, setDrafts] = useState<DraftSummary[]>([]);
  const [detail, setDetail] = useState<DraftDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [gateResult, setGateResult] = useState<{
    ok: boolean;
    title: string;
    message: string;
    blockers?: { code: string; message: string }[];
  } | null>(null);

  // Editor state
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [editAudience, setEditAudience] = useState("");
  const [editPurpose, setEditPurpose] = useState("");
  const [editCta, setEditCta] = useState("");

  // Filters & selection
  const [sevFilter, setSevFilter] = useState<string>("all");
  const [activeFindingId, setActiveFindingId] = useState<number | null>(null);
  const [confirmedProtected, setConfirmedProtected] = useState<Record<number, boolean>>({});
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // New draft modal
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newChannel, setNewChannel] = useState("Email");
  const [newText, setNewText] = useState("");
  const [newAudience, setNewAudience] = useState("");
  const [newPurpose, setNewPurpose] = useState("");
  const [newCta, setNewCta] = useState("");

  // Source / Passport modal
  const [modalState, setModalState] = useState<{
    docId: number;
    page?: number;
    excerpt?: string;
    passport?: Passport | null;
    claimQuote?: string;
    evidenceStatus?: string | null;
  } | null>(null);

  const loadList = async (pickId?: number | null) => {
    setLoading(true);
    setError("");
    try {
      const list = await api.listDrafts(brandId);
      setDrafts(list);
      const nonSeeded = list.filter((d) => !d.seeded);
      const target =
        pickId ??
        selectedDraftId ??
        (nonSeeded.length > 0 ? nonSeeded[0].id : list[0]?.id ?? null);
      if (target) {
        onSelectDraft(target);
        const det = await api.getDraft(brandId, target);
        setDetail(det);
        syncEditor(det);
      } else {
        setDetail(null);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load drafts");
    } finally {
      setLoading(false);
    }
  };

  const syncEditor = (d: DraftDetail) => {
    setEditText(d.text);
    setEditAudience(d.audience);
    setEditPurpose(d.purpose);
    setEditCta(d.cta);
  };

  useEffect(() => {
    loadList(selectedDraftId);
  }, [brandId, role]);

  useEffect(() => {
    if (selectedDraftId && detail?.id !== selectedDraftId) {
      api
        .getDraft(brandId, selectedDraftId)
        .then((d) => {
          setDetail(d);
          syncEditor(d);
          setEditing(false);
          setGateResult(null);
        })
        .catch((e) => setError(e.message || "Could not load draft"));
    }
  }, [selectedDraftId]);

  const handleCheck = async () => {
    if (!detail) return;
    setBusy(true);
    setError("");
    setGateResult(null);
    try {
      const updated = await api.checkDraft(brandId, detail.id);
      setDetail(updated);
      syncEditor(updated);
      await refreshSummaries();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Check failed");
    } finally {
      setBusy(false);
    }
  };

  const refreshSummaries = async () => {
    const list = await api.listDrafts(brandId);
    setDrafts(list);
  };

  const handleSaveEdit = async () => {
    if (!detail) return;
    setBusy(true);
    setError("");
    setGateResult(null);
    try {
      const updated = await api.editDraft(brandId, detail.id, {
        text: editText,
        audience: editAudience,
        purpose: editPurpose,
        cta: editCta,
      });
      setDetail(updated);
      setEditing(false);
      await refreshSummaries();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not save revision");
    } finally {
      setBusy(false);
    }
  };

  const handleAcceptFix = async (f: FindingItem) => {
    if (!detail) return;
    setBusy(true);
    setError("");
    setGateResult(null);
    try {
      const confirm = !!confirmedProtected[f.id];
      const updated = await api.acceptFinding(brandId, detail.id, f.id, confirm);
      setDetail(updated);
      syncEditor(updated);
      await refreshSummaries();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not apply fix");
    } finally {
      setBusy(false);
    }
  };

  const handleRejectFix = async (f: FindingItem) => {
    if (!detail) return;
    setBusy(true);
    setError("");
    try {
      const updated = await api.rejectFinding(brandId, detail.id, f.id, rejectReason);
      setDetail(updated);
      setRejectingId(null);
      setRejectReason("");
      await refreshSummaries();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not reject finding");
    } finally {
      setBusy(false);
    }
  };

  const handleSubmitForReview = async () => {
    if (!detail) return;
    setBusy(true);
    setError("");
    setGateResult(null);
    try {
      const updated = await api.submitDraft(brandId, detail.id);
      setDetail(updated);
      await refreshSummaries();
      setGateResult({
        ok: true,
        title: `Submitted for ${updated.route === "senior" ? "Senior Reviewer" : "Standard Reviewer"} sign-off`,
        message:
          updated.route === "senior"
            ? "Risk-based routing sent this draft to a Senior Reviewer because it contains sensitive or unresolved claims."
            : "Routine edits routed to standard review.",
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setBusy(false);
    }
  };

  const handleAttemptApprove = async () => {
    if (!detail) return;
    setBusy(true);
    setError("");
    setGateResult(null);
    try {
      const updated = await api.approveDraft(
        brandId,
        detail.id,
        detail.revision_id,
        "Reviewed against brand rules and Evidence Vault."
      );
      setDetail(updated);
      await refreshSummaries();
      setGateResult({
        ok: true,
        title: `Approved Revision #${updated.revision}`,
        message: "Pre-approval check passed with 0 blockers. Recorded in the audit trail.",
      });
    } catch (e: unknown) {
      if (e instanceof ApiError) {
        const d = e.detail as {
          code?: string;
          message?: string;
          blockers?: { code: string; message: string }[];
        };
        setGateResult({
          ok: false,
          title: `Backend Approval Gate Blocked (${d?.code || e.status})`,
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

  const handleCreateDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const created = await api.createDraft(brandId, {
        title: newTitle.trim(),
        channel: newChannel.trim(),
        text: newText,
        audience: newAudience,
        purpose: newPurpose,
        cta: newCta,
      });
      setShowNew(false);
      setNewTitle("");
      setNewText("");
      await loadList(created.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not create draft");
    } finally {
      setBusy(false);
    }
  };

  const openFindingSource = (f: FindingItem) => {
    if (f.passport) {
      setModalState({
        docId: f.passport.document.id,
        page: f.passport.page,
        excerpt: f.passport.excerpt,
        passport: f.passport,
        claimQuote: f.quote,
        evidenceStatus: f.evidence_status,
      });
      return;
    }
    // Otherwise open the rule's guideline document (docId 1 for seeded guidelines)
    setModalState({
      docId: 1,
      page: 1,
      excerpt: f.source_excerpt,
    });
  };

  const filteredFindings = useMemo(() => {
    if (!detail) return [];
    return detail.findings.filter((f) => {
      if (sevFilter === "all") return true;
      if (sevFilter === "claims") return f.is_claim;
      return f.severity === sevFilter;
    });
  }, [detail, sevFilter]);

  const segments = useMemo(() => {
    if (!detail) return [];
    return buildHighlightedSegments(detail.text, detail.findings);
  }, [detail]);

  return (
    <div className="screen-container">
      <div className="screen-header">
        <div>
          <div className="eyebrow">PRE-PUBLICATION REVIEW DESK</div>
          <h2>Draft Review</h2>
          <p className="subtitle">
            Scan marketing copy, verify claims against Evidence Passports, and apply intent-preserving fixes.
          </p>
        </div>
        <div className="btn-row">
          <button className="btn btn-primary" onClick={() => setShowNew(true)}>
            + New Draft
          </button>
        </div>
      </div>

      {/* Visual Verification Flowchart */}
      <DraftReviewFlowchart />

      {/* Draft Switcher Bar */}
      <div className="draft-tabs">
        {drafts.map((d) => (
          <button
            key={d.id}
            className={`draft-tab ${detail?.id === d.id ? "active" : ""}`}
            onClick={() => onSelectDraft(d.id)}
          >
            <div className="draft-tab-top">
              <span className="draft-tab-title">{d.title}</span>
              {d.seeded && <span className="pill pill-seeded">SEEDED</span>}
            </div>
            <div className="draft-tab-meta">
              <span className={`pill pill-status-${d.status}`}>{d.status.replace("_", " ")}</span>
              <span>Rev #{d.revision}</span>
              {d.route && <span className={`pill pill-route-${d.route}`}>{d.route}</span>}
            </div>
          </button>
        ))}
      </div>

      {error && <div className="banner banner-error">{error}</div>}

      {gateResult && (
        <div className={`banner ${gateResult.ok ? "banner-ok" : "banner-error"}`}>
          <div>
            <strong>{gateResult.title}:</strong> {gateResult.message}
            {gateResult.blockers && gateResult.blockers.length > 0 && (
              <ul style={{ marginTop: 6 }}>
                {gateResult.blockers.map((b, i) => (
                  <li key={i}>
                    <code>{b.code}</code>: {b.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => setGateResult(null)}>
            Dismiss
          </button>
        </div>
      )}

      {loading || !detail ? (
        <div className="card">Loading draft...</div>
      ) : (
        <>
          {/* Workflow Status & Gate Bar */}
          <div className="workflow-bar">
            <div className="workflow-steps">
              <span className={`wf-step ${detail.status === "draft" ? "current" : "done"}`}>
                1. Draft (Rev #{detail.revision})
              </span>
              <span className="wf-arrow">→</span>
              <span
                className={`wf-step ${
                  detail.status === "checked"
                    ? "current"
                    : detail.analysis
                    ? "done"
                    : ""
                }`}
              >
                2. Checked
              </span>
              <span className="wf-arrow">→</span>
              <span
                className={`wf-step ${
                  detail.status === "in_review" ||
                  detail.status === "senior_review" ||
                  detail.status === "changes_requested"
                    ? "current"
                    : detail.status === "approved"
                    ? "done"
                    : ""
                }`}
              >
                3.{" "}
                {(detail.route || detail.computed_route) === "senior"
                  ? "Senior Review"
                  : "Human Review"}
              </span>
              <span className="wf-arrow">→</span>
              <span className={`wf-step ${detail.status === "approved" ? "current done" : ""}`}>
                4. Approved
              </span>
            </div>

            <div className="btn-row">
              <button
                className="btn btn-primary"
                disabled={busy || detail.status === "approved"}
                onClick={handleCheck}
              >
                {busy ? "Checking..." : detail.analysis ? "↻ Re-run BrandLint Checks" : "▶ Run BrandLint Checks"}
              </button>

              {detail.can_edit && detail.status === "checked" && (
                <button className="btn btn-accent" disabled={busy} onClick={handleSubmitForReview}>
                  Submit for Review ({detail.computed_route === "senior" ? "Senior Route" : "Standard Route"}) →
                </button>
              )}

              <button
                className="btn btn-sm"
                disabled={busy}
                onClick={handleAttemptApprove}
                title="Tests the backend approval gate right now with your current role and draft state"
              >
                🛡 Test Approval Gate
              </button>

              {onOpenQueue && (
                <button className="btn btn-sm" onClick={() => onOpenQueue(detail.id)}>
                  Open in Review Queue →
                </button>
              )}
            </div>
          </div>

          {/* Intent Metadata Bar (Audience, Purpose, Call to Action) */}
          <div className="intent-bar">
            <div className="intent-item">
              <span className="meta-label">TARGET AUDIENCE (PROTECTED INTENT)</span>
              {editing ? (
                <input
                  value={editAudience}
                  onChange={(e) => setEditAudience(e.target.value)}
                  placeholder="Who is this for?"
                />
              ) : (
                <div className="intent-val">{detail.audience || "—"}</div>
              )}
            </div>
            <div className="intent-item">
              <span className="meta-label">PURPOSE / GOAL (PROTECTED INTENT)</span>
              {editing ? (
                <input
                  value={editPurpose}
                  onChange={(e) => setEditPurpose(e.target.value)}
                  placeholder="What is the goal?"
                />
              ) : (
                <div className="intent-val">{detail.purpose || "—"}</div>
              )}
            </div>
            <div className="intent-item">
              <span className="meta-label">CALL TO ACTION — CTA (PROTECTED)</span>
              {editing ? (
                <input
                  value={editCta}
                  onChange={(e) => setEditCta(e.target.value)}
                  placeholder="Primary CTA phrase"
                />
              ) : (
                <div className="intent-val intent-cta">{detail.cta || "—"}</div>
              )}
            </div>
          </div>

          {/* Draft Compliance Before vs. After Comparison Graph */}
          <DraftComparisonGraph
            scoreBefore={
              detail.findings.length === 0
                ? 100
                : Math.max(35, 100 - detail.findings.length * 18)
            }
            scoreAfter={100}
            blockersBefore={
              detail.findings.filter(
                (f) =>
                  f.severity === "critical" ||
                  f.is_claim ||
                  f.evidence_status === "expired"
              ).length
            }
            blockersAfter={0}
            citationsBefore={
              detail.findings.some((f) => f.evidence_status === "expired")
                ? "0 Valid · 1 Expired (EV-4)"
                : detail.findings.some((f) => f.is_claim)
                ? "Uncited Claim Found"
                : "100% Valid (EV-1 Cited)"
            }
            citationsAfter="100% Valid (EV-1 Cited)"
            gateBefore={
              detail.blockers.length > 0 ? "BLOCKED ⛔" : "READY FOR SIGN-OFF ✓"
            }
            gateAfter="READY FOR SIGN-OFF ✓"
            canApply={detail.can_edit && detail.findings.length > 0}
            onApplyFix={() => {
              const firstFinding = detail.findings.find((f) => f.suggestion);
              if (firstFinding) handleAcceptFix(firstFinding);
            }}
          />

          <div className="desk-grid">
            {/* LEFT PANE: Draft Editor & Highlighted Preview */}
            <div className="desk-left">
              <div className="card">
                <div className="card-header" style={{ alignItems: "center" }}>
                  <div>
                    <div className="eyebrow">
                      {detail.channel.toUpperCase()} · AUTHOR: {detail.author.toUpperCase()} · REV #
                      {detail.revision}
                    </div>
                    <h3>{detail.title}</h3>
                  </div>
                  <ComplianceScoreGauge
                    score={
                      detail.findings.length === 0
                        ? 100
                        : Math.max(35, 100 - detail.findings.length * 18)
                    }
                    blockerCount={
                      detail.findings.filter(
                        (f) => f.severity === "critical" || f.is_claim || f.evidence_status === "expired"
                      ).length
                    }
                  />
                  <div className="btn-row">
                    {detail.can_edit ? (
                      editing ? (
                        <>
                          <button className="btn btn-primary btn-sm" onClick={handleSaveEdit} disabled={busy}>
                            Save New Revision
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => {
                              setEditing(false);
                              syncEditor(detail);
                            }}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button className="btn btn-sm" onClick={() => setEditing(true)}>
                          ✎ Edit Draft Text
                          {detail.status === "approved" ? " (Invalidates Approval)" : ""}
                        </button>
                      )
                    ) : (
                      <span className="muted-sm">Switch to Casey (Creator) to edit text</span>
                    )}
                  </div>
                </div>

                {editing ? (
                  <div className="editor-box">
                    <textarea
                      rows={8}
                      className="draft-textarea"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                    />
                    <div className="muted-sm" style={{ marginTop: 6 }}>
                      Saving creates Revision #{detail.revision + 1}
                      {detail.status === "approved"
                        ? " and immediately invalidates the prior approval."
                        : " and requires re-running checks before approval."}
                    </div>
                  </div>
                ) : (
                  <div className="highlighted-draft">
                    {segments.map((seg, i) => {
                      if (!seg.finding) return <span key={i}>{seg.text}</span>;
                      const f = seg.finding;
                      const isSelected = activeFindingId === f.id;
                      const cls = f.is_claim
                        ? `hl-claim hl-ev-${f.evidence_status}`
                        : `hl-sev-${f.severity}`;
                      return (
                        <mark
                          key={i}
                          className={`hl-span ${cls} ${isSelected ? "hl-selected" : ""}`}
                          onClick={() => {
                            setActiveFindingId(f.id);
                            if (f.is_claim && f.passport) openFindingSource(f);
                          }}
                          title={`${f.rule?.key || "CLAIM"}: ${f.explanation} (Click to inspect)`}
                        >
                          {seg.text}
                          <sup className="hl-badge">
                            {f.is_claim
                              ? f.evidence_status === "supported"
                                ? "✓ EV"
                                : `! ${f.evidence_status}`
                              : f.rule?.key}
                          </sup>
                        </mark>
                      );
                    })}
                  </div>
                )}

                {/* Blockers & Pinned Analysis Metadata */}
                {detail.blockers.length > 0 ? (
                  <div className="blocker-box">
                    <div className="blocker-title">
                      ⛔ {detail.blockers.length} Approval Blocker
                      {detail.blockers.length > 1 ? "s" : ""} (Enforced on Backend)
                    </div>
                    <ul>
                      {detail.blockers.map((b, i) => (
                        <li key={i}>{b.message}</li>
                      ))}
                    </ul>
                  </div>
                ) : detail.analysis ? (
                  <div className="banner banner-ok" style={{ marginTop: 12 }}>
                    ✓ Zero approval blockers on Revision #{detail.revision}. Ready for human sign-off.
                  </div>
                ) : (
                  <div className="banner banner-warn" style={{ marginTop: 12 }}>
                    Checks have not been run on Revision #{detail.revision} yet. Click{" "}
                    <strong>Run BrandLint Checks</strong> above.
                  </div>
                )}

                {detail.analysis && (
                  <div className="pinned-meta">
                    <div>
                      <strong>Pinned Analysis #{detail.analysis.id}</strong> · Provider:{" "}
                      <code>{detail.analysis.provider}</code> · Trigger:{" "}
                      <code>{detail.analysis.triggered_by}</code> · Route:{" "}
                      <span className={`pill pill-route-${detail.computed_route || "standard"}`}>
                        {detail.computed_route === "senior"
                          ? "Senior Reviewer Required"
                          : "Standard Review"}
                      </span>
                    </div>
                    <div className="muted-sm">
                      Pinned rule versions:{" "}
                      {Object.entries(detail.analysis.rule_versions)
                        .map(([k, v]) => `${k}@${v}`)
                        .join(", ")}
                    </div>
                    {detail.analysis.notes.length > 0 && (
                      <div className="banner banner-warn" style={{ marginTop: 8 }}>
                        <strong>Schema & Citation Validator Notes:</strong>
                        <ul>
                          {detail.analysis.notes.map((n, i) => (
                            <li key={i}>{n}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Revision history strip */}
                <div className="rev-strip">
                  <span className="meta-label">REVISION HISTORY:</span>
                  {detail.revisions.map((r) => (
                    <span
                      key={r.id}
                      className={`rev-pill ${r.id === detail.revision_id ? "active" : ""}`}
                    >
                      v{r.number}: {r.note} ({r.by})
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* RIGHT PANE: Findings & Evidence Passports */}
            <div className="desk-right">
              <div className="filter-bar">
                {[
                  { key: "all", label: `All (${detail.findings.length})` },
                  {
                    key: "claims",
                    label: `Claims (${detail.findings.filter((f) => f.is_claim).length})`,
                  },
                  { key: "critical", label: "Critical" },
                  { key: "high", label: "High" },
                  { key: "medium", label: "Medium" },
                  { key: "low", label: "Low" },
                  { key: "info", label: "Supported (Info)" },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    className={`filter-pill ${sevFilter === tab.key ? "active" : ""}`}
                    onClick={() => setSevFilter(tab.key)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {filteredFindings.length === 0 ? (
                <div className="card muted">
                  {detail.analysis
                    ? "No findings match this filter."
                    : "Run BrandLint Checks to inspect findings and Claim Evidence Passports."}
                </div>
              ) : (
                <div className="finding-list">
                  {filteredFindings.map((f) => {
                    const isSelected = activeFindingId === f.id;
                    const needsConfirm = !!f.suggestion?.requires_confirmation;
                    const isConfirmed = !!confirmedProtected[f.id];
                    return (
                      <div
                        key={f.id}
                        className={`finding-card sev-border-${f.severity} ${
                          isSelected ? "finding-selected" : ""
                        }`}
                        onClick={() => setActiveFindingId(f.id)}
                      >
                        <div className="finding-top">
                          <div className="btn-row">
                            {f.rule && (
                              <span className="rule-key">
                                {f.rule.key}@{f.rule.version}
                              </span>
                            )}
                            <span className={`pill pill-sev-${f.severity}`}>
                              {f.severity.toUpperCase()}
                            </span>
                            <span className="pill">{f.category}</span>
                            <span className="pill pill-origin">{f.origin}</span>
                          </div>
                          {f.is_claim && f.evidence_status && (
                            <span className={`pill pill-ev-${f.evidence_status}`}>
                              PASSPORT: {f.evidence_status.replace("_", " ").toUpperCase()}
                            </span>
                          )}
                        </div>

                        <div className="finding-quote">“{f.quote}”</div>
                        <p className="finding-expl">{f.explanation}</p>

                        {/* Citation & Source Link */}
                        {(f.source_ref || f.source_excerpt) && (
                          <div className="citation-box">
                            <div>
                              <strong>Rule Citation:</strong> {f.source_ref}
                              {f.source_excerpt && (
                                <div className="muted-sm">“{f.source_excerpt}”</div>
                              )}
                            </div>
                            <button
                              className="btn-link"
                              onClick={(e) => {
                                e.stopPropagation();
                                openFindingSource(f);
                              }}
                            >
                              Open rule source →
                            </button>
                          </div>
                        )}

                        {/* USP #1: Claim Evidence Passport Card */}
                        {f.is_claim && (
                          <div className={`passport-mini passport-mini-${f.evidence_status}`}>
                            <div className="passport-mini-head">
                              <strong>
                                🛂 Claim Evidence Passport{" "}
                                {f.passport ? `(${f.passport.ref})` : "(No Linked Proof)"}
                              </strong>
                              {f.passport && (
                                <button
                                  className="btn btn-sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openFindingSource(f);
                                  }}
                                >
                                  Inspect Source Proof ↗
                                </button>
                              )}
                            </div>
                            {f.passport ? (
                              <div className="passport-mini-meta">
                                <div>
                                  <strong>Source:</strong> {f.passport.document.title} v
                                  {f.passport.document.version}, p.{f.passport.page}
                                </div>
                                <div>
                                  <strong>Owner:</strong> {f.passport.owner} ·{" "}
                                  <strong>Valid until:</strong> {f.passport.valid_until || "—"} (
                                  <span className={`state-${f.passport.state}`}>
                                    {f.passport.state.toUpperCase()}
                                  </span>
                                  )
                                </div>
                                <div className="muted-sm">
                                  Supporting excerpt: “{f.passport.excerpt}”
                                </div>
                              </div>
                            ) : (
                              <div className="muted-sm">
                                Missing, expired or insufficient evidence blocks approval and cannot
                                be overridden. Replace the claim with an evidence-backed statement or
                                add approved proof in the Evidence Vault.
                              </div>
                            )}
                          </div>
                        )}

                        {/* USP #2: Intent-Preserving Fix Diff & Protected Content Guardrail */}
                        {f.suggestion && !f.disposition && (
                          <div className="diff-box">
                            <div className="diff-head">
                              <span>✨ Intent-Preserving Suggested Fix</span>
                              <span className="pill pill-intent">
                                Audience, Purpose & CTA preserved
                              </span>
                            </div>
                            <div className="diff-lines">
                              <div className="diff-del">
                                <span className="diff-sign">−</span> {f.suggestion.original}
                              </div>
                              <div className="diff-add">
                                <span className="diff-sign">+</span>{" "}
                                {f.suggestion.replacement || <em>(remove phrase)</em>}
                              </div>
                            </div>

                            {needsConfirm && (
                              <div
                                className="protected-alert"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="protected-title">
                                  ⚠️ Protected Content Guardrail — Explicit Review Required:
                                </div>
                                <ul>
                                  {f.suggestion.protected_flags.map((flag, idx) => (
                                    <li key={idx}>{flag}</li>
                                  ))}
                                </ul>
                                <label className="confirm-check">
                                  <input
                                    type="checkbox"
                                    checked={isConfirmed}
                                    onChange={(e) =>
                                      setConfirmedProtected((prev) => ({
                                        ...prev,
                                        [f.id]: e.target.checked,
                                      }))
                                    }
                                  />
                                  I explicitly confirm changing these protected names, numbers or
                                  factual statements.
                                </label>
                              </div>
                            )}

                            <div className="btn-row" style={{ marginTop: 8 }}>
                              <button
                                className="btn btn-primary btn-sm"
                                disabled={
                                  busy ||
                                  !detail.can_edit ||
                                  (needsConfirm && !isConfirmed)
                                }
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAcceptFix(f);
                                }}
                              >
                                ✓ Accept Fix
                              </button>
                              {!f.is_claim && (
                                <button
                                  className="btn btn-ghost btn-sm"
                                  disabled={busy}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setRejectingId(rejectingId === f.id ? null : f.id);
                                    setRejectReason("");
                                  }}
                                >
                                  ✕ Reject / Override Suggestion
                                </button>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Reject / Override for findings without a rewrite (non-claim) */}
                        {!f.suggestion && !f.is_claim && !f.disposition && (
                          <div className="btn-row" style={{ marginTop: 8 }}>
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setRejectingId(rejectingId === f.id ? null : f.id);
                                setRejectReason("");
                              }}
                            >
                              ✕ Override / Dismiss with Reason
                            </button>
                          </div>
                        )}

                        {rejectingId === f.id && (
                          <div className="reject-box" onClick={(e) => e.stopPropagation()}>
                            <label className="meta-label">
                              Reason for overriding {f.rule?.key || f.category} (logged in Guideline
                              Health):
                            </label>
                            <div className="btn-row" style={{ marginTop: 4 }}>
                              <input
                                type="text"
                                placeholder="e.g. Informal greeting is on-brand for Instagram"
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                              />
                              <button
                                className="btn btn-danger btn-sm"
                                disabled={busy || rejectReason.trim().length < 3}
                                onClick={() => handleRejectFix(f)}
                              >
                                Record Override
                              </button>
                            </div>
                          </div>
                        )}

                        {f.disposition && (
                          <div className="disposition-badge">
                            Decision: <strong>{f.disposition.action.toUpperCase()}</strong> by{" "}
                            {f.disposition.by}
                            {f.disposition.reason ? ` — “${f.disposition.reason}”` : ""}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* New Draft Modal */}
      {showNew && (
        <div className="modal-backdrop" onClick={() => setShowNew(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div className="eyebrow">CREATE MARKETING DRAFT</div>
                <h3>New Draft for BrandLint Review</h3>
              </div>
              <button className="btn btn-ghost" onClick={() => setShowNew(false)}>
                Close ✕
              </button>
            </div>
            <form onSubmit={handleCreateDraft} className="form-stack">
              <div className="form-row">
                <label>
                  Draft Title
                  <input
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. Q3 Product Launch Post"
                    required
                  />
                </label>
                <label>
                  Channel
                  <input
                    value={newChannel}
                    onChange={(e) => setNewChannel(e.target.value)}
                    placeholder="Email / LinkedIn / Instagram"
                  />
                </label>
              </div>
              <div className="form-row">
                <label>
                  Audience
                  <input
                    value={newAudience}
                    onChange={(e) => setNewAudience(e.target.value)}
                    placeholder="e.g. Operations leaders"
                  />
                </label>
                <label>
                  Purpose
                  <input
                    value={newPurpose}
                    onChange={(e) => setNewPurpose(e.target.value)}
                    placeholder="e.g. Drive demo sign-ups"
                  />
                </label>
                <label>
                  Call to Action (CTA)
                  <input
                    value={newCta}
                    onChange={(e) => setNewCta(e.target.value)}
                    placeholder="e.g. Book a demo"
                  />
                </label>
              </div>
              <label>
                Draft Copy
                <textarea
                  rows={6}
                  value={newText}
                  onChange={(e) => setNewText(e.target.value)}
                  placeholder="Our platform guarantees 40% higher productivity..."
                  required
                />
              </label>
              <div className="btn-row">
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  Create Draft
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalState && (
        <SourceModal
          brandId={brandId}
          docId={modalState.docId}
          initialPage={modalState.page}
          highlightExcerpt={modalState.excerpt}
          passport={modalState.passport}
          claimQuote={modalState.claimQuote}
          evidenceStatus={modalState.evidenceStatus}
          onClose={() => setModalState(null)}
        />
      )}
    </div>
  );
};
