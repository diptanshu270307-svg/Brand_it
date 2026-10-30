import React, { useEffect, useRef, useState } from "react";
import { api, ApiError, DraftDetail, DraftSummary, HistoryData, Passport } from "../api";
import { SourceModal } from "../components/SourceModal";
import {
  Badge,
  Button,
  Empty,
  ExpandableDetails,
  Icon,
  IssueBadge,
  Modal,
  Notice,
  PageHeading,
  Panel,
  StatusAnnouncer,
  errorText,
  formatDate,
  getIssueTier,
} from "../components/ui";

interface Props {
  brandId: number; role: string; selectedDraftId: number | null;
  onSelectDraft: (id: number) => void; onOpenEditor: (id: number) => void;
  onSwitchReviewer?: (senior?: boolean) => void;
}
interface Gate { ok: boolean; title: string; message: string; blockers?: { code: string; message: string }[] }
export const ReviewQueue: React.FC<Props> = ({ brandId, role, selectedDraftId, onSelectDraft, onOpenEditor, onSwitchReviewer }) => {
  const [queue, setQueue] = useState<DraftSummary[]>([]);
  const [detail, setDetail] = useState<DraftDetail | null>(null);
  const [history, setHistory] = useState<HistoryData | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [itemLoading, setItemLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [gate, setGate] = useState<Gate | null>(null);
  const [filter, setFilter] = useState("all");
  const [note, setNote] = useState("");
  const [comment, setComment] = useState("");
  const [passport, setPassport] = useState<Passport | null>(null);
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
  const requestId = useRef(0);

  const handleRecheck = async () => {
    if (!detail || busy) return;
    setBusy(true); setError(""); setGate(null);
    try {
      const updated = await api.recheckDraft(brandId, detail.id);
      setDetail(updated);
      setGate({
        ok: true,
        title: "Re-check completed",
        message: "Content checks were re-run against current brand guidelines and active evidence passports.",
      });
      await refreshPacket(updated.id);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const handleReopen = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail || busy) return;
    setBusy(true); setError("");
    try {
      const updated = await api.reopenDraft(brandId, detail.id, reopenReason.trim());
      setDetail(updated);
      setShowReopenModal(false);
      setReopenReason("");
      setGate({
        ok: true,
        title: "Draft reopened",
        message: "The draft has been reopened for editing and re-review. The previous approval is preserved in audit history.",
      });
      await refreshPacket(updated.id);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const loadItem = async (id: number) => {
    const request = ++requestId.current;
    setItemLoading(true); setError(""); setGate(null); setNote("");
    try {
      const [packet, trail] = await Promise.all([api.getDraft(brandId, id), api.getHistory(brandId, id)]);
      if (request !== requestId.current) return;
      setDetail(packet); setHistory(trail);
    } catch (e) { if (request === requestId.current) { setDetail(null); setHistory(null); setError(errorText(e)); } }
    finally { if (request === requestId.current) setItemLoading(false); }
  };
  useEffect(() => {
    let active = true; setLoading(true); setError(""); setDetail(null); setHistory(null);
    Promise.all([api.getQueue(brandId), api.me()]).then(([items, me]) => {
      if (!active) return;
      setQueue(items); setUserId(me.user.id);
      const target = selectedDraftId || items.find(d => d.actionable)?.id || items[0]?.id;
      if (target) { onSelectDraft(target); void loadItem(target); }
    }).catch(e => { if (active) setError(errorText(e)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; requestId.current++; };
  }, [brandId, role]);
  useEffect(() => {
    if (selectedDraftId && selectedDraftId !== detail?.id) void loadItem(selectedDraftId);
  }, [selectedDraftId]);

  const refreshPacket = async (id: number) => {
    const [items, packet, trail] = await Promise.all([api.getQueue(brandId), api.getDraft(brandId, id), api.getHistory(brandId, id)]);
    setQueue(items); setDetail(packet); setHistory(trail);
  };
  const decide = async (approve: boolean) => {
    if (!detail || busy) return;
    const current = detail;
    setBusy(true); setError(""); setGate(null);
    try {
      const updated = approve ? await api.approveDraft(brandId, current.id, current.revision_id, note.trim()) : await api.requestChanges(brandId, current.id, note.trim());
      await refreshPacket(updated.id); setNote("");
      setGate({ ok: true, title: approve ? `Revision ${updated.revision} approved` : "Changes requested", message: approve ? `The server recorded human approval for revision ${updated.revision}.` : "Your feedback has been returned to the author and added to the review history." });
    } catch (e) {
      if (e instanceof ApiError) {
        const value = e.detail as { code?: string; message?: string; blockers?: { code: string; message: string }[] };
        setGate({ ok: false, title: `Decision blocked · ${value?.code || e.status}`, message: value?.message || e.message, blockers: value?.blockers });
      } else setError(errorText(e));
      try { await refreshPacket(current.id); } catch { /* Keep the original error visible. */ }
    } finally { setBusy(false); }
  };
  const addComment = async (e: React.FormEvent) => {
    e.preventDefault(); if (!detail || !comment.trim() || busy) return;
    setBusy(true); setError("");
    try { const result = await api.addComment(brandId, detail.id, comment.trim()); setHistory(result); setComment(""); }
    catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  };
  const route = detail?.route || detail?.computed_route;
  const self = !!detail && userId === detail.author_id;
  const awaiting = detail?.status === "in_review" || detail?.status === "senior_review";
  const rightRole = ["reviewer", "senior_reviewer", "brand_owner"].includes(role) && (route !== "senior" || role === "senior_reviewer");
  const canDecide = !!detail?.can_review && rightRole && !self && awaiting;
  const filtered = queue.filter(d =>
    filter === "all" ||
    (filter === "actionable" && d.actionable) ||
    (filter === "senior" && d.route === "senior") ||
    (filter === "needs_revalidation" && (d.status === "needs_revalidation" || d.validity_status === "needs_revalidation")) ||
    (filter === "approved" && d.status === "approved")
  );

  return <div>
    <StatusAnnouncer message={gate?.message || error || (busy ? "Recording decision…" : null)} />
    <PageHeading
      eyebrow="Human Sign-Off"
      title="Approvals"
      description="Review and approve content submitted by your team. Ensure all promotional claims are grounded in approved facts before publication."
      action={<Badge tone="accent"><Icon name="lock" size={13}/>{role.replace(/_/g, " ")}</Badge>}
    />
    {error && <Notice tone="danger" className="mb-5">{error}</Notice>}
    <div className="mb-6 flex flex-wrap gap-2">
      {[["all", "All items"], ["actionable", "Ready for your review"], ["senior", "Senior escalation"], ["needs_revalidation", "Needs revalidation"], ["approved", "Approved"]].map(([key, label]) => (
        <Button key={key} variant={filter === key ? "primary" : "secondary"} aria-pressed={filter === key} onClick={() => setFilter(key)}>
          {label}{key === "all" && !loading ? ` (${queue.length})` : ""}
        </Button>
      ))}
    </div>
    <div className="grid items-start gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
      <Panel className="p-3">
        <div className="lv-eyebrow px-3 py-3">SUBMITTED CONTENT</div>
        {loading ? (
          <div className="lv-muted p-4 text-sm">Loading approvals queue…</div>
        ) : filtered.length === 0 ? (
          <Empty title="No items in this view">
            Choose another filter or submit content from the Check Content workspace.
          </Empty>
        ) : (
          <div className="space-y-2 motion-stagger">
            {filtered.map(item => (
              <button
                type="button"
                key={item.id}
                className={`motion-interactive w-full rounded-xl border p-4 text-left transition-colors ${detail?.id === item.id ? "border-indigo-400/40 bg-indigo-400/10" : "border-transparent hover:bg-indigo-400/5"}`}
                disabled={busy}
                onClick={() => { onSelectDraft(item.id); if (selectedDraftId === item.id) void loadItem(item.id); }}
              >
                <div className="mb-2.5 flex flex-wrap gap-2">
                  <Badge tone={
                    item.status === "needs_revalidation" || item.validity_status === "needs_revalidation"
                      ? "danger"
                      : item.route === "senior"
                      ? "warning"
                      : item.status === "approved"
                      ? "success"
                      : "neutral"
                  }>
                    {item.status === "needs_revalidation" || item.validity_status === "needs_revalidation"
                      ? "Needs revalidation"
                      : item.route === "senior"
                      ? "Senior escalation"
                      : item.status.replace(/_/g, " ")}
                  </Badge>
                  {item.seeded && <Badge>Sample</Badge>}
                </div>
                <h3 className="text-sm font-medium leading-6 text-ink">{item.title.replace(/\[SEEDED SAMPLE\]/gi, "").trim()}</h3>
                <p className="lv-muted mt-1.5 font-mono text-[10px]">Revision {item.revision} · {item.author}</p>
              </button>
            ))}
          </div>
        )}
      </Panel>

      <div className="min-w-0 space-y-6">
        {itemLoading ? (
          <Empty title="Loading content revision…"/>
        ) : !detail ? (
          <Empty title="Select an item to review">
            Its claims, evidence sources, revision trail, and approval controls will appear here.
          </Empty>
        ) : <>
          {(detail.validity_status === "needs_revalidation" || detail.status === "needs_revalidation") && (
            <Panel className="border-rose-500/40 bg-rose-500/[0.06] p-6 rounded-2xl">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <Badge tone="danger">Evidence Recall</Badge>
                    <span className="font-semibold text-rose-300 text-sm">Content requires revalidation</span>
                  </div>
                  <p className="text-sm text-ink mt-1 font-medium">{detail.recall_reason || "A cited evidence passport or brand rule has expired, been revoked, or updated."}</p>
                  <p className="lv-muted text-xs mt-1.5">
                    <Icon name="lock" size={12} className="inline mr-1" />
                    <strong>Historical approval preserved:</strong> Revision {detail.approved_revision_id || detail.revision} was previously approved and is preserved in the audit trail. Publication validity is paused pending human re-check and sign-off.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    className="!text-xs"
                    disabled={busy}
                    onClick={() => void handleRecheck()}
                  >
                    <Icon name="spark" size={13} /> Re-check content
                  </Button>
                  <Button
                    variant="primary"
                    className="!text-xs"
                    disabled={busy}
                    onClick={() => setShowReopenModal(true)}
                  >
                    <Icon name="refresh" size={13} /> Reopen for review
                  </Button>
                </div>
              </div>
            </Panel>
          )}

          <Panel className="p-6 md:p-8">
            <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="lv-eyebrow mb-2">REVISION {detail.revision} · {detail.channel || "GENERAL"}</div>
                <h2 className="font-display text-2xl font-medium tracking-tight text-ink">{detail.title.replace(/\[SEEDED SAMPLE\]/gi, "").trim()}</h2>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  <Badge tone={
                    detail.status === "needs_revalidation" || detail.validity_status === "needs_revalidation"
                      ? "danger"
                      : detail.status === "approved"
                      ? "success"
                      : "neutral"
                  }>
                    {detail.status === "needs_revalidation" || detail.validity_status === "needs_revalidation"
                      ? "Needs revalidation"
                      : detail.status.replace(/_/g, " ")}
                  </Badge>
                  {route && <Badge tone={route === "senior" ? "warning" : "accent"}>{route === "senior" ? "Senior escalation" : "Standard review"}</Badge>}
                  {detail.seeded && <Badge>Sample</Badge>}
                </div>
              </div>
              <Button onClick={() => onOpenEditor(detail.id)}>
                Open in Check Content <Icon name="arrow" size={14}/>
              </Button>
            </div>

            <blockquote className="lv-well mb-6 whitespace-pre-wrap p-5 text-base leading-8 rounded-2xl">
              {detail.text}
            </blockquote>

            <div className="mb-6 grid gap-4 sm:grid-cols-3">
              {[["Audience", detail.audience], ["Campaign goal", detail.purpose], ["Call to action", detail.cta]].map(([label, value]) => (
                <div key={label}>
                  <div className="lv-label mb-1.5">{label}</div>
                  <p className="text-sm leading-6 text-ink">{value || "Not specified"}</p>
                </div>
              ))}
            </div>

            {detail.findings.some(f => f.is_claim) && (
              <div className="mb-6 space-y-3">
                <div className="lv-eyebrow mb-2">PROMOTIONAL CLAIMS &amp; EVIDENCE</div>
                {detail.findings.filter(f => f.is_claim).map(f => {
                  const tier = getIssueTier(f);
                  return (
                    <div key={f.id} className="lv-well p-4 rounded-xl space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <IssueBadge tier={tier} />
                          <Badge tone={f.evidence_status === "supported" && f.passport?.state === "current" ? "success" : "warning"}>
                            {f.evidence_status?.replace(/_/g, " ") || "Needs review"}
                          </Badge>
                        </div>
                        {f.passport && (
                          <Button variant="ghost" onClick={() => setPassport(f.passport)} className="!h-8 !px-2.5 !text-xs">
                            <Icon name="file" size={13}/> Inspect source ({f.passport.ref})
                          </Button>
                        )}
                      </div>
                      <p className="text-sm leading-6 text-ink">“{f.quote}”</p>
                      <p className="lv-muted text-xs leading-5">{f.explanation}</p>
                      {f.passport && (
                        <p className="text-[11px] text-muted flex items-center gap-1">
                          <Icon name="shield" size={12}/> The approved source behind this claim: <strong>{f.passport.document.title}</strong>
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {detail.blockers.length > 0 ? (
              <Notice tone="danger">
                <div className="mb-2 font-medium">{detail.blockers.length} unresolved approval blocker{detail.blockers.length === 1 ? "" : "s"}</div>
                <ul className="space-y-2 text-sm pl-1">
                  {detail.blockers.map((b, i) => (
                    <li key={i} className="rounded-lg border border-rose-500/20 bg-rose-500/[0.04] p-3 text-xs">
                      <div className="font-semibold text-rose-300">{b.message}</div>
                      {b.who_can_resolve && (
                        <div className="mt-1 text-ink">
                          <span className="text-muted">Who can resolve: </span>
                          {b.who_can_resolve}
                        </div>
                      )}
                      {b.next_step && (
                        <div className="mt-0.5 text-muted">
                          <span>Next step: </span>
                          {b.next_step}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </Notice>
            ) : (
              <Notice tone={detail.analysis ? "success" : "warning"}>
                {detail.analysis
                  ? "All required claim verifications passed. Ready for human reviewer decision."
                  : "This revision has not been checked. Run content checks before approving."}
              </Notice>
            )}
          </Panel>

          <Panel className="p-6 md:p-8">
            <div className="lv-eyebrow mb-1">DECISION</div>
            <h2 className="mb-4 font-display text-xl font-medium">Human sign-off</h2>

            {detail.assigned_reviewer && (
              <div className="mb-4 text-xs text-muted flex items-center gap-1.5 rounded-lg border border-line bg-well/30 p-2.5">
                <Icon name="lock" size={13} className="text-ink" />
                <span>Assigned Reviewer: <strong className="text-ink">{detail.assigned_reviewer.name}</strong> ({detail.assigned_reviewer.email})</span>
              </div>
            )}

            {self && awaiting && (
              <Notice tone="warning" className="mb-5">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <p className="max-w-lg text-sm leading-6">
                      <strong>Authors cannot approve their own drafts.</strong> Submission requires independent sign-off by a qualified reviewer or brand owner.
                    </p>
                  </div>
                  {detail.eligible_reviewers && detail.eligible_reviewers.length > 0 && onSwitchReviewer && (
                    <div className="pt-2 border-t border-amber-500/20">
                      <span className="text-xs text-muted block mb-1.5">Switch to an eligible independent reviewer:</span>
                      <div className="flex flex-wrap gap-2">
                        {detail.eligible_reviewers.map(r => (
                          <Button
                            key={r.id}
                            variant="secondary"
                            className="!text-xs !py-1 !px-2.5"
                            onClick={() => onSwitchReviewer(r.role === "senior_reviewer")}
                          >
                            Switch to {r.name} ({r.role.replace(/_/g, " ")}) →
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Notice>
            )}

            {!self && (!rightRole) && awaiting && (
              <Notice tone="warning" className="mb-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <p className="max-w-lg text-sm leading-6">
                    {route === "senior"
                      ? "This content contains sensitive claims and requires Senior Reviewer sign-off."
                      : "Switch to a reviewer to sign off this content."}
                  </p>
                  {onSwitchReviewer && (
                    <Button onClick={() => onSwitchReviewer(route === "senior")}>
                      Switch to {route === "senior" ? "Senior Reviewer" : "Reviewer"} <Icon name="arrow" size={14}/>
                    </Button>
                  )}
                </div>
              </Notice>
            )}

            {!awaiting && (
              <Notice className="mb-5">
                {detail.status === "approved"
                  ? `Revision ${detail.revision} is already approved. Edit in Check Content to start a new revision.`
                  : "This draft is not currently awaiting review."}
              </Notice>
            )}

            <label className="lv-label block">
              Decision note (required)
              <textarea
                className="lv-input mt-2 text-xs"
                rows={3}
                placeholder="Record what you verified or explain changes needed for the audit log…"
                value={note}
                onChange={e => setNote(e.target.value)}
                disabled={!canDecide || busy}
              />
            </label>

            <div className="mt-4 flex flex-wrap gap-3">
              <Button
                variant="primary"
                disabled={busy || !canDecide || note.trim().length < 3 || detail.blockers.length > 0}
                onClick={() => decide(true)}
              >
                <Icon name="check" size={14}/>
                {busy ? "Recording approval…" : `Approve revision ${detail.revision}`}
              </Button>
              <Button
                variant="danger"
                disabled={busy || !canDecide || note.trim().length < 3}
                onClick={() => decide(false)}
              >
                Request changes
              </Button>
            </div>
            <p className="lv-muted mt-2.5 text-xs leading-5">
              A decision note is required. Permissions, four-eyes policy, and evidence gates are enforced by the server.
            </p>

            {gate && (
              <Notice tone={gate.ok ? "success" : "danger"} className="mt-4">
                <strong>{gate.title}</strong>
                <p className="mt-1 text-sm">{gate.message}</p>
                {gate.blockers?.length ? (
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                    {gate.blockers.map((b, i) => <li key={i}>{b.message}</li>)}
                  </ul>
                ) : null}
              </Notice>
            )}
          </Panel>

          <div className="grid items-start gap-5 lg:grid-cols-2">
            <Panel className="p-6">
              <div className="lv-eyebrow mb-2">DECISIONS &amp; NOTES</div>
              <h2 className="mb-4 font-display text-lg font-medium">Review history</h2>
              {history?.decisions.length ? (
                <ol className="space-y-4 border-l border-line pl-4">
                  {history.decisions.map(d => (
                    <li key={d.id} className="relative text-xs">
                      <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-indigo-400"/>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-ink">{d.by}</span>
                        <Badge tone={d.kind === "approved" ? "success" : "neutral"}>{d.kind.replace(/_/g, " ")}</Badge>
                        {d.seeded && <Badge>Sample</Badge>}
                      </div>
                      <p className="mt-1.5 whitespace-pre-wrap text-sm leading-6 text-ink">{d.body}</p>
                      <p className="lv-muted mt-1 font-mono text-[10px]">{formatDate(d.at)}{d.route ? ` · ${d.route} route` : ""}</p>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="lv-muted text-xs">No prior review decisions recorded.</p>
              )}
              <form onSubmit={addComment} className="lv-divider mt-5 space-y-2.5 border-t pt-4">
                <label className="lv-label block">
                  Add review note
                  <textarea
                    className="lv-input mt-1.5 text-xs"
                    rows={2}
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    placeholder="Leave a note for the author or co-reviewers…"
                    required
                    disabled={busy}
                  />
                </label>
                <Button type="submit" disabled={busy || !comment.trim()}>
                  {busy ? "Posting…" : "Post note"}
                </Button>
              </form>
            </Panel>

            <Panel className="p-6">
              <div className="lv-eyebrow mb-2">AUDIT TRAIL</div>
              <h2 className="mb-4 font-display text-lg font-medium">Event log</h2>
              {history?.audit.length ? (
                <ol className="space-y-3 border-l border-line pl-4">
                  {history.audit.map(event => (
                    <li key={event.id} className="relative text-xs">
                      <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-fuchsia-400/60"/>
                      <div className="flex flex-wrap gap-2">
                        <span className="font-mono text-xs font-medium text-ink">{event.action}</span>
                        {event.seeded && <Badge>Sample</Badge>}
                      </div>
                      <p className="lv-muted mt-0.5 text-[11px]">{event.by} · {formatDate(event.at)}</p>
                      <ExpandableDetails title="View event details" className="mt-1.5">
                        <pre className="overflow-x-auto whitespace-pre-wrap break-words text-[10px] leading-4">
                          {JSON.stringify(event.details, null, 2)}
                        </pre>
                      </ExpandableDetails>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="lv-muted text-xs">No audit events recorded.</p>
              )}
            </Panel>
          </div>
        </>}
      </div>
    </div>
    {showReopenModal && (
      <Modal
        title="Reopen draft for review"
        onClose={() => setShowReopenModal(false)}
      >
        <form onSubmit={handleReopen} className="space-y-4">
          <p className="text-xs text-muted leading-5">
            Reopening unlocks the draft for editing, re-checking, and team resubmission. The historical approval decision will remain preserved in the audit log.
          </p>
          <label className="lv-label block">
            Reason for reopening (optional)
            <textarea
              className="lv-input mt-1.5 text-xs"
              rows={3}
              placeholder="e.g., Reopening to update 40% claim with new Q4 benchmark data…"
              value={reopenReason}
              onChange={e => setReopenReason(e.target.value)}
              disabled={busy}
            />
          </label>
          <div className="flex justify-end gap-2 pt-2 border-t border-line/40">
            <Button disabled={busy} onClick={() => setShowReopenModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={busy}>
              {busy ? "Reopening…" : "Reopen draft"}
            </Button>
          </div>
        </form>
      </Modal>
    )}
    {passport && (
      <SourceModal
        brandId={brandId}
        docId={passport.document.id}
        initialPage={passport.page}
        highlightExcerpt={passport.excerpt}
        passport={passport}
        onClose={() => setPassport(null)}
      />
    )}
  </div>;
};
