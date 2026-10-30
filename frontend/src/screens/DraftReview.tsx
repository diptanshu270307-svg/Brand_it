import React, { useEffect, useMemo, useRef, useState } from "react";
import { api, DraftDetail, DraftSummary, FindingItem, Passport, RuleItem } from "../api";
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
  Tone,
  errorText,
  formatDate,
  getIssueTier,
  percentage,
} from "../components/ui";

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
  { label: "40% downtime reduction", text: "Lumina reduces downtime by 40% for every customer." },
  { label: "Unqualified guarantee", text: "Lumina guarantees results for every team." },
  { label: "Unverified certification", text: "Lumina is certified for use in every country." },
];
const label = (value: string) => value.replace(/_/g, " ");
function statusTone(value?: string | null): Tone {
  if (["supported", "approved", "current"].includes(value || "")) return "success";
  if (["expired", "missing", "insufficient", "rejected", "critical", "high", "needs_revalidation"].includes(value || "")) return "danger";
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
    const tier = getIssueTier(finding);
    const borderColor = supported
      ? "border-emerald-400/70 bg-emerald-400/10"
      : tier === "must_fix"
      ? "border-rose-400/70 bg-rose-400/10"
      : tier === "needs_review"
      ? "border-amber-400/70 bg-amber-400/10"
      : "border-violet-400/70 bg-violet-400/10";

    nodes.push(
      <button
        key={finding.id}
        type="button"
        aria-pressed={active === finding.id}
        onClick={() => onSelect(finding.id)}
        title={`${finding.explanation} (${label(finding.severity)})`}
        className={`inline rounded-sm border-b-2 px-0.5 text-left text-inherit transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400 ${borderColor} ${
          active === finding.id ? "ring-2 ring-indigo-400/60" : ""
        }`}
      >
        {text.slice(finding.start, finding.end)}
      </button>
    );
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
    setError(""); setMessage(notice?.draftId === selectedDraftId ? notice.message : ""); setBusy(""); setRejectingId(null); setConfirmed({});
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

  const findingsWithTiers = useMemo(() => {
    return (detail?.findings || []).map(f => ({
      ...f,
      tier: getIssueTier(f),
    }));
  }, [detail]);

  const mustFixCount = useMemo(() => findingsWithTiers.filter(f => f.tier === "must_fix").length, [findingsWithTiers]);
  const needsReviewCount = useMemo(() => findingsWithTiers.filter(f => f.tier === "needs_review").length, [findingsWithTiers]);
  const suggestionCount = useMemo(() => findingsWithTiers.filter(f => f.tier === "suggestion").length, [findingsWithTiers]);

  const filtered = useMemo(() => {
    if (!findingsWithTiers.length) return [];
    if (filter === "all") return findingsWithTiers;
    if (filter === "must_fix") return findingsWithTiers.filter(f => f.tier === "must_fix");
    if (filter === "needs_review") return findingsWithTiers.filter(f => f.tier === "needs_review");
    if (filter === "suggestion") return findingsWithTiers.filter(f => f.tier === "suggestion");
    if (filter === "claims") return findingsWithTiers.filter(f => f.is_claim);
    return findingsWithTiers;
  }, [findingsWithTiers, filter]);

  const activeFinding = detail?.findings.find(f => f.id === activeFindingId) || detail?.findings.find(f => f.is_claim) || detail?.findings[0];
  const claims = detail?.findings.filter(f => f.is_claim) || [];
  const supportedClaims = claims.filter(f => f.evidence_status === "supported" && f.passport?.state === "current");
  const hasAnalysis = Boolean(detail?.analysis);
  const dirty = Boolean(detail && (editor.text !== detail.text || editor.audience !== detail.audience || editor.purpose !== detail.purpose || editor.cta !== detail.cta));
  const measured = hasAnalysis && !dirty;
  const coverage = measured && claims.length ? supportedClaims.length / claims.length : null;
  const canEdit = Boolean(detail?.can_edit);
  const canDispose = Boolean(detail && detail.status !== "approved" && (canEdit || role === "reviewer" || role === "senior_reviewer"));
  const passport = activeFinding?.passport;
  const actualNumbers = new Set(detail?.text.match(/\b\d+(?:[.,]\d+)*(?:%|x)?/g) || []);
  const pending = Boolean(busy) || detailLoading;

  return <div className="mx-auto max-w-[1680px] px-4 pb-16 pt-7 sm:px-6 lg:px-9">
    <StatusAnnouncer message={message || error || (busy ? "Processing request…" : null)} />
    <PageHeading
      eyebrow="Content Verification"
      title="Check content"
      description="Paste your marketing copy or social post, check it against brand rules and approved facts, and request approval before publishing."
      action={
        <Button variant="primary" disabled={pending} onClick={() => setShowNew(true)}>
          <Icon name="plus" size={16}/> Paste new content
        </Button>
      }
    />
    {error && <Notice tone="danger" className="mb-5 flex flex-wrap items-center justify-between gap-3"><span>{error}</span><Button variant="ghost" onClick={() => setLoadVersion(v => v + 1)} disabled={pending}><Icon name="refresh" size={14}/>Reload desk</Button></Notice>}
    {message && <Notice tone="accent" className="mb-5">{message}</Notice>}
    <div className="grid items-start gap-5 md:grid-cols-[230px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_300px] 2xl:grid-cols-[244px_minmax(0,1fr)_340px]">
      <aside className="space-y-5">
        <Panel className="overflow-hidden">
          <div className="lv-divider flex items-center justify-between border-b p-4">
            <h2 className="font-display text-sm font-semibold">Your drafts</h2>
            <span className="lv-muted font-mono text-xs">{drafts.length.toString().padStart(2, "0")}</span>
          </div>
          <div className="max-h-[390px] space-y-1 overflow-y-auto p-2 motion-stagger">
            {listLoading ? (
              <p className="lv-muted p-4 text-sm" role="status">Loading drafts…</p>
            ) : drafts.length ? (
              drafts.map(draft => (
                <button
                  key={draft.id}
                  type="button"
                  disabled={Boolean(busy)}
                  aria-current={draft.id === selectedDraftId ? "true" : undefined}
                  onClick={() => { if (draft.id !== selectedDraftId) onSelectDraft(draft.id); }}
                  className={`motion-interactive w-full rounded-xl border p-3 text-left transition disabled:opacity-50 ${draft.id === selectedDraftId ? "border-indigo-400/40 bg-indigo-400/10" : "border-transparent hover:bg-well"}`}
                >
                  <span className="mb-2 flex items-center gap-2">
                    <Icon name="file" size={15} className={draft.id === selectedDraftId ? "lv-text-accent" : "lv-muted"}/>
                    <span className="truncate text-sm font-medium">{draft.title}</span>
                  </span>
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="lv-muted text-[10px]">{draft.channel || "General"}</span>
                    <Badge tone={statusTone(draft.status)}>{label(draft.status)}</Badge>
                  </span>
                </button>
              ))
            ) : (
              <p className="lv-muted p-4 text-sm">Paste content above to begin.</p>
            )}
          </div>
        </Panel>
        <Panel className="p-4">
          <div className="mb-2 flex items-center gap-2">
            <Icon name="spark" className="lv-text-accent" size={17}/>
            <h2 className="font-display text-sm font-semibold">Quick claim check</h2>
          </div>
          <p className="lv-muted mb-3 text-xs leading-5">Paste a single claim or sentence to check it against brand proof.</p>
          <form onSubmit={e => { e.preventDefault(); if (quickText.trim()) void createDraft({ ...blankDraft, title: "Quick claim check", text: quickText.trim(), purpose: "Quick test of promotional claim" }, true); }}>
            <label className="sr-only" htmlFor="unfamiliar-claim">Paste claim</label>
            <textarea
              id="unfamiliar-claim"
              className="lv-input min-h-[100px] resize-y text-xs"
              placeholder="Paste any marketing claim here…"
              value={quickText}
              maxLength={20000}
              disabled={pending}
              onChange={e => setQuickText(e.target.value)}
            />
            <Button type="submit" variant="primary" className="mt-3 w-full justify-center" disabled={pending || !quickText.trim()}>
              <Icon name={busy === "test" ? "clock" : "arrow"} size={15}/>
              {busy === "test" ? "Checking claim…" : "Check this claim"}
            </Button>
          </form>
          <div className="mt-3 space-y-1.5">
            <span className="text-[10px] text-muted block">Try an example:</span>
            <div className="flex flex-wrap gap-1.5">
              {samples.map(sample => (
                <button
                  type="button"
                  key={sample.label}
                  disabled={pending}
                  onClick={() => setQuickText(sample.text)}
                  className="lv-well px-2 py-1 text-left text-[10px] transition hover:border-indigo-400/50 disabled:opacity-50 rounded"
                >
                  {sample.label}
                </button>
              ))}
            </div>
          </div>
        </Panel>
        <p className="lv-muted px-2 text-xs leading-5">
          <Icon name="lock" size={13} className="mr-1 inline"/>
          Every edit creates a tracked revision. Human approval is required for publication.
        </p>
      </aside>

      <main className="min-w-0 space-y-5">
        {detailLoading ? (
          <Panel className="flex min-h-96 items-center justify-center gap-3 p-8" role="status">
            <Icon name="clock" className="lv-text-accent"/>
            <span className="lv-muted text-sm">Opening content checker…</span>
          </Panel>
        ) : !detail ? (
          <Empty title="Ready to check your content">
            Choose a draft from the left, click "Paste new content", or test a quick claim.
          </Empty>
        ) : <>
          <Panel className="overflow-hidden">
            <div className="lv-divider flex flex-wrap items-start justify-between gap-4 border-b p-5 sm:p-6">
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap gap-2">
                  <Badge tone="accent">{detail.channel || "General"}</Badge>
                  <Badge tone={statusTone(detail.status)}>{label(detail.status)}</Badge>
                  <span className="lv-muted self-center font-mono text-[10px]">Revision {detail.revision}</span>
                </div>
                <h2 className="break-words font-display text-xl font-semibold tracking-tight">{detail.title}</h2>
                <p className="lv-muted mt-1.5 text-xs">Authored by {detail.author} · Last updated {formatDate(detail.updated_at)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {canEdit && !editing && (
                  <Button variant="ghost" disabled={pending} onClick={() => setEditing(true)}>
                    <Icon name="file" size={14}/>
                    {detail.status === "approved" ? "New revision" : "Edit draft"}
                  </Button>
                )}
                <Button
                  variant="primary"
                  disabled={pending || editing || detail.status === "approved"}
                  onClick={() => void runAction("check", () => api.checkDraft(brandId, detail.id), "Content checked against brand rules and approved facts.")}
                >
                  <Icon name={busy === "check" ? "clock" : "spark"} size={15}/>
                  {busy === "check" ? "Checking content…" : "Run content check"}
                </Button>
              </div>
            </div>
            <div className="p-5 sm:p-6">
              {dirty ? (
                <Notice tone="warning" className="mb-5 text-xs">
                  You have unsaved changes. Save this revision, then run checks to verify.
                </Notice>
              ) : !hasAnalysis ? (
                <Notice className="mb-5 text-xs">
                  This revision has not been checked yet. Click "Run content check" above to evaluate claims and brand rules.
                </Notice>
              ) : (
                <div className="lv-well mb-5 flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-xl">
                  <span className="flex items-center gap-2 text-xs">
                    <Icon name="review" size={14} className="lv-text-accent"/>
                    Checked revision {detail.revision}
                  </span>
                  <Badge tone={detail.analysis?.provider === "mock" ? "warning" : "accent"}>
                    {detail.analysis?.provider === "mock" ? "Offline verifier" : detail.analysis?.provider || "Live verifier"}
                  </Badge>
                </div>
              )}
              {editing ? (
                <form
                  onSubmit={e => {
                    e.preventDefault();
                    if (editor.text.trim()) void runAction("save", () => api.editDraft(brandId, detail.id, editor), "Revision saved. Run checks to verify the proposed changes.");
                  }}
                  className="space-y-4"
                >
                  <label className="block">
                    <span className="lv-label mb-2 block">Content to check</span>
                    <textarea
                      className="lv-input min-h-[240px] resize-y text-sm leading-7"
                      value={editor.text}
                      maxLength={20000}
                      required
                      disabled={pending}
                      onChange={e => setEditor(previous => ({ ...previous, text: e.target.value }))}
                    />
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {([['audience', 'Target audience'], ['purpose', 'Campaign purpose'], ['cta', 'Call to action']] as const).map(([key, fieldLabel]) => (
                      <label key={key} className={key === "cta" ? "sm:col-span-2" : ""}>
                        <span className="lv-label mb-2 block">{fieldLabel}</span>
                        <input
                          className="lv-input"
                          value={editor[key]}
                          maxLength={300}
                          disabled={pending}
                          onChange={e => setEditor(previous => ({ ...previous, [key]: e.target.value }))}
                        />
                      </label>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="primary" type="submit" disabled={pending || !dirty || !editor.text.trim()}>
                      {busy === "save" ? "Saving revision…" : "Save revision"}
                    </Button>
                    <Button
                      disabled={pending}
                      onClick={() => {
                        setEditing(false);
                        setEditor({ text: detail.text, audience: detail.audience, purpose: detail.purpose, cta: detail.cta });
                      }}
                    >
                      Cancel changes
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="min-h-[160px] py-2">
                  <HighlightedDraft text={detail.text} findings={detail.findings} active={activeFindingId} onSelect={setActiveFindingId}/>
                </div>
              )}
              <div className="lv-divider mt-6 flex flex-wrap items-center gap-2 border-t pt-4">
                <span className="lv-muted mr-1 text-[10px] uppercase tracking-wider">Guardrails</span>
                {actualNumbers.size > 0 && <Badge><Icon name="lock" size={11}/>{actualNumbers.size} numeric claim{actualNumbers.size === 1 ? "" : "s"}</Badge>}
                {detail.cta && <Badge><Icon name="lock" size={11}/>CTA: {detail.cta}</Badge>}
                {detail.findings.some(f => f.category === "legal") && <Badge tone="warning">Legal rule findings</Badge>}
              </div>
              {detail.analysis?.notes.map((note, index) => (
                <Notice key={index} tone="warning" className="mt-4 text-xs leading-5">{note}</Notice>
              ))}
            </div>
          </Panel>

          <section aria-labelledby="findings-heading" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 id="findings-heading" className="font-display text-lg font-semibold">
                  Issues & Suggestions <span className="lv-muted ml-1 font-mono text-xs">({detail.findings.length})</span>
                </h2>
                <p className="text-xs text-muted mt-0.5">Categorized by priority: Must fix, Needs review, and Suggestions.</p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setFilter("all")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
                    filter === "all" ? "bg-violet-500/20 text-ink border-violet-400/40" : "bg-well text-muted border-line/50 hover:text-ink"
                  }`}
                >
                  All ({detail.findings.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilter("must_fix")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition flex items-center gap-1.5 ${
                    filter === "must_fix" ? "bg-rose-500/20 text-rose-300 border-rose-500/40" : "bg-well text-muted border-line/50 hover:text-ink"
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                  Must fix ({mustFixCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFilter("needs_review")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition flex items-center gap-1.5 ${
                    filter === "needs_review" ? "bg-amber-500/20 text-amber-300 border-amber-500/40" : "bg-well text-muted border-line/50 hover:text-ink"
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  Needs review ({needsReviewCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFilter("suggestion")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition flex items-center gap-1.5 ${
                    filter === "suggestion" ? "bg-violet-500/20 text-violet-300 border-violet-500/40" : "bg-well text-muted border-line/50 hover:text-ink"
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                  Suggestions ({suggestionCount})
                </button>
              </div>
            </div>

            {!hasAnalysis ? (
              <Empty title="Ready for check">
                Click "Run content check" above to evaluate this content against your brand rules.
              </Empty>
            ) : !filtered.length ? (
              <Empty title={detail.findings.length ? "No issues in this filter" : "No issues detected"}>
                {detail.findings.length
                  ? "Choose another filter above to see remaining items."
                  : "All claims are supported and brand rules are satisfied. You may now request team approval."}
              </Empty>
            ) : (
              <div className="space-y-4 motion-stagger">
                {filtered.map(finding => (
                  <Panel
                    key={finding.id}
                    className={`overflow-hidden transition ${finding.id === activeFindingId ? "ring-1 ring-indigo-400/60" : ""}`}
                  >
                    <div className="p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <IssueBadge tier={finding.tier} />
                          <span className="text-xs text-muted font-medium">
                            {finding.is_claim ? "Claim verification" : `${label(finding.category)} guideline`}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={statusTone(finding.evidence_status || finding.severity)}>
                            {label(finding.evidence_status || finding.severity)}
                          </Badge>
                          {finding.disposition && (
                            <Badge tone="neutral">
                              {finding.disposition.action === "rejected" ? "Override recorded" : "Fix applied"}
                            </Badge>
                          )}
                        </div>
                      </div>

                      <p className="mt-3 text-sm leading-6 text-ink">{finding.explanation}</p>

                      {finding.suggestion ? (
                        <>
                          <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            <div className="lv-well motion-diff-card min-w-0 p-3.5 rounded-xl border-line/60">
                              <div className="lv-text-danger mb-1.5 font-mono text-[10px] uppercase tracking-wider flex items-center justify-between">
                                <span>Saved draft text</span>
                                <span className="text-[10px] text-muted font-normal">Original</span>
                              </div>
                              <p className="whitespace-pre-wrap break-words text-sm leading-6">
                                {finding.suggestion.original}
                              </p>
                            </div>
                            <div className="lv-well motion-diff-card min-w-0 border-indigo-400/30 p-3.5 rounded-xl bg-indigo-500/5">
                              <div className="lv-text-accent mb-1.5 font-mono text-[10px] uppercase tracking-wider flex items-center justify-between">
                                <span>Proposed rewrite</span>
                                <span className="text-[10px] text-indigo-400/80 font-normal">Rechecked</span>
                              </div>
                              <p className="whitespace-pre-wrap break-words text-sm leading-6">
                                {finding.suggestion.replacement}
                              </p>
                            </div>
                          </div>

                          {finding.suggestion.protected_flags.length > 0 && (
                            <Notice tone="warning" className="mt-4 text-xs">
                              <strong className="block font-medium">This change modifies protected brand terms:</strong>
                              <ul className="mt-1 list-inside list-disc space-y-0.5">
                                {finding.suggestion.protected_flags.map((flag, index) => (
                                  <li key={index}>{flag}</li>
                                ))}
                              </ul>
                              <label className="mt-2.5 flex cursor-pointer items-start gap-2">
                                <input
                                  type="checkbox"
                                  className="mt-0.5 accent-indigo-400"
                                  checked={Boolean(confirmed[finding.id])}
                                  disabled={pending || !canEdit}
                                  onChange={e => setConfirmed(previous => ({ ...previous, [finding.id]: e.target.checked }))}
                                />
                                <span>I have reviewed these specific changes and confirm applying them.</span>
                              </label>
                            </Notice>
                          )}
                        </>
                      ) : (
                        <blockquote className="lv-well mt-3.5 whitespace-pre-wrap break-words p-3.5 text-sm leading-6 rounded-xl">
                          “{finding.quote}”
                        </blockquote>
                      )}

                      {finding.is_claim && (
                        <div className="mt-3.5 space-y-2.5">
                          <div className="p-3 rounded-xl border border-line/60 bg-surface/40 flex flex-wrap items-center justify-between gap-3 text-xs">
                            <div>
                              <span className="font-medium text-ink block">Evidence Passport</span>
                              <span className="text-muted text-[11px]">The approved source behind this claim</span>
                            </div>
                            {finding.passport ? (
                              <Button
                                variant="ghost"
                                disabled={pending}
                                onClick={() => { setActiveFindingId(finding.id); void openFindingSource(finding); }}
                                className="!h-8 !px-2.5 !text-xs"
                              >
                                <Icon name="book" size={13}/>
                                Inspect approved source ({finding.passport.ref})
                              </Button>
                            ) : (
                              <span className="text-rose-400 text-xs flex items-center gap-1">
                                <Icon name="alert" size={12}/> No approved source on file
                              </span>
                            )}
                          </div>

                          {/* 5-Dimensional Verification Card */}
                          {finding.dimensions && Object.keys(finding.dimensions).length > 0 && (
                            <div className="rounded-xl border border-line/60 bg-well/70 p-3.5 space-y-2.5">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-ink flex items-center gap-1.5">
                                  <Icon name="shield" size={14} className="lv-text-accent" />
                                  5-Dimensional Verification
                                </span>
                                {finding.uncertainty && (
                                  <span className="text-[10px] text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20 font-medium">
                                    Requires review
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-muted leading-4">
                                Matching numbers or quotes is not sufficient. All 5 dimensions must align with approved proof.
                              </p>
                              <div className="grid gap-2 sm:grid-cols-2">
                                {(["product", "metric", "population", "timeframe", "qualifiers"] as const).map(dimKey => {
                                  const dim = finding.dimensions?.[dimKey];
                                  if (!dim) return null;
                                  const isSupp = dim.status === "supported";
                                  const isMis = dim.status === "mismatch";
                                  return (
                                    <div key={dimKey} className={`rounded-lg border p-2.5 text-[11px] ${
                                      isSupp ? "border-emerald-500/20 bg-emerald-500/5" : isMis ? "border-rose-500/30 bg-rose-500/5" : "border-line/40 bg-surface/30"
                                    }`}>
                                      <div className="flex items-center justify-between mb-1">
                                        <span className="font-semibold capitalize text-ink">{dimKey}</span>
                                        <Badge tone={isSupp ? "success" : isMis ? "danger" : "neutral"}>
                                          {isSupp ? "Verified" : isMis ? "Mismatch" : "Unstated"}
                                        </Badge>
                                      </div>
                                      <div className="space-y-0.5 text-muted text-[10px]">
                                        <div className="truncate"><span className="uppercase text-muted/60 font-mono">Draft:</span> {dim.claim || "—"}</div>
                                        <div className="truncate"><span className="uppercase text-muted/60 font-mono">Source:</span> {dim.evidence || "—"}</div>
                                      </div>
                                      {dim.note && (
                                        <div className={`mt-1 text-[10px] leading-tight ${isSupp ? "text-emerald-400/90" : "text-rose-400 font-medium"}`}>
                                          {dim.note}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                              {finding.uncertainty && (
                                <div className="text-[11px] text-amber-300/90 border-t border-amber-500/20 pt-2 flex items-start gap-1.5">
                                  <Icon name="alert" size={13} className="shrink-0 mt-0.5" />
                                  <span><strong>Uncertainty:</strong> {finding.uncertainty}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Expandable Technical Audit Details */}
                      <div className="mt-4">
                        <ExpandableDetails title="Technical details & rule versions">
                          <div>Rule Key: <code className="text-ink">{finding.rule?.key || "N/A"}</code> (Version: {finding.rule?.version ?? "?"})</div>
                          <div>Category: <span className="capitalize">{finding.category}</span></div>
                          <div>Backend Severity: <span className="font-semibold text-ink">{finding.severity}</span></div>
                          <div>Origin: <span>{finding.origin}</span></div>
                          <div>Fingerprint: <code className="text-[10px]">{finding.fingerprint || finding.id}</code></div>
                        </ExpandableDetails>
                      </div>

                      {finding.disposition?.reason && (
                        <p className="lv-muted mt-3 text-xs leading-5">
                          <span className="font-medium text-ink">{finding.disposition.by}:</span> {finding.disposition.reason}
                        </p>
                      )}

                      <div className="mt-4 flex flex-wrap gap-2 pt-2 border-t border-line/40">
                        {!finding.is_claim && (
                          <Button
                            variant="ghost"
                            disabled={pending}
                            onClick={() => { setActiveFindingId(finding.id); void openFindingSource(finding); }}
                          >
                            <Icon name="book" size={14}/> Inspect source
                          </Button>
                        )}
                        {finding.suggestion && (
                          <Button
                            variant="primary"
                            disabled={pending || !canEdit || editing || (finding.suggestion.requires_confirmation && !confirmed[finding.id])}
                            onClick={() => void runAction(`fix-${finding.id}`, () => api.acceptFinding(brandId, detail.id, finding.id, Boolean(confirmed[finding.id])), "Suggestion applied to a new revision. Content rechecked.")}
                          >
                            <Icon name="check" size={14}/>
                            {busy === `fix-${finding.id}` ? "Applying fix…" : "Apply suggestion & recheck"}
                          </Button>
                        )}
                        {!finding.is_claim && canDispose && !finding.disposition && (
                          <Button
                            disabled={pending || editing}
                            onClick={() => {
                              setRejectingId(rejectingId === finding.id ? null : finding.id);
                              setRejectReason("");
                            }}
                          >
                            Record override
                          </Button>
                        )}
                      </div>

                      {rejectingId === finding.id && (
                        <form
                          className="lv-well mt-4 space-y-3 p-4 rounded-xl"
                          onSubmit={e => {
                            e.preventDefault();
                            if (rejectReason.trim().length >= 3) {
                              void runAction(`reject-${finding.id}`, () => api.rejectFinding(brandId, detail.id, finding.id, rejectReason.trim()), "Override recorded with rationale.");
                            }
                          }}
                        >
                          <label className="block">
                            <span className="lv-label mb-2 block">Why does this finding not apply?</span>
                            <textarea
                              className="lv-input min-h-20 text-xs"
                              required
                              minLength={3}
                              maxLength={1000}
                              value={rejectReason}
                              disabled={pending}
                              placeholder="Provide a reason for the override audit trail…"
                              onChange={e => setRejectReason(e.target.value)}
                            />
                          </label>
                          <div className="flex gap-2">
                            <Button type="submit" variant="primary" disabled={pending || rejectReason.trim().length < 3}>
                              Save reason
                            </Button>
                            <Button disabled={pending} onClick={() => setRejectingId(null)}>
                              Cancel
                            </Button>
                          </div>
                        </form>
                      )}

                      {finding.is_claim && finding.evidence_status !== "supported" && (
                        <p className="lv-muted mt-3 text-[11px] leading-5 text-amber-400/90">
                          <Icon name="lock" size={12} className="mr-1 inline"/>
                          Evidence blockers cannot be bypassed. Update the claim or register an approved source in Approved Facts.
                        </p>
                      )}
                    </div>
                  </Panel>
                ))}
              </div>
            )}
          </section>

          <details className="lv-card p-5 rounded-2xl">
            <summary className="cursor-pointer font-display text-sm font-medium">
              Revision history <span className="lv-muted ml-2 font-mono text-xs">({detail.revisions.length} revisions)</span>
            </summary>
            <ol className="mt-4 space-y-3 border-t border-line/40 pt-4">
              {[...detail.revisions].reverse().map(revision => (
                <li key={revision.id} className="flex items-start gap-3 text-xs">
                  <span className="lv-well flex h-7 w-7 shrink-0 items-center justify-center font-mono text-[10px] rounded-lg">
                    v{revision.number}
                  </span>
                  <div>
                    <p className="leading-5 text-ink">{revision.note || "Draft revision"}</p>
                    <p className="lv-muted mt-0.5 text-[10px]">{revision.by} · {formatDate(revision.at)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </details>
        </>}
      </main>

      <aside className="space-y-5 md:col-span-2 xl:sticky xl:top-24 xl:col-span-1">
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-1">
          <Panel className="p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-sm font-semibold">Claim evidence coverage</h2>
              <Icon name="chart" size={17} className="lv-text-accent"/>
            </div>
            <div className="mt-4 flex items-end gap-3">
              <span className={`font-display text-4xl font-semibold tracking-tight ${coverage == null ? "lv-muted" : coverage < 1 ? "lv-text-warning" : "lv-text-success"}`}>
                {percentage(coverage)}
              </span>
              <span className="lv-muted mb-1 text-[11px]">
                {measured ? `${supportedClaims.length}/${claims.length} claims verified` : "unmeasured"}
              </span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-well">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 transition-all"
                style={{ width: coverage == null ? "0%" : `${coverage * 100}%` }}
              />
            </div>
            <div className="mt-3 rounded-lg border border-line/40 bg-surface/50 p-2.5 space-y-1 text-[11px] text-muted">
              <div><strong className="text-ink">Formula:</strong> <code className="text-[10px]">supported_claims / detected_claims</code></div>
              <div><strong className="text-ink">Sample size:</strong> <code>n = {measured ? `${supportedClaims.length} / ${claims.length}` : "0"}</code> (revision {detail?.revision ?? 0})</div>
            </div>
            <p className="lv-muted mt-2 text-[11px] leading-5">
              {!detail
                ? "Select a draft to inspect proof coverage."
                : dirty
                ? "Unmeasured while draft has unsaved changes. Save and recheck to update."
                : !hasAnalysis
                ? "Unmeasured: run content check to evaluate claims."
                : !claims.length
                ? "No promotional claims detected in this revision."
                : `${supportedClaims.length} of ${claims.length} claims backed by current approved evidence.`}
            </p>
            <div className="lv-divider mt-4 grid grid-cols-2 gap-3 border-t pt-3">
              <div>
                <span className="lv-muted block text-[10px]">Must-fix blockers</span>
                <strong className={`mt-0.5 block font-display text-lg ${measured && detail?.blockers.length ? "lv-text-danger" : ""}`}>
                  {measured ? detail?.blockers.length : "—"}
                </strong>
              </div>
              <div>
                <span className="lv-muted block text-[10px]">Review route</span>
                <strong className="mt-1 block text-xs font-medium">
                  {measured && detail?.computed_route ? `${detail.computed_route === "senior" ? "Senior" : "Standard"} review` : "Standard"}
                </strong>
              </div>
            </div>
          </Panel>

          <Panel className="p-5">
            <div className="mb-1 flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 font-display text-sm font-semibold">
                <Icon name="shield" size={16} className="lv-text-accent"/>
                Evidence Passport
              </h2>
              {passport && <span className="lv-text-accent font-mono text-xs">{passport.ref}</span>}
            </div>
            <p className="text-[11px] text-muted mb-3">The approved source behind this claim</p>
            {passport ? (
              <>
                <Badge tone={statusTone(passport.state)}>{label(passport.state)}</Badge>
                <p className="mt-3 text-sm font-medium text-ink">{passport.document.title}</p>
                <p className="lv-muted mt-0.5 font-mono text-[10px]">v{passport.document.version} · page {passport.page}</p>
                <blockquote className="lv-well my-3 p-2.5 text-xs italic text-muted rounded-lg border-line/50">
                  “{passport.excerpt}”
                </blockquote>
                <dl className="mt-3 space-y-2 text-xs">
                  <div className="flex justify-between gap-4">
                    <dt className="lv-muted">Source owner</dt>
                    <dd className="text-right text-ink">{passport.owner}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="lv-muted">Valid until</dt>
                    <dd className="text-ink">{formatDate(passport.valid_until)}</dd>
                  </div>
                </dl>
                {activeFinding?.dimensions && Object.keys(activeFinding.dimensions).length > 0 && (
                  <div className="mt-3 pt-3 border-t border-line/40 space-y-1.5">
                    <span className="text-[11px] font-semibold text-ink block">5-Dimension Claim Audit</span>
                    {(["product", "metric", "population", "timeframe", "qualifiers"] as const).map(k => {
                      const d = activeFinding.dimensions?.[k];
                      if (!d) return null;
                      return (
                        <div key={k} className="flex items-center justify-between text-[10px]">
                          <span className="capitalize text-muted">{k}</span>
                          <span className={d.status === "supported" ? "text-emerald-400 font-medium" : d.status === "mismatch" ? "text-rose-400 font-medium" : "text-muted"}>
                            {d.status === "supported" ? "✓ Verified" : d.status === "mismatch" ? "✕ Mismatch" : "— Unstated"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
                {passport.state !== "current" && (
                  <Notice tone="warning" className="mt-3 text-xs">
                    This source is not current. An active, approved source is required.
                  </Notice>
                )}
                <Button
                  variant="ghost"
                  className="mt-3 w-full justify-between !text-xs"
                  disabled={pending}
                  onClick={() => activeFinding && void openFindingSource(activeFinding)}
                >
                  Read original source document <Icon name="arrow" size={13}/>
                </Button>
              </>
            ) : (
              <p className="lv-muted text-xs leading-5">
                Select a highlighted claim to inspect its approved source document, version, and validity dates.
              </p>
            )}
          </Panel>
        </div>

        <Panel className="p-5">
          <div className="lv-eyebrow mb-1">Human Sign-Off</div>
          <h2 className="font-display text-base font-semibold">Request approval</h2>
          <p className="lv-muted mt-1.5 text-xs leading-5">
            When all issues are resolved, submit this draft for independent reviewer sign-off.
          </p>

          {(detail?.validity_status === "needs_revalidation" || detail?.status === "needs_revalidation") && (
            <Notice tone="danger" className="mt-3 text-xs">
              <div className="font-semibold text-rose-300">Evidence Recall · Needs revalidation</div>
              <p className="mt-1 text-ink">{detail?.recall_reason || "Cited evidence or rules have changed."}</p>
              <p className="mt-1 text-muted text-[11px]">
                Historical approval for revision {detail?.approved_revision_id || detail?.revision} is preserved in audit trail, but current publication validity is suspended. Edit or re-check to revalidate.
              </p>
            </Notice>
          )}

          {detail?.blockers.length ? (
            <details className="mt-3" open>
              <summary className="lv-text-warning cursor-pointer text-xs font-medium">
                {detail.blockers.length} approval blocker{detail.blockers.length === 1 ? "" : "s"} remaining
              </summary>
              <ul className="mt-2 space-y-2 text-xs">
                {detail.blockers.map((blocker, index) => (
                  <li key={`${blocker.code}-${index}`} className="rounded border border-amber-500/20 bg-amber-500/[0.05] p-2 text-[11px] leading-4 text-ink">
                    <div className="font-medium text-amber-300">{blocker.message}</div>
                    {blocker.who_can_resolve && (
                      <div className="mt-1 text-muted"><strong className="text-ink">Resolution:</strong> {blocker.who_can_resolve}</div>
                    )}
                    {blocker.next_step && (
                      <div className="mt-0.5 text-muted"><strong className="text-ink">Next step:</strong> {blocker.next_step}</div>
                    )}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}

          {detail && ["in_review", "senior_review"].includes(detail.status) && (
            <Notice tone="accent" className="mt-3 text-xs">
              <div className="font-semibold text-ink">Submitted for review (Pending sign-off)</div>
              <p className="mt-1 text-muted leading-5">
                This draft has been submitted for independent human review and is <strong>not approved</strong> for publication until signed off.
              </p>
              {detail.assigned_reviewer && (
                <p className="mt-1.5 text-xs text-ink">
                  Assigned Reviewer: <strong>{detail.assigned_reviewer.name}</strong>
                </p>
              )}
            </Notice>
          )}

          {detail?.can_edit && detail.status === "checked" ? (
            <Button
              variant="primary"
              className="mt-4 w-full justify-center"
              disabled={pending || editing}
              onClick={() => void runAction("submit", () => api.submitDraft(brandId, detail.id), "Draft submitted for human approval.", next => onOpenQueue?.(next.id))}
            >
              <Icon name="arrow" size={15}/>
              {busy === "submit" ? "Submitting request…" : "Submit for team approval"}
            </Button>
          ) : detail && ["in_review", "senior_review"].includes(detail.status) && onOpenQueue ? (
            <Button
              variant="primary"
              className="mt-4 w-full justify-center"
              disabled={pending}
              onClick={() => onOpenQueue(detail.id)}
            >
              <Icon name="arrow" size={15}/>
              Open in Approvals queue
            </Button>
          ) : (
            <p className="lv-muted mt-3 text-[11px] leading-5">
              {detail?.status === "approved"
                ? "This revision is approved. Editing creates a new revision for review."
                : detail?.status === "needs_revalidation"
                ? "Content requires revalidation. Edit draft to create a new revision or re-check in Approvals."
                : detail?.can_edit
                ? "Run content checks before submitting for approval."
                : "The draft author submits content for review."}
            </p>
          )}
        </Panel>
      </aside>
    </div>

    {showNew && (
      <Modal title="Paste content to check" onClose={() => { if (!busy) setShowNew(false); }}>
        <form
          className="space-y-4"
          onSubmit={e => {
            e.preventDefault();
            if (newDraft.title.trim() && newDraft.text.trim()) {
              void createDraft({ ...newDraft, title: newDraft.title.trim() }, true);
            }
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className="lv-label mb-1.5 block">Content title</span>
              <input
                className="lv-input"
                required
                maxLength={200}
                placeholder="e.g. Summer product launch post"
                value={newDraft.title}
                disabled={Boolean(busy)}
                onChange={e => setNewDraft(previous => ({ ...previous, title: e.target.value }))}
              />
            </label>
            <label>
              <span className="lv-label mb-1.5 block">Target channel</span>
              <input
                className="lv-input"
                list="draft-channel-options"
                maxLength={60}
                placeholder="Instagram, Website, Email…"
                value={newDraft.channel}
                disabled={Boolean(busy)}
                onChange={e => setNewDraft(previous => ({ ...previous, channel: e.target.value }))}
              />
              <datalist id="draft-channel-options">
                <option value="Instagram"/>
                <option value="Landing Page"/>
                <option value="Investor Update"/>
                <option value="Email"/>
              </datalist>
            </label>
          </div>
          <label className="block">
            <span className="lv-label mb-1.5 block">Content text</span>
            <textarea
              className="lv-input min-h-40"
              required
              maxLength={20000}
              placeholder="Paste your marketing text, post, or announcement here…"
              value={newDraft.text}
              disabled={Boolean(busy)}
              onChange={e => setNewDraft(previous => ({ ...previous, text: e.target.value }))}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            {([['audience', 'Target audience'], ['purpose', 'Campaign goal'], ['cta', 'Call to action']] as const).map(([key, fieldLabel]) => (
              <label className={key === "cta" ? "sm:col-span-2" : ""} key={key}>
                <span className="lv-label mb-1.5 block">{fieldLabel} <span className="lv-muted">· optional</span></span>
                <input
                  className="lv-input"
                  maxLength={300}
                  value={newDraft[key]}
                  disabled={Boolean(busy)}
                  onChange={e => setNewDraft(previous => ({ ...previous, [key]: e.target.value }))}
                />
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-line/40">
            <Button disabled={Boolean(busy)} onClick={() => setShowNew(false)}>Cancel</Button>
            <Button variant="primary" type="submit" disabled={Boolean(busy) || !newDraft.title.trim() || !newDraft.text.trim()}>
              <Icon name="spark" size={14}/>
              {busy === "create" ? "Checking content…" : "Start check"}
            </Button>
          </div>
        </form>
      </Modal>
    )}
    {source && (
      <SourceModal
        key={`${brandId}-${source.docId}-${source.page}`}
        brandId={brandId}
        docId={source.docId}
        initialPage={source.page}
        highlightExcerpt={source.excerpt}
        passport={source.passport}
        claimQuote={source.claimQuote}
        evidenceStatus={source.evidenceStatus}
        onClose={() => setSource(null)}
      />
    )}
    {ruleSource && (
      <Modal title="Cited brand rule" onClose={() => setRuleSource(null)}>
        <Badge tone="accent">
          {ruleSource.rule?.key || ruleSource.category}
          {ruleSource.rule?.version ? ` · v${ruleSource.rule.version}` : ""}
        </Badge>
        <blockquote className="lv-well mt-4 whitespace-pre-wrap p-5 text-sm leading-7">
          {ruleSource.source_excerpt || "No source excerpt was returned for this finding."}
        </blockquote>
        <p className="lv-muted mt-4 text-xs leading-6">
          {ruleSource.source_ref || "This view shows the rule wording attached to this finding."}
        </p>
      </Modal>
    )}
  </div>;
};
