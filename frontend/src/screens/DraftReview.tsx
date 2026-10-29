import React, { useEffect, useMemo, useRef, useState } from "react";
import { api, DraftDetail, DraftSummary, FindingItem, Passport, RuleItem } from "../api";
import { SourceModal } from "../components/SourceModal";
import { Badge, Button, Empty, Icon, Modal, Notice, PageHeading, Panel, Tone, errorText, formatDate, percentage } from "../components/ui";

interface Props {
  brandId: number;
  role: string;
  selectedDraftId: number | null;
  onSelectDraft: (id: number) => void;
  onOpenQueue?: (id: number) => void;
}
type FormDraft = { title: string; channel: string; text: string; audience: string; purpose: string; cta: string };
type SourceSelection = { docId: number; page?: number; excerpt?: string; passport?: Passport | null; claimQuote?: string; evidenceStatus?: string | null };
const blankDraft: FormDraft = { title: "", channel: "Instagram", text: "", audience: "", purpose: "", cta: "" };
const samples = [
  { label: "Same number, wrong metric", text: "Lumina reduces downtime by 40% for every customer." },
  { label: "Unqualified guarantee", text: "Lumina guarantees results for every team." },
  { label: "Unfamiliar fact", text: "Lumina is certified for use in every country." },
];
const dimensions = ["Product", "Metric", "Population", "Timeframe", "Qualifiers"];
const label = (value: string) => value.replace(/_/g, " ");
function statusTone(value?: string | null): Tone {
  if (["supported", "approved", "current"].includes(value || "")) return "success";
  if (["expired", "missing", "insufficient", "rejected", "critical", "high"].includes(value || "")) return "danger";
  if (["needs_review", "pending", "not_yet_valid", "medium", "senior_review", "changes_requested"].includes(value || "")) return "warning";
  return "neutral";
}

function HighlightedDraft({ text, findings, active, onSelect }: { text: string; findings: FindingItem[]; active: number | null; onSelect: (id: number) => void }) {
  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  const sorted = [...findings].filter(f => f.start >= 0 && f.end <= text.length && f.start < f.end && text.slice(f.start, f.end) === f.quote).sort((a, b) => a.start - b.start || b.end - a.end);
  for (const finding of sorted) {
    if (finding.start < cursor) continue;
    nodes.push(text.slice(cursor, finding.start));
    const supported = finding.is_claim && finding.evidence_status === "supported" && finding.passport?.state === "current";
    nodes.push(<button key={finding.id} type="button" aria-pressed={active === finding.id} onClick={() => onSelect(finding.id)} title={finding.explanation} className={`inline rounded-sm border-b-2 px-0.5 text-left text-inherit transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400 ${supported ? "border-emerald-400/60 bg-emerald-400/10" : finding.is_claim ? "border-rose-400/60 bg-rose-400/10" : "border-amber-400/60 bg-amber-400/10"} ${active === finding.id ? "ring-2 ring-indigo-400/60" : ""}`}>{text.slice(finding.start, finding.end)}</button>);
    cursor = finding.end;
  }
  nodes.push(text.slice(cursor));
  return <div className="whitespace-pre-wrap break-words text-[15px] leading-[2.1]">{nodes}</div>;
}

export const DraftReview: React.FC<Props> = ({ brandId, role, selectedDraftId, onSelectDraft, onOpenQueue }) => {
  const [drafts, setDrafts] = useState<DraftSummary[]>([]);
  const [detail, setDetail] = useState<DraftDetail | null>(null);
  const [rules, setRules] = useState<RuleItem[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState("all");
  const [activeFindingId, setActiveFindingId] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [editor, setEditor] = useState({ text: "", audience: "", purpose: "", cta: "" });
  const [confirmed, setConfirmed] = useState<Record<number, boolean>>({});
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [approvalComment, setApprovalComment] = useState("");
  const [quickText, setQuickText] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [newDraft, setNewDraft] = useState<FormDraft>(blankDraft);
  const [source, setSource] = useState<SourceSelection | null>(null);
  const [ruleSource, setRuleSource] = useState<FindingItem | null>(null);
  const [loadVersion, setLoadVersion] = useState(0);
  const currentView = useRef("");
  currentView.current = `${brandId}:${role}:${selectedDraftId ?? "none"}`;
  const currentSelected = useRef(selectedDraftId);
  currentSelected.current = selectedDraftId;
  const selectionNotice = useRef<{ draftId: number; message: string } | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  function applyDetail(next: DraftDetail) {
    setDetail(next);
    setEditor({ text: next.text, audience: next.audience, purpose: next.purpose, cta: next.cta });
    setConfirmed({});
  }

  useEffect(() => {
    let active = true;
    setListLoading(true); setDrafts([]); setRules([]);
    api.listDrafts(brandId).then(list => {
      if (!active) return;
      setDrafts(list);
      const requested = currentSelected.current;
      const target = list.find(d => d.id === requested) || list.find(d => !d.seeded) || list[0];
      if (target && target.id !== requested) onSelectDraft(target.id);
    }).catch(e => { if (active) setError(errorText(e)); }).finally(() => { if (active) setListLoading(false); });
    api.library(brandId).then(library => { if (active) setRules(library.rules); }).catch(() => { /* Source lookup reports a contextual error when needed. */ });
    return () => { active = false; };
  }, [brandId, role, loadVersion]);

  useEffect(() => {
    let active = true;
    setDetail(null); setEditing(false); setActiveFindingId(null); setSource(null); setRuleSource(null);
    const notice = selectionNotice.current;
    setError(""); setMessage(notice?.draftId === selectedDraftId ? notice.message : ""); setBusy(""); setRejectingId(null); setApprovalComment(""); setConfirmed({});
    if (notice?.draftId === selectedDraftId) selectionNotice.current = null;
    if (!selectedDraftId) { setDetailLoading(false); return () => { active = false; }; }
    setDetailLoading(true);
    api.getDraft(brandId, selectedDraftId).then(next => {
      if (!active) return;
      applyDetail(next);
      setActiveFindingId(next.findings.find(f => f.is_claim)?.id ?? next.findings[0]?.id ?? null);
    }).catch(e => { if (active) setError(errorText(e)); }).finally(() => { if (active) setDetailLoading(false); });
    return () => { active = false; };
  }, [brandId, role, selectedDraftId, loadVersion]);

  async function runAction(name: string, request: () => Promise<DraftDetail>, success?: string, after?: (next: DraftDetail) => void) {
    if (busy) return;
    const key = currentView.current;
    setBusy(name); setError(""); setMessage("");
    try {
      const next = await request();
      if (!mounted.current || currentView.current !== key) return;
      applyDetail(next); setEditing(false); setRejectingId(null); setRejectReason("");
      if (success) setMessage(success);
      const list = await api.listDrafts(brandId);
      if (!mounted.current || currentView.current !== key) return;
      setDrafts(list); after?.(next);
    } catch (e) {
      if (mounted.current && currentView.current === key) {
        setError(errorText(e));
        // A denied approval may still commit its pre-approval analysis and routing.
        // Refresh those results while retaining the original gate error.
        if (name === "approve" && detail) {
          try {
            const refreshed = await api.getDraft(brandId, detail.id);
            if (mounted.current && currentView.current === key) {
              applyDetail(refreshed);
              setDrafts(previous => previous.map(draft => draft.id === refreshed.id ? refreshed : draft));
            }
          } catch { /* Keep the actionable approval error if the refresh also fails. */ }
        }
      }
    }
    finally { if (mounted.current && currentView.current === key) setBusy(""); }
  }

  async function createDraft(body: FormDraft, check: boolean) {
    if (busy) return;
    const key = currentView.current;
    setBusy(check ? "test" : "create"); setError(""); setMessage("");
    try {
      const created = await api.createDraft(brandId, body);
      let checkFailure = "";
      if (check) {
        try { await api.checkDraft(brandId, created.id); }
        catch (e) { checkFailure = errorText(e); }
      }
      if (!mounted.current || currentView.current !== key) return;
      setShowNew(false); setNewDraft(blankDraft); setQuickText("");
      const list = await api.listDrafts(brandId);
      if (!mounted.current || currentView.current !== key) return;
      setDrafts(list);
      if (checkFailure) selectionNotice.current = { draftId: created.id, message: `Draft created, but its check did not complete: ${checkFailure} Run checks again on the saved draft.` };
      onSelectDraft(created.id);
    } catch (e) { if (mounted.current && currentView.current === key) setError(errorText(e)); }
    finally { if (mounted.current && currentView.current === key) setBusy(""); }
  }

  async function openFindingSource(finding: FindingItem) {
    if (finding.passport) {
      const passport = finding.passport;
      setSource({ docId: passport.document.id, page: passport.page, excerpt: passport.excerpt, passport, claimQuote: finding.quote, evidenceStatus: finding.evidence_status });
      return;
    }
    const key = currentView.current;
    try {
      const libraryRules = rules.length ? rules : (await api.library(brandId)).rules;
      if (!mounted.current || currentView.current !== key) return;
      const rule = libraryRules.find(r => finding.rule?.id === r.id) || libraryRules.find(r => r.key === finding.rule?.key && r.version === finding.rule?.version);
      if (rule?.source) setSource({ docId: rule.source.document_id, page: rule.source.page || 1, excerpt: finding.source_excerpt || rule.excerpt });
      else setRuleSource(finding);
    } catch (e) { if (mounted.current && currentView.current === key) setError(`Could not load the cited source. ${errorText(e)}`); }
  }

  const filtered = useMemo(() => detail?.findings.filter(f => filter === "all" || (filter === "claims" ? f.is_claim : f.severity === filter)) || [], [detail, filter]);
  const activeFinding = detail?.findings.find(f => f.id === activeFindingId) || detail?.findings.find(f => f.is_claim) || detail?.findings[0];
  const claims = detail?.findings.filter(f => f.is_claim) || [];
  const supportedClaims = claims.filter(f => f.evidence_status === "supported" && f.passport?.state === "current");
  const hasAnalysis = Boolean(detail?.analysis);
  const dirty = Boolean(detail && (editor.text !== detail.text || editor.audience !== detail.audience || editor.purpose !== detail.purpose || editor.cta !== detail.cta));
  const measured = hasAnalysis && !dirty;
  const coverage = measured && claims.length ? supportedClaims.length / claims.length : null;
  const canEdit = Boolean(detail?.can_edit);
  const canDispose = Boolean(detail && detail.status !== "approved" && (canEdit || role === "reviewer" || role === "senior_reviewer"));
  const canApprove = Boolean(detail?.can_review && (detail.computed_route !== "senior" || role === "senior_reviewer"));
  const passport = activeFinding?.passport;
  const actualNumbers = new Set(detail?.text.match(/\b\d+(?:[.,]\d+)*(?:%|x)?/g) || []);
  const pending = Boolean(busy) || detailLoading;

  return <div className="mx-auto max-w-[1680px] px-4 pb-16 pt-7 sm:px-6 lg:px-9">
    <PageHeading eyebrow="01 / The review desk" title="Great work. Grounded in proof." description="Check the draft, inspect its sources, and keep the final decision human." action={<Button variant="primary" disabled={pending} onClick={() => setShowNew(true)}><Icon name="plus" size={16}/>New draft</Button>}/>
    {error && <Notice tone="danger" className="mb-5 flex flex-wrap items-center justify-between gap-3"><span>{error}</span><Button variant="ghost" onClick={() => setLoadVersion(v => v + 1)} disabled={pending}><Icon name="refresh" size={14}/>Reload desk</Button></Notice>}
    {message && <Notice tone="accent" className="mb-5">{message}</Notice>}
    <div className="grid items-start gap-5 md:grid-cols-[230px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_300px] 2xl:grid-cols-[244px_minmax(0,1fr)_340px]">
      <aside className="space-y-5">
        <Panel className="overflow-hidden">
          <div className="lv-divider flex items-center justify-between border-b p-4"><h2 className="font-display text-sm font-semibold">Your workspace</h2><span className="lv-muted font-mono text-xs">{drafts.length.toString().padStart(2, "0")}</span></div>
          <div className="max-h-[390px] space-y-1 overflow-y-auto p-2">
            {listLoading ? <p className="lv-muted p-4 text-sm" role="status">Loading drafts…</p> : drafts.length ? drafts.map(draft => <button key={draft.id} type="button" disabled={Boolean(busy)} aria-current={draft.id === selectedDraftId ? "true" : undefined} onClick={() => { if (draft.id !== selectedDraftId) onSelectDraft(draft.id); }} className={`w-full rounded-xl border p-3 text-left transition disabled:opacity-50 ${draft.id === selectedDraftId ? "border-indigo-400/40 bg-indigo-400/10" : "border-transparent hover:bg-well"}`}><span className="mb-2 flex items-center gap-2"><Icon name="file" size={15} className={draft.id === selectedDraftId ? "lv-text-accent" : "lv-muted"}/><span className="truncate text-sm font-medium">{draft.title}</span></span><span className="flex flex-wrap items-center gap-2"><span className="lv-muted text-[10px]">{draft.channel || "No channel"}</span><Badge tone={statusTone(draft.status)}>{label(draft.status)}</Badge></span></button>) : <p className="lv-muted p-4 text-sm">Create a draft to begin.</p>}
          </div>
        </Panel>
        <Panel className="p-4">
          <div className="mb-3 flex items-center gap-2"><Icon name="spark" className="lv-text-accent" size={17}/><h2 className="font-display text-sm font-semibold">Test unfamiliar content</h2></div>
          <p className="lv-muted mb-4 text-xs leading-5">Use a fresh claim to see what the configured verifier can establish.</p>
          <form onSubmit={e => { e.preventDefault(); if (quickText.trim()) void createDraft({ ...blankDraft, title: "Unfamiliar claim test", text: quickText.trim(), purpose: "Test a new promotional claim" }, true); }}>
            <label className="sr-only" htmlFor="unfamiliar-claim">Unfamiliar claim</label>
            <textarea id="unfamiliar-claim" className="lv-input min-h-[108px] resize-y text-xs" placeholder="Paste a claim the demo has not seen…" value={quickText} maxLength={20000} disabled={pending} onChange={e => setQuickText(e.target.value)}/>
            <Button type="submit" variant="primary" className="mt-3 w-full justify-center" disabled={pending || !quickText.trim()}><Icon name={busy === "test" ? "clock" : "arrow"} size={15}/>{busy === "test" ? "Creating & checking…" : "Test claim"}</Button>
          </form>
          <div className="mt-4 flex flex-wrap gap-2">{samples.map(sample => <button type="button" key={sample.label} disabled={pending} onClick={() => setQuickText(sample.text)} className="lv-well px-2.5 py-1.5 text-left text-[10px] transition hover:border-indigo-400/50 disabled:opacity-50">{sample.label}</button>)}</div>
          <p className="lv-muted mt-3 text-[10px] leading-4">Creates a separate draft. Examples are test inputs, never approved brand facts.</p>
        </Panel>
        <p className="lv-muted px-2 text-xs leading-6"><Icon name="lock" size={13} className="mr-1 inline"/>Every edit creates a revision. Every approval belongs to one revision.</p>
      </aside>

      <main className="min-w-0 space-y-5">
        {detailLoading ? <Panel className="flex min-h-96 items-center justify-center gap-3 p-8" role="status"><Icon name="clock" className="lv-text-accent"/><span className="lv-muted text-sm">Opening the review studio…</span></Panel> : !detail ? <Empty title="A clear space for your next draft">Choose a draft from the workspace, create a new one, or test an unfamiliar claim.</Empty> : <>
          <Panel className="overflow-hidden">
            <div className="lv-divider flex flex-wrap items-start justify-between gap-4 border-b p-5 sm:p-6">
              <div className="min-w-0"><div className="mb-3 flex flex-wrap gap-2"><Badge tone="accent">{detail.channel || "Draft"}</Badge><Badge tone={statusTone(detail.status)}>{label(detail.status)}</Badge><span className="lv-muted self-center font-mono text-[10px]">REV {detail.revision.toString().padStart(2, "0")}</span></div><h2 className="break-words font-display text-xl font-semibold tracking-tight">{detail.title}</h2><p className="lv-muted mt-2 text-xs">{detail.author} · {formatDate(detail.updated_at)}</p></div>
              <div className="flex flex-wrap gap-2">{canEdit && !editing && <Button variant="ghost" disabled={pending} onClick={() => setEditing(true)}><Icon name="file" size={14}/>{detail.status === "approved" ? "New revision" : "Edit draft"}</Button>}<Button variant="primary" disabled={pending || editing || detail.status === "approved"} onClick={() => void runAction("check", () => api.checkDraft(brandId, detail.id), "The saved revision was checked. Inspect each finding and its source below.")}><Icon name={busy === "check" ? "clock" : "spark"} size={15}/>{busy === "check" ? "Checking…" : "Run checks"}</Button></div>
            </div>
            <div className="p-5 sm:p-6">
              {dirty ? <Notice tone="warning" className="mb-5 text-xs">Proposed change — verification pending. Save this revision, then run checks.</Notice> : !hasAnalysis ? <Notice className="mb-5 text-xs">This revision has not been checked. Scores and evidence coverage will appear after analysis.</Notice> : <div className="lv-well mb-5 flex flex-wrap items-center justify-between gap-3 px-4 py-3"><span className="flex items-center gap-2 text-xs"><Icon name="review" size={15} className="lv-text-accent"/>Checked revision {detail.revision} · analysis #{detail.analysis?.id}</span><Badge tone={detail.analysis?.provider === "mock" ? "warning" : "accent"}>{detail.analysis?.provider === "mock" ? "Offline verifier" : detail.analysis?.provider || "Provider unavailable"}</Badge></div>}
              {editing ? <form onSubmit={e => { e.preventDefault(); if (editor.text.trim()) void runAction("save", () => api.editDraft(brandId, detail.id, editor), "Revision saved. Run checks to verify the proposed changes."); }} className="space-y-4">
                <label className="block"><span className="lv-label mb-2 block">Draft content</span><textarea className="lv-input min-h-[260px] resize-y text-sm leading-7" value={editor.text} maxLength={20000} required disabled={pending} onChange={e => setEditor(previous => ({ ...previous, text: e.target.value }))}/></label>
                <div className="grid gap-3 sm:grid-cols-2">{([['audience', 'Audience'], ['purpose', 'Purpose'], ['cta', 'Call to action']] as const).map(([key, fieldLabel]) => <label key={key} className={key === "cta" ? "sm:col-span-2" : ""}><span className="lv-label mb-2 block">{fieldLabel}</span><input className="lv-input" value={editor[key]} maxLength={300} disabled={pending} onChange={e => setEditor(previous => ({ ...previous, [key]: e.target.value }))}/></label>)}</div>
                <div className="flex flex-wrap gap-2"><Button variant="primary" type="submit" disabled={pending || !dirty || !editor.text.trim()}>{busy === "save" ? "Saving…" : "Save revision"}</Button><Button disabled={pending} onClick={() => { setEditing(false); setEditor({ text: detail.text, audience: detail.audience, purpose: detail.purpose, cta: detail.cta }); }}>Cancel changes</Button></div>
              </form> : <div className="min-h-[170px] py-2"><HighlightedDraft text={detail.text} findings={detail.findings} active={activeFindingId} onSelect={setActiveFindingId}/></div>}
              <div className="lv-divider mt-6 flex flex-wrap items-center gap-2 border-t pt-4"><span className="lv-muted mr-1 text-[10px] uppercase tracking-wider">Content guardrails</span>{actualNumbers.size > 0 && <Badge><Icon name="lock" size={11}/>{actualNumbers.size} numeric value{actualNumbers.size === 1 ? "" : "s"}</Badge>}{detail.cta && <Badge><Icon name="lock" size={11}/>CTA: {detail.cta}</Badge>}{detail.findings.some(f => f.category === "legal") && <Badge tone="warning">Legal rule findings</Badge>}<span className="lv-muted text-[10px]">Flagged changes need explicit confirmation.</span></div>
              {detail.analysis?.notes.map((note, index) => <Notice key={index} tone="warning" className="mt-4 text-xs leading-5">{note}</Notice>)}
            </div>
          </Panel>

          <section aria-labelledby="findings-heading">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 id="findings-heading" className="font-display text-lg font-semibold">The review <span className="lv-muted ml-1 font-mono text-xs">{detail.findings.length}</span></h2><label className="flex items-center gap-2"><span className="lv-muted text-xs">Show</span><select className="lv-input max-w-44 py-2 text-xs" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">All findings</option><option value="claims">Claims & evidence</option>{["critical", "high", "medium", "low", "info"].map(severity => <option key={severity} value={severity}>{label(severity)}</option>)}</select></label></div>
            {!hasAnalysis ? <Empty title="Ready when you are">Run checks on the saved revision to begin the review.</Empty> : !filtered.length ? <Empty title={detail.findings.length ? "No findings in this filter" : "No findings returned"}>{detail.findings.length ? "Choose another filter to inspect the remaining findings." : "The configured checks returned no findings. Human approval is still required; this is not a guarantee of factual correctness."}</Empty> : <div className="space-y-4">{filtered.map(finding => <Panel key={finding.id} className={`overflow-hidden transition ${finding.id === activeFindingId ? "ring-1 ring-indigo-400/60" : ""}`}>
              <div className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3"><button type="button" onClick={() => setActiveFindingId(finding.id)} className="min-w-0 text-left"><span className="lv-eyebrow">{finding.rule ? `${finding.rule.key} · v${finding.rule.version ?? "?"}` : finding.category}</span><span className="mt-2 block font-display text-base font-semibold">{finding.is_claim ? "Claim evidence review" : `${label(finding.category)} review`}</span></button><div className="flex flex-wrap gap-2"><Badge tone={statusTone(finding.evidence_status || finding.severity)}>{label(finding.evidence_status || finding.severity)}</Badge>{finding.disposition && <Badge>{finding.disposition.action === "rejected" ? "Human override" : "Fix accepted"}</Badge>}</div></div>
                <p className="lv-muted mt-3 text-sm leading-6">{finding.explanation}</p>
                {finding.suggestion ? <>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="lv-well min-w-0 p-4"><div className="lv-text-danger mb-2 font-mono text-[10px] uppercase tracking-wider">Current wording</div><p className="whitespace-pre-wrap break-words text-sm leading-6">{finding.suggestion.original}</p></div><div className="lv-well min-w-0 border-indigo-400/20 p-4"><div className="lv-text-accent mb-2 font-mono text-[10px] uppercase tracking-wider">Proposed wording</div><p className="whitespace-pre-wrap break-words text-sm leading-6">{finding.suggestion.replacement}</p></div></div>
                  <p className="lv-text-warning mt-3 flex items-center gap-2 text-[11px]"><Icon name="clock" size={13}/>Proposed change — verification pending</p>
                  {finding.suggestion.protected_flags.length > 0 && <Notice tone="warning" className="mt-4 text-xs"><strong className="block font-medium">This suggestion changes protected content.</strong><ul className="mt-2 list-inside list-disc space-y-1">{finding.suggestion.protected_flags.map((flag, index) => <li key={index}>{flag}</li>)}</ul><label className="mt-3 flex cursor-pointer items-start gap-2"><input type="checkbox" className="mt-0.5 accent-indigo-400" checked={Boolean(confirmed[finding.id])} disabled={pending || !canEdit} onChange={e => setConfirmed(previous => ({ ...previous, [finding.id]: e.target.checked }))}/><span>I reviewed these specific changes and confirm applying them.</span></label></Notice>}
                </> : <blockquote className="lv-well mt-4 whitespace-pre-wrap break-words p-4 text-sm leading-6">“{finding.quote}”</blockquote>}
                {finding.disposition?.reason && <p className="lv-muted mt-3 text-xs leading-5"><span className="font-medium text-ink">{finding.disposition.by}:</span> {finding.disposition.reason}</p>}
                <div className="mt-5 flex flex-wrap gap-2"><Button variant="ghost" disabled={pending} onClick={() => { setActiveFindingId(finding.id); void openFindingSource(finding); }}><Icon name="book" size={14}/>Inspect source</Button>{finding.suggestion && <Button variant="primary" disabled={pending || !canEdit || editing || (finding.suggestion.requires_confirmation && !confirmed[finding.id])} onClick={() => void runAction(`fix-${finding.id}`, () => api.acceptFinding(brandId, detail.id, finding.id, Boolean(confirmed[finding.id])), "Fix applied to a new revision. The backend reran its checks.")}><Icon name="check" size={14}/>{busy === `fix-${finding.id}` ? "Applying & checking…" : "Apply & recheck"}</Button>}{!finding.is_claim && canDispose && !finding.disposition && <Button disabled={pending || editing} onClick={() => { setRejectingId(rejectingId === finding.id ? null : finding.id); setRejectReason(""); }}>Record override</Button>}</div>
                {rejectingId === finding.id && <form className="lv-well mt-4 space-y-3 p-4" onSubmit={e => { e.preventDefault(); if (rejectReason.trim().length >= 3) void runAction(`reject-${finding.id}`, () => api.rejectFinding(brandId, detail.id, finding.id, rejectReason.trim()), "Override recorded with its reason. Sensitive findings retain their review route."); }}><label className="block"><span className="lv-label mb-2 block">Why does this finding not apply?</span><textarea className="lv-input min-h-20 text-xs" required minLength={3} maxLength={1000} value={rejectReason} disabled={pending} onChange={e => setRejectReason(e.target.value)}/></label><div className="flex gap-2"><Button type="submit" variant="primary" disabled={pending || rejectReason.trim().length < 3}>Save reason</Button><Button disabled={pending} onClick={() => setRejectingId(null)}>Cancel</Button></div></form>}
                {finding.is_claim && finding.evidence_status !== "supported" && <p className="lv-muted mt-3 text-[10px] leading-5"><Icon name="lock" size={11} className="mr-1 inline"/>Evidence blockers cannot be overridden. Revise the claim or add approved evidence.</p>}
              </div>
            </Panel>)}</div>}
          </section>
          <details className="lv-card p-5"><summary className="cursor-pointer font-display text-sm font-medium">Revision history <span className="lv-muted ml-2 font-mono text-xs">{detail.revisions.length}</span></summary><ol className="mt-5 space-y-4">{[...detail.revisions].reverse().map(revision => <li key={revision.id} className="flex items-start gap-3"><span className="lv-well flex h-8 w-8 shrink-0 items-center justify-center font-mono text-[10px]">v{revision.number}</span><div><p className="text-xs leading-5">{revision.note || "Draft revision"}</p><p className="lv-muted mt-1 text-[10px]">{revision.by} · {formatDate(revision.at)}</p></div></li>)}</ol></details>
        </>}
      </main>

      <aside className="space-y-5 md:col-span-2 xl:sticky xl:top-28 xl:col-span-1">
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-1">
          <Panel className="p-5">
            <div className="flex items-center justify-between gap-3"><h2 className="font-display text-sm font-semibold">Measured revision score</h2><Icon name="chart" size={17} className="lv-text-accent"/></div>
            <div className="mt-5 flex items-end gap-3"><span className={`font-display text-5xl font-medium tracking-[-0.05em] ${coverage == null ? "lv-muted" : coverage < 1 ? "lv-text-warning" : "lv-text-success"}`}>{percentage(coverage)}</span><span className="lv-muted mb-1 text-[11px]">current evidence<br/>coverage</span></div>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-well"><div className="h-full rounded-full bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 transition-all" style={{ width: coverage == null ? "0%" : `${coverage * 100}%` }}/></div>
            <p className="lv-muted mt-4 text-[11px] leading-5">{!detail ? "Select a draft to inspect measured results." : dirty ? "Unmeasured while the draft contains unsaved changes." : !hasAnalysis ? "Unmeasured: run checks on this revision." : !claims.length ? "Not scored: this check detected no claims." : `${supportedClaims.length} of ${claims.length} detected claims have supported status and a current passport.`}</p>
            <details className="lv-muted mt-3 text-[10px] leading-5"><summary className="cursor-pointer">How this is calculated</summary><p className="mt-2">Claims with API status “supported” and current evidence ÷ claims detected in this revision. This is evidence coverage, not a compliance or factual accuracy guarantee.</p></details>
            <div className="lv-divider mt-5 grid grid-cols-2 gap-3 border-t pt-4"><div><span className="lv-muted block text-[10px]">Approval blockers</span><strong className={`mt-1 block font-display text-xl ${measured && detail?.blockers.length ? "lv-text-danger" : ""}`}>{measured ? detail?.blockers.length : "—"}</strong></div><div><span className="lv-muted block text-[10px]">Review route</span><strong className="mt-2 block text-xs font-medium">{measured && detail?.computed_route ? `${detail.computed_route === "senior" ? "Senior" : "Standard"} review` : "Not measured"}</strong></div></div>
          </Panel>
          <Panel className="overflow-hidden">
            <div className="lv-divider border-b p-5"><div className="lv-eyebrow mb-2">Claim vs. evidence</div><h2 className="font-display text-base font-semibold">Five dimensions. One clear view.</h2></div>
            <div className="p-5">{activeFinding?.is_claim ? <>
              <div className="lv-muted mb-2 font-mono text-[9px] uppercase tracking-wider">Draft claim</div><blockquote className="mb-4 break-words text-xs leading-6">“{activeFinding.quote}”</blockquote>
              <div className="lv-muted mb-2 font-mono text-[9px] uppercase tracking-wider">Evidence excerpt</div><blockquote className="lv-well break-words p-3 text-xs leading-6">{passport ? `“${passport.excerpt}”` : "No evidence excerpt was returned for this claim."}</blockquote>
              <div className="mt-4 flex flex-wrap gap-2"><Badge tone={statusTone(activeFinding.evidence_status)}>{label(activeFinding.evidence_status || "needs review")}</Badge>{passport && <Badge tone={statusTone(passport.state)}>{label(passport.state)} passport</Badge>}</div>
            </> : <p className="lv-muted text-xs leading-6">Select a highlighted claim to compare the exact draft wording with the evidence returned by the API.</p>}
              <dl className="mt-5">{dimensions.map(dimension => <div key={dimension} className="lv-divider flex items-center justify-between gap-3 border-t py-3"><dt className="text-xs">{dimension}</dt><dd className="lv-muted font-mono text-[10px]">Not measured</dd></div>)}</dl>
              <p className="lv-muted mt-2 text-[10px] leading-5">The current API does not report dimension-level comparisons. A source quote alone does not verify these dimensions.</p>
            </div>
          </Panel>
        </div>
        <Panel className="p-5">
          <div className="mb-4 flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 font-display text-sm font-semibold"><Icon name="shield" size={16} className="lv-text-accent"/>Evidence Passport</h2>{passport && <span className="lv-text-accent font-mono text-xs">{passport.ref}</span>}</div>
          {passport ? <><Badge tone={statusTone(passport.state)}>{label(passport.state)}</Badge><p className="mt-4 text-sm font-medium">{passport.document.title}</p><p className="lv-muted mt-1 font-mono text-[10px]">v{passport.document.version} · page {passport.page}</p><dl className="mt-4 space-y-3 text-xs"><div className="flex justify-between gap-4"><dt className="lv-muted">Evidence owner</dt><dd className="text-right">{passport.owner}</dd></div><div className="flex justify-between gap-4"><dt className="lv-muted">Valid until</dt><dd>{formatDate(passport.valid_until)}</dd></div></dl>{passport.state !== "current" && <Notice tone="warning" className="mt-4 text-xs">This passport is not current. Its presence is not approval evidence.</Notice>}<Button variant="ghost" className="mt-4 w-full justify-between" disabled={pending} onClick={() => activeFinding && void openFindingSource(activeFinding)}>Read original source<Icon name="arrow" size={14}/></Button></> : <p className="lv-muted text-xs leading-6">A passport appears when the selected claim has a retrieved evidence record. Missing proof stays visible.</p>}
        </Panel>
        <Panel className="p-5">
          <div className="lv-eyebrow mb-3">The human checkpoint</div><h2 className="font-display text-lg font-semibold">Ready for another pair of eyes?</h2><p className="lv-muted mt-3 text-xs leading-6">Submitting requests a review. Approval is granted by the backend after a fresh check of this revision.</p>
          {detail?.blockers.length ? <details className="mt-4"><summary className="lv-text-warning cursor-pointer text-xs">{detail.blockers.length} approval blocker{detail.blockers.length === 1 ? "" : "s"}</summary><ul className="lv-muted mt-3 space-y-2 text-[11px] leading-5">{detail.blockers.map((blocker, index) => <li key={`${blocker.code}-${index}`}>{blocker.message}</li>)}</ul></details> : null}
          {detail?.can_edit && detail.status === "checked" ? <Button variant="primary" className="mt-5 w-full justify-center" disabled={pending || editing} onClick={() => void runAction("submit", () => api.submitDraft(brandId, detail.id), "Draft submitted for human sign-off.", next => onOpenQueue?.(next.id))}>{busy === "submit" ? "Submitting…" : onOpenQueue ? "Submit → switch to reviewer" : "Submit for review"}<Icon name="arrow" size={15}/></Button> : detail && ["in_review", "senior_review"].includes(detail.status) && onOpenQueue ? <Button variant="primary" className="mt-5 w-full justify-center" disabled={pending} onClick={() => onOpenQueue(detail.id)}>Open human review<Icon name="arrow" size={15}/></Button> : <p className="lv-muted mt-4 text-[10px] leading-5">{detail?.status === "approved" ? "This revision is approved. Editing creates a new revision and invalidates its earlier approval." : detail?.can_edit ? "Save changes and run checks before submitting." : "The draft author submits content for review."}</p>}
          {canApprove && detail && <form className="lv-divider mt-5 space-y-3 border-t pt-4" onSubmit={e => { e.preventDefault(); if (approvalComment.trim().length >= 3) void runAction("approve", () => api.approveDraft(brandId, detail.id, detail.revision_id, approvalComment.trim()), "The backend approved this revision and recorded the decision."); }}><label className="block"><span className="lv-label mb-2 block">Reviewer decision note</span><textarea className="lv-input min-h-20 text-xs" minLength={3} required disabled={pending} value={approvalComment} onChange={e => setApprovalComment(e.target.value)}/></label><Button type="submit" disabled={pending || editing || approvalComment.trim().length < 3} className="w-full justify-center"><Icon name="check" size={14}/>{busy === "approve" ? "Checking approval gate…" : "Record approval"}</Button></form>}
          {detail?.can_review && !canApprove && <Notice tone="warning" className="mt-4 text-xs">This route requires a senior reviewer.</Notice>}
        </Panel>
      </aside>
    </div>

    {showNew && <Modal title="Start a new draft" onClose={() => { if (!busy) setShowNew(false); }}><form className="space-y-4" onSubmit={e => { e.preventDefault(); if (newDraft.title.trim() && newDraft.text.trim()) void createDraft({ ...newDraft, title: newDraft.title.trim() }, false); }}><div className="grid gap-4 sm:grid-cols-2"><label><span className="lv-label mb-2 block">Draft title</span><input className="lv-input" required maxLength={200} value={newDraft.title} disabled={Boolean(busy)} onChange={e => setNewDraft(previous => ({ ...previous, title: e.target.value }))}/></label><label><span className="lv-label mb-2 block">Channel</span><input className="lv-input" list="draft-channel-options" maxLength={60} value={newDraft.channel} disabled={Boolean(busy)} onChange={e => setNewDraft(previous => ({ ...previous, channel: e.target.value }))}/><datalist id="draft-channel-options"><option value="Instagram"/><option value="Landing Page"/><option value="Investor Update"/><option value="Email"/></datalist></label></div><label className="block"><span className="lv-label mb-2 block">Content</span><textarea className="lv-input min-h-40" required maxLength={20000} value={newDraft.text} disabled={Boolean(busy)} onChange={e => setNewDraft(previous => ({ ...previous, text: e.target.value }))}/></label><div className="grid gap-4 sm:grid-cols-2">{([['audience', 'Audience'], ['purpose', 'Purpose'], ['cta', 'Call to action']] as const).map(([key, fieldLabel]) => <label className={key === "cta" ? "sm:col-span-2" : ""} key={key}><span className="lv-label mb-2 block">{fieldLabel} <span className="lv-muted">· optional</span></span><input className="lv-input" maxLength={300} value={newDraft[key]} disabled={Boolean(busy)} onChange={e => setNewDraft(previous => ({ ...previous, [key]: e.target.value }))}/></label>)}</div><div className="flex justify-end gap-2 pt-2"><Button disabled={Boolean(busy)} onClick={() => setShowNew(false)}>Cancel</Button><Button variant="primary" type="submit" disabled={Boolean(busy) || !newDraft.title.trim() || !newDraft.text.trim()}>{busy === "create" ? "Creating…" : "Create draft"}</Button></div></form></Modal>}
    {source && <SourceModal key={`${brandId}-${source.docId}-${source.page}`} brandId={brandId} docId={source.docId} initialPage={source.page} highlightExcerpt={source.excerpt} passport={source.passport} claimQuote={source.claimQuote} evidenceStatus={source.evidenceStatus} onClose={() => setSource(null)}/>}
    {ruleSource && <Modal title="Cited guideline wording" onClose={() => setRuleSource(null)}><Badge tone="accent">{ruleSource.rule?.key || ruleSource.category}{ruleSource.rule?.version ? ` · v${ruleSource.rule.version}` : ""}</Badge><blockquote className="lv-well mt-4 whitespace-pre-wrap p-5 text-sm leading-7">{ruleSource.source_excerpt || "No source excerpt was returned for this finding."}</blockquote><p className="lv-muted mt-4 text-xs leading-6">{ruleSource.source_ref || "No linked document was returned. This view shows the wording attached to the finding."}</p></Modal>}
  </div>;
};
