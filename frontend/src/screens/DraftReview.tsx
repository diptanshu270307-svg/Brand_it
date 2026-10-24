import React, { useEffect, useMemo, useState } from "react";
import { api, ApiError, DraftDetail, DraftSummary, FindingItem, Passport } from "../api";
import { SourceModal } from "../components/SourceModal";
import { ComplianceScoreGauge, DraftComparisonGraph, DraftReviewChevronPipeline } from "../components/Flowcharts";

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
  const [pipelineStep, setPipelineStep] = useState(0);

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
    <div className="screen-container desk-screen-root">
      {/* Top Header: Desk Title & Pinned Metadata */}
      <div className="screen-header desk-screen-header">
        <div className="draft-desk-title-group">
          <div className="draft-desk-eyebrow-row">
            <span className="eyebrow" style={{ color: "#22c55e", fontWeight: 800 }}>
              PRE-PUBLICATION REVIEW DESK
            </span>
            <span className="desk-sub-badge">Draft Review</span>
          </div>
          <p className="subtitle">
            Scan marketing copy, verify claims against Evidence Passports, and apply intent-preserving fixes.
          </p>
        </div>

        <div className="draft-desk-pinned-meta">
          <div className="pinned-line">
            <span className="pin-icon">📌</span> Pinned Analysis #{detail?.analysis?.id ?? 4}
          </div>
          <div className="pinned-line">
            Provider: <code>{detail?.analysis?.provider ?? "mock"}</code>
          </div>
          <div className="pinned-line">
            Revisions History:{" "}
            {detail?.revisions && detail.revisions.length > 0
              ? detail.revisions.map((r) => `v${r.number}`).join(", ")
              : "v1, v2, v3"}
          </div>
        </div>
      </div>

      {/* Top Chevron Pipeline Track with + New Draft Button */}
      <DraftReviewChevronPipeline
        activeStep={pipelineStep}
        onStepClick={(idx) => {
          setPipelineStep(idx);
          if (idx === 1 && !detail?.analysis) handleCheck();
          if (idx === 2) setSevFilter("claims");
          if (idx === 4) handleAttemptApprove();
        }}
        onNewDraft={() => setShowNew(true)}
      />

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
        <div className="card desk-loading-card">Loading draft workspace...</div>
      ) : (
        /* The 3-Column Command Center Layout */
        <div className="draft-desk-3col-grid">
          {/* =================================================================
              COLUMN 1: LEFT SIDEBAR (DRAFTS LIST + WORKFLOW + ACTION BUTTONS)
              ================================================================= */}
          <div className="desk-col-sidebar">
            <div className="drafts-sidebar-list">
              {drafts.map((d) => {
                const isSelected = detail?.id === d.id;
                return (
                  <div
                    key={d.id}
                    className={`draft-sidebar-card ${isSelected ? "selected" : ""}`}
                    onClick={() => onSelectDraft(d.id)}
                  >
                    <div className="draft-sidebar-card-top">
                      <span className="draft-sidebar-card-title">{d.title}</span>
                    </div>
                    <div className="draft-sidebar-card-pills">
                      {d.seeded && <span className="pill pill-seeded">SEEDED</span>}
                      <span className={`pill pill-status-${d.status}`}>
                        {d.status.replace("_", " ")}
                      </span>
                      <span className="draft-sidebar-rev-tag">(Rev #{d.revision})</span>
                    </div>

                    {/* Embedded 4-step workflow indicator inside the active draft card */}
                    {isSelected && detail && (
                      <div className="card-embedded-workflow">
                        <div className="wf-mini-row">
                          <span
                            className={`wf-mini-step ${
                              detail.status === "draft" ? "current" : "done"
                            }`}
                          >
                            1. Draft (Rev #{detail.revision})
                          </span>
                          <span className="wf-mini-arrow">→</span>
                          <span
                            className={`wf-mini-step ${
                              detail.status === "checked"
                                ? "current"
                                : detail.analysis
                                ? "done"
                                : ""
                            }`}
                          >
                            2. Checked
                          </span>
                        </div>
                        <div className="wf-mini-row" style={{ marginTop: 6 }}>
                          <span
                            className={`wf-mini-step ${
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
                          <span className="wf-mini-arrow">→</span>
                          <span
                            className={`wf-mini-step ${
                              detail.status === "approved" ? "current done" : ""
                            }`}
                          >
                            4. Approved
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Sidebar Action Buttons Stack */}
            <div className="sidebar-actions-stack">
              <button
                className="btn-sidebar-dark"
                disabled={busy || detail.status === "approved"}
                onClick={handleCheck}
              >
                {busy ? "Checking..." : "↻ Re-run BrandLint Checks"}
              </button>
              {detail.can_edit && detail.status === "checked" && (
                <button
                  className="btn-sidebar-dark"
                  style={{ borderColor: "#22c55e", color: "#4ade80" }}
                  disabled={busy}
                  onClick={handleSubmitForReview}
                >
                  Submit for Review ({detail.computed_route === "senior" ? "Senior Route" : "Standard Route"}) →
                </button>
              )}
              <button
                className="btn-sidebar-dark"
                disabled={busy}
                onClick={handleAttemptApprove}
                title="Tests the backend approval gate"
              >
                Test Approval Gate
              </button>
              {onOpenQueue && (
                <button
                  className="btn-sidebar-neon"
                  onClick={() => onOpenQueue(detail.id)}
                >
                  Open in Review Queue →
                </button>
              )}
            </div>
          </div>

          {/* =================================================================
              COLUMN 2: CENTER WORKSPACE (INTENT + BENCHMARK + PREVIEW/EDITOR)
              ================================================================= */}
          <div className="desk-col-center">
            {/* 1. Protected Intent Bar */}
            <div className="intent-bar-card">
              <div className="intent-col">
                <span className="intent-eyebrow">TARGET AUDIENCE (PROTECTED INTENT)</span>
                {editing ? (
                  <input
                    className="intent-input-dark"
                    value={editAudience}
                    onChange={(e) => setEditAudience(e.target.value)}
                    placeholder="Who is this for?"
                  />
                ) : (
                  <div className="intent-text">
                    {detail.audience || "Operations leaders at mid-size companies"}
                  </div>
                )}
              </div>
              <div className="intent-col">
                <span className="intent-eyebrow">PURPOSE / GOAL (PROTECTED INTENT)</span>
                {editing ? (
                  <input
                    className="intent-input-dark"
                    value={editPurpose}
                    onChange={(e) => setEditPurpose(e.target.value)}
                    placeholder="What is the goal?"
                  />
                ) : (
                  <div className="intent-text">
                    {detail.purpose || "Announce the launch and drive trial sign-ups"}
                  </div>
                )}
              </div>
              <div className="intent-col">
                <span className="intent-eyebrow">CALL TO ACTION — CTA (PROTECTED)</span>
                {editing ? (
                  <input
                    className="intent-input-dark"
                    value={editCta}
                    onChange={(e) => setEditCta(e.target.value)}
                    placeholder="Primary CTA phrase"
                  />
                ) : (
                  <div className="intent-text intent-text-cta">
                    {detail.cta || "Start your free trial"}
                  </div>
                )}
              </div>
            </div>

            {/* 2. Draft Compliance Before vs. After Comparison Benchmark */}
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
              gateBefore={detail.blockers.length > 0 ? "BLOCKED ⛔" : "READY FOR SIGN-OFF ✓"}
              gateAfter="READY FOR SIGN-OFF ✓"
              canApply={detail.can_edit && detail.findings.length > 0}
              onApplyFix={() => {
                const firstFinding = detail.findings.find((f) => f.suggestion);
                if (firstFinding) handleAcceptFix(firstFinding);
              }}
            />

            {/* 3. Draft Preview & Editor Card */}
            <div className="draft-preview-card">
              <div className="preview-header-row">
                <div>
                  <div className="preview-eyebrow">
                    {detail.channel.toUpperCase()} · AUTHOR: {detail.author.toUpperCase()} · REV #
                    {detail.revision}
                  </div>
                  <h3 className="preview-draft-title">{detail.title}</h3>
                </div>
                <div className="preview-gauge-group">
                  <ComplianceScoreGauge
                    score={
                      detail.findings.length === 0
                        ? 100
                        : Math.max(35, 100 - detail.findings.length * 18)
                    }
                    blockerCount={
                      detail.findings.filter(
                        (f) =>
                          f.severity === "critical" ||
                          f.is_claim ||
                          f.evidence_status === "expired"
                      ).length
                    }
                  />
                </div>
              </div>

              <div className="preview-action-row">
                {detail.can_edit ? (
                  editing ? (
                    <div className="btn-row">
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={handleSaveEdit}
                        disabled={busy}
                      >
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
                    </div>
                  ) : (
                    <button className="btn-link-edit" onClick={() => setEditing(true)}>
                      ✎ Edit Draft Text {detail.status === "approved" ? "(Invalidates Approval)" : ""}
                    </button>
                  )
                ) : (
                  <span className="switch-role-hint">Switch to Casey (Creator) to edit text</span>
                )}
              </div>

              {editing ? (
                <div className="editor-box">
                  <textarea
                    rows={6}
                    className="draft-textarea-dark"
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
                <div className="highlighted-draft-dark">
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
                              ? "✓"
                              : `! ${f.evidence_status}`
                            : f.rule?.key}
                        </sup>
                      </mark>
                    );
                  })}
                </div>
              )}

              {/* Bottom status badge */}
              {detail.blockers.length > 0 ? (
                <div className="blocker-box-dark">
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
                <div className="banner-ok-dark">
                  ✓ Zero approval blockers on Revision #{detail.revision}. Ready for human sign-off.
                </div>
              ) : (
                <div className="banner-warn-dark">
                  Checks have not been run on Revision #{detail.revision} yet. Click{" "}
                  <strong>↻ Re-run BrandLint Checks</strong>.
                </div>
              )}
            </div>
          </div>

          {/* =================================================================
              COLUMN 3: RIGHT SIDEBAR (FILTER PILLS + FINDINGS + PASSPORT PANEL)
              ================================================================= */}
          <div className="desk-col-inspector">
            {/* 1. Filter Chips */}
            <div className="inspector-filter-pills">
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
                  className={`filter-pill-dark ${sevFilter === tab.key ? "active" : ""}`}
                  onClick={() => setSevFilter(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* 2. Active Policy Case */}
            {filteredFindings.length === 0 ? (
              <div className="finding-card-dark muted">
                {detail.analysis
                  ? "No findings match this filter."
                  : "Run BrandLint Checks to inspect findings and Claim Evidence Passports."}
              </div>
            ) : (
              filteredFindings.map((f) => {
                const isSelected = activeFindingId === f.id || filteredFindings.length === 1;
                const needsConfirm = !!f.suggestion?.requires_confirmation;
                const isConfirmed = !!confirmedProtected[f.id];

                return (
                  <div
                    key={f.id}
                    className={`finding-card-dark ${isSelected ? "selected" : ""}`}
                    onClick={() => setActiveFindingId(f.id)}
                  >
                    <div className="finding-card-header">
                      <span className="finding-card-title">Active Policy Case</span>
                      <div className="card-action-icons">
                        <button
                          className="icon-btn"
                          title="Copy finding quote"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(f.quote);
                          }}
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                          </svg>
                        </button>
                        <button
                          className="icon-btn"
                          title="Inspect source"
                          onClick={(e) => {
                            e.stopPropagation();
                            openFindingSource(f);
                          }}
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <polyline points="15 3 21 3 21 9" />
                            <polyline points="9 21 3 21 3 15" />
                            <line x1="21" y1="3" x2="14" y2="10" />
                            <line x1="3" y1="21" x2="10" y2="14" />
                          </svg>
                        </button>
                        <button
                          className="icon-btn"
                          title="Dismiss / Override"
                          onClick={(e) => {
                            e.stopPropagation();
                            setRejectingId(rejectingId === f.id ? null : f.id);
                            setRejectReason("");
                          }}
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    <div className="finding-tag-row">
                      {f.rule && (
                        <span className="pill-rule-cyan">
                          {f.rule.key}@{f.rule.version}
                        </span>
                      )}
                      <span className={`pill pill-sev-${f.severity}`}>
                        {f.severity.toUpperCase()}
                      </span>
                      <span className="pill pill-dark-subtle">{f.category}</span>
                      <span className="pill pill-dark-subtle">{f.origin}</span>
                    </div>

                    {f.is_claim && f.evidence_status && (
                      <div className="passport-status-line">
                        <span className={`ev-status-text ev-${f.evidence_status}`}>
                          PASSPORT: {f.evidence_status.replace("_", " ").toUpperCase()}
                        </span>
                      </div>
                    )}

                    <div className="finding-quote-dark">“{f.quote}”</div>

                    {f.passport?.excerpt && (
                      <div className="finding-supported-excerpt">
                        Supported by {f.passport.ref}: “{f.passport.excerpt}”
                      </div>
                    )}

                    <p className="finding-expl-dark">
                      <span className="info-icon">ⓘ</span> {f.explanation}
                    </p>

                    <button
                      className="btn-open-source"
                      onClick={(e) => {
                        e.stopPropagation();
                        openFindingSource(f);
                      }}
                    >
                      Open rule source →
                    </button>

                    {/* Intent-Preserving Suggested Fix Diff */}
                    {f.suggestion && !f.disposition && (
                      <div className="diff-box-dark">
                        <div className="diff-head-dark">
                          <span>✨ Intent-Preserving Suggested Fix</span>
                          <span className="pill-intent-dark">Preserved</span>
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
                              I explicitly confirm changing these protected names, numbers or factual statements.
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

                    {rejectingId === f.id && (
                      <div className="reject-box" onClick={(e) => e.stopPropagation()}>
                        <label className="meta-label">
                          Reason for overriding {f.rule?.key || f.category}:
                        </label>
                        <div className="btn-row" style={{ marginTop: 4 }}>
                          <input
                            type="text"
                            placeholder="e.g. Informal greeting is on-brand"
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
              })
            )}

            {/* 3. PASSPORT INSPECT PANEL */}
            {(() => {
              const activeFinding =
                detail.findings.find((f) => f.id === activeFindingId && f.passport) ||
                detail.findings.find((f) => f.passport);
              const passport = activeFinding?.passport;

              return (
                <div className="passport-inspect-panel-dark">
                  <div className="passport-panel-head">
                    <span className="passport-panel-eyebrow">PASSPORT INSPECT PANEL</span>
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#22c55e"
                      strokeWidth="2"
                    >
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      <path d="m9 12 2 2 4-4" />
                    </svg>
                  </div>

                  <div className="passport-panel-subhead">
                    <strong>Claim Evidence Passport ({passport?.ref || "EV-1"})</strong>
                    <button
                      className="btn-link-inspect"
                      onClick={() => {
                        if (activeFinding) {
                          openFindingSource(activeFinding);
                        } else {
                          setModalState({
                            docId: 1,
                            page: 1,
                            excerpt:
                              "Across 212 customer teams surveyed in Q1 2025, teams using Lumina Flow reported 18% higher task throughput after 90 days.",
                            evidenceStatus: "supported",
                          });
                        }
                      }}
                    >
                      Inspect Source Proof ↗
                    </button>
                  </div>

                  <div className="passport-panel-metas">
                    <div className="passport-meta-item">
                      <span className="meta-k">Source:</span>{" "}
                      <span className="meta-v">
                        {passport?.document?.title || "Customer Productivity Study 2025"} v
                        {passport?.document?.version || 1}, p.{passport?.page || 1}
                      </span>
                    </div>
                    <div className="passport-meta-item">
                      <span className="meta-k">Owner:</span>{" "}
                      <span className="meta-v">
                        {passport?.owner || "Priya Nair"} (Research)
                      </span>
                      {" · "}
                      <span className="meta-k">Valid until:</span>{" "}
                      <span className="meta-v">{passport?.valid_until || "2027-11-28"}</span>
                    </div>
                    <div className="passport-excerpt-dark">
                      Supporting excerpt: “
                      {passport?.excerpt ||
                        "Across 212 customer teams surveyed in Q1 2025, teams using Lumina Flow reported 18% higher task throughput after 90 days."}
                      ”
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
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
