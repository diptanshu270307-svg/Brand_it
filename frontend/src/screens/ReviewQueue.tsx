import React, { useEffect, useRef, useState } from "react";
import { api, ApiError, DraftDetail, DraftSummary, HistoryData, Passport } from "../api";
import { SourceModal } from "../components/SourceModal";
import { Badge, Button, Empty, Icon, Notice, PageHeading, Panel, errorText, formatDate } from "../components/ui";

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
  const requestId = useRef(0);

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
    if (!detail) return;
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
    e.preventDefault(); if (!detail || !comment.trim()) return;
    setBusy(true); setError("");
    try { const result = await api.addComment(brandId, detail.id, comment.trim()); setHistory(result); setComment(""); }
    catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  };
  const route = detail?.route || detail?.computed_route;
  const self = !!detail && userId === detail.author_id;
  const awaiting = detail?.status === "in_review" || detail?.status === "senior_review";
  const rightRole = ["reviewer", "senior_reviewer", "brand_owner"].includes(role) && (route !== "senior" || role === "senior_reviewer");
  const canDecide = !!detail?.can_review && rightRole && !self && awaiting;
  const filtered = queue.filter(d => filter === "all" || filter === "actionable" && d.actionable || filter === "senior" && d.route === "senior" || filter === "approved" && d.status === "approved");

  return <div>
    <PageHeading eyebrow="HUMAN CONTROL / FINAL SIGN-OFF" title="The review queue" description="The evidence informs the decision. A named reviewer makes it. Inspect the checked revision and leave a clear decision trail." action={<Badge tone="accent"><Icon name="lock" size={13}/>{role.replace(/_/g, " ")}</Badge>}/>
    {error && <Notice tone="danger" className="mb-5">{error}</Notice>}
    <div className="mb-6 flex flex-wrap gap-2">{[["all", "All packets"], ["actionable", "Ready for your review"], ["senior", "Senior escalation"], ["approved", "Approved"]].map(([key, label]) => <Button key={key} variant={filter === key ? "primary" : "secondary"} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}{key === "all" && !loading ? ` · ${queue.length}` : ""}</Button>)}</div>
    <div className="grid items-start gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
      <Panel className="p-3"><div className="lv-eyebrow px-3 py-4">REVIEW PACKETS</div>{loading ? <div className="lv-muted p-4 text-sm">Loading queue…</div> : filtered.length === 0 ? <Empty title="No packets in this view">Choose another filter or submit a checked draft from the review desk.</Empty> : <div className="space-y-2">{filtered.map(item => <button type="button" key={item.id} className={`w-full rounded-xl border p-4 text-left transition-colors ${detail?.id === item.id ? "border-indigo-400/40 bg-indigo-400/10" : "border-transparent hover:bg-indigo-400/5"}`} disabled={busy} onClick={() => { onSelectDraft(item.id); if (selectedDraftId === item.id) void loadItem(item.id); }}><div className="mb-3 flex flex-wrap gap-2"><Badge tone={item.route === "senior" ? "warning" : item.status === "approved" ? "success" : "neutral"}>{item.route === "senior" ? "Senior escalation" : item.status.replace(/_/g, " ")}</Badge>{item.seeded && <Badge>Sample</Badge>}</div><h3 className="text-sm font-medium leading-6">{item.title.replace(/\[SEEDED SAMPLE\]/gi, "").trim()}</h3><p className="lv-muted mt-2 font-mono text-[10px]">REV {item.revision} · {item.author}</p></button>)}</div>}</Panel>
      <div className="min-w-0 space-y-6">
        {itemLoading ? <Empty title="Loading the checked revision…"/> : !detail ? <Empty title="Choose a review packet">Its evidence, revision history and approval controls will appear here.</Empty> : <>
          <Panel className="p-6 md:p-8"><div className="mb-6 flex flex-wrap items-start justify-between gap-4"><div><div className="lv-eyebrow mb-3">REVISION {detail.revision} / {detail.channel || "CHANNEL NOT SET"}</div><h2 className="font-display text-2xl font-medium tracking-tight">{detail.title.replace(/\[SEEDED SAMPLE\]/gi, "").trim()}</h2><div className="mt-3 flex flex-wrap gap-2"><Badge tone={detail.status === "approved" ? "success" : "neutral"}>{detail.status.replace(/_/g, " ")}</Badge>{route && <Badge tone={route === "senior" ? "warning" : "accent"}>{route === "senior" ? "Senior escalation" : "Standard review"}</Badge>}{detail.seeded && <Badge>Sample history</Badge>}</div></div><Button onClick={() => onOpenEditor(detail.id)}>Open Review Desk<Icon name="arrow"/></Button></div>
            <blockquote className="lv-well mb-6 whitespace-pre-wrap p-6 text-base leading-8">{detail.text}</blockquote>
            <div className="mb-6 grid gap-4 sm:grid-cols-3">{[["Audience", detail.audience], ["Purpose", detail.purpose], ["Call to action", detail.cta]].map(([label, value]) => <div key={label}><div className="lv-label mb-2">{label}</div><p className="text-sm leading-6">{value || "Not specified"}</p></div>)}</div>
            <div className="lv-divider mb-6 flex flex-wrap gap-x-6 gap-y-2 border-y py-4 font-mono text-[11px]"><span>CHECKED {detail.analysis ? formatDate(detail.analysis.at) : "NOT YET"}</span><span>PROVIDER {detail.analysis?.provider || "NOT AVAILABLE"}</span><span>BLOCKERS {detail.analysis ? detail.blockers.length : "UNMEASURED"}</span></div>
            {detail.findings.some(f => f.is_claim) && <div className="mb-6 space-y-3"><div className="lv-eyebrow mb-3">CLAIMS & SUPPORTING EVIDENCE</div>{detail.findings.filter(f => f.is_claim).map(f => <div key={f.id} className="lv-well p-4"><div className="flex flex-wrap items-center justify-between gap-3"><Badge tone={f.evidence_status === "supported" && f.passport?.state === "current" ? "success" : "warning"}>{f.evidence_status?.replace(/_/g, " ") || "Needs review"}</Badge>{f.passport && <Button variant="ghost" onClick={() => setPassport(f.passport)}>Inspect {f.passport.ref}<Icon name="file" size={14}/></Button>}</div><p className="mt-3 text-sm leading-7">“{f.quote}”</p><p className="lv-muted mt-2 text-xs leading-6">{f.explanation}</p>{f.passport && f.passport.state !== "current" && <p className="lv-text-danger mt-2 text-xs">Current passport state: {f.passport.state.replace(/_/g, " ")}. Historical support does not establish current validity.</p>}</div>)}</div>}
            {detail.blockers.length > 0 ? <Notice tone="danger"><div className="mb-2 font-medium">{detail.blockers.length} unresolved approval gate {detail.blockers.length === 1 ? "issue" : "issues"}</div><ul className="list-disc space-y-2 pl-5 text-sm">{detail.blockers.map((b, i) => <li key={i}>{b.message}</li>)}</ul></Notice> : <Notice tone={detail.analysis ? "success" : "warning"}>{detail.analysis ? `The current packet reports ${detail.blockers.length} blockers. The server will recheck before accepting approval.` : "This revision has not been checked. Return to the Review Desk before submitting."}</Notice>}
          </Panel>
          <Panel className="p-6 md:p-8"><div className="lv-eyebrow mb-3">YOUR DECISION</div><h2 className="mb-5 font-display text-xl font-medium">Human sign-off</h2>
            {(!rightRole || self) && awaiting && <Notice tone="warning" className="mb-5"><div className="flex flex-wrap items-center justify-between gap-4"><p className="max-w-lg text-sm leading-6">{self ? "Authors cannot approve their own work. Switch to an independent reviewer to continue." : route === "senior" ? "This packet requires the senior reviewer. Your current role cannot approve it." : "Switch to a reviewer to sign off this revision."}</p>{onSwitchReviewer && <Button onClick={() => onSwitchReviewer(route === "senior")}>Switch to {route === "senior" ? "Senior Reviewer" : "Reviewer"}<Icon name="arrow"/></Button>}</div></Notice>}
            {!awaiting && <Notice className="mb-5">{detail.status === "approved" ? `Revision ${detail.revision} already has a recorded approval. Edit as the author to start a new revision.` : "This packet is not awaiting review. The author must submit a checked revision."}</Notice>}
            <label className="lv-label block">Decision note<textarea className="lv-input mt-2" rows={3} placeholder="Record what you verified, or explain the changes needed…" value={note} onChange={e => setNote(e.target.value)} disabled={!canDecide || busy}/></label>
            <div className="mt-4 flex flex-wrap gap-3"><Button variant="primary" disabled={busy || !canDecide || note.trim().length < 3 || detail.blockers.length > 0} onClick={() => decide(true)}><Icon name="check"/>{busy ? "Recording decision…" : `Approve revision ${detail.revision}`}</Button><Button variant="danger" disabled={busy || !canDecide || note.trim().length < 3} onClick={() => decide(false)}>Request changes</Button></div><p className="lv-muted mt-3 text-xs leading-5">A decision note is required. Permissions, current revision and evidence gates are enforced by the server.</p>
            {gate && <Notice tone={gate.ok ? "success" : "danger"} className="mt-5"><strong>{gate.title}</strong><p className="mt-2 text-sm">{gate.message}</p>{gate.blockers?.length ? <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{gate.blockers.map((b, i) => <li key={i}>{b.message}</li>)}</ul> : null}</Notice>}
          </Panel>
          <div className="grid items-start gap-5 lg:grid-cols-2"><Panel className="p-6"><div className="lv-eyebrow mb-3">CONVERSATION & DECISIONS</div><h2 className="mb-6 font-display text-xl font-medium">Review history</h2>{history?.decisions.length ? <ol className="space-y-6 border-l border-line pl-5">{history.decisions.map(d => <li key={d.id} className="relative"><span className="absolute -left-[25px] top-1.5 h-2 w-2 rounded-full bg-indigo-400"/><div className="flex flex-wrap items-center gap-2"><span className="text-sm font-medium">{d.by}</span><Badge tone={d.kind === "approved" ? "success" : "neutral"}>{d.kind.replace(/_/g, " ")}</Badge>{d.seeded && <Badge>Sample</Badge>}</div><p className="mt-2 whitespace-pre-wrap text-sm leading-7">{d.body}</p><p className="lv-muted mt-2 font-mono text-[10px]">{formatDate(d.at)}{d.route ? ` · ${d.route} route` : ""}</p></li>)}</ol> : <p className="lv-muted text-sm">No review decisions or comments recorded.</p>}<form onSubmit={addComment} className="lv-divider mt-6 space-y-3 border-t pt-5"><label className="lv-label block">Add a review comment<textarea className="lv-input mt-2" rows={2} value={comment} onChange={e => setComment(e.target.value)} placeholder="Leave context for the next reviewer…" required/></label><Button type="submit" disabled={busy || !comment.trim()}>Post comment<Icon name="arrow" size={14}/></Button></form></Panel>
          <Panel className="p-6"><div className="lv-eyebrow mb-3">EVENT RECORD</div><h2 className="mb-6 font-display text-xl font-medium">Audit trail</h2>{history?.audit.length ? <ol className="space-y-5 border-l border-line pl-5">{history.audit.map(event => <li key={event.id} className="relative"><span className="absolute -left-[25px] top-1.5 h-2 w-2 rounded-full bg-fuchsia-400/60"/><div className="flex flex-wrap gap-2"><span className="font-mono text-xs">{event.action}</span>{event.seeded && <Badge>Sample</Badge>}</div><p className="lv-muted mt-1 text-xs">{event.by} · {formatDate(event.at)}</p><details className="mt-2"><summary className="lv-muted cursor-pointer text-xs">View event details</summary><pre className="lv-well mt-2 overflow-x-auto whitespace-pre-wrap break-words p-3 font-mono text-[10px] leading-5">{JSON.stringify(event.details, null, 2)}</pre></details></li>)}</ol> : <p className="lv-muted text-sm">No audit events returned.</p>}</Panel></div>
        </>}
      </div>
    </div>
    {passport && <SourceModal brandId={brandId} docId={passport.document.id} initialPage={passport.page} highlightExcerpt={passport.excerpt} passport={passport} onClose={() => setPassport(null)}/>}
  </div>;
};
