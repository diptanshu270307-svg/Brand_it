import React, { useEffect, useState } from "react";
import { api, EvaluationData, GuidelineHealthItem, InsightsData, PrivacyInfo } from "../api";
import { Badge, Button, Empty, errorText, Icon, Metric, Notice, PageHeading, Panel, percentage } from "../components/ui";

interface Props { brandId: number; role: string }
const CHANNELS = ["Instagram", "Landing Page", "Investor Update"];

export const Insights: React.FC<Props> = ({ brandId, role }) => {
  const [data, setData] = useState<InsightsData | null>(null);
  const [evaluation, setEvaluation] = useState<EvaluationData | null>(null);
  const [privacy, setPrivacy] = useState<PrivacyInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [error, setError] = useState("");
  const [evalError, setEvalError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");
  const [selected, setSelected] = useState("");
  const [edited, setEdited] = useState<Record<number, string>>({});
  const [channels, setChannels] = useState<Record<string, string[]>>({});
  const [showCases, setShowCases] = useState(false);
  const isOwner = role === "brand_owner";
  const canSuggest = ["brand_owner", "reviewer", "senior_reviewer"].includes(role);
  const refresh = async () => {
    const next = await api.getInsights(brandId);
    setData(next);
    setSelected(current => next.health.some(h => h.rule_key === current) ? current : next.health[0]?.rule_key || "");
    setEdited(current => { const updated = { ...current }; next.health.forEach(h => { if (h.proposal && updated[h.proposal.id] === undefined) updated[h.proposal.id] = h.proposal.proposed_text; }); return updated; });
  };
  useEffect(() => {
    let active = true;
    setLoading(true); setError(""); setEvalError(""); setData(null); setEvaluation(null); setEdited({}); setChannels({});
    Promise.allSettled([api.getInsights(brandId), api.me()]).then(([ins, me]) => {
      if (!active) return;
      if (ins.status === "fulfilled") { setData(ins.value); setSelected(ins.value.health[0]?.rule_key || ""); } else setError(errorText(ins.reason));
      if (me.status === "fulfilled") setPrivacy(me.value.privacy);
      setLoading(false);
    });
    return () => { active = false; };
  }, [brandId, role]);
  const runEvaluation = async () => {
    setEvaluating(true); setEvalError("");
    try { const [result, me] = await Promise.all([api.getEvaluation(brandId), api.me()]); setEvaluation(result); setPrivacy(me.privacy); }
    catch (e) { setEvalError(errorText(e)); } finally { setEvaluating(false); }
  };
  const suggest = async (h: GuidelineHealthItem) => {
    setBusy(h.rule_key); setError(""); setMessage("");
    try { const p = await api.suggestWording(brandId, h.rule_key); setEdited(current => ({ ...current, [p.id]: p.proposed_text })); await refresh(); setMessage(`A clarification for ${h.rule_key} is ready for review. The active rule has not changed.`); }
    catch (e) { setError(errorText(e)); } finally { setBusy(""); }
  };
  const decide = async (h: GuidelineHealthItem, decision: "approve" | "reject") => {
    if (!h.proposal) return;
    setBusy(h.rule_key); setError(""); setMessage("");
    try { await api.decideProposal(brandId, h.proposal.id, decision, edited[h.proposal.id] ?? h.proposal.proposed_text); await refresh(); setMessage(decision === "approve" ? `Published a new wording version for ${h.rule_key}. Existing deterministic matching conditions are retained by this backend.` : `The proposed wording for ${h.rule_key} was rejected.`); }
    catch (e) { setError(errorText(e)); } finally { setBusy(""); }
  };
  const rule = data?.health.find(h => h.rule_key === selected);
  const selectedChannels = rule ? channels[rule.rule_key] || [] : [];
  const appendConditions = () => {
    if (!rule?.proposal || !selectedChannels.length) return;
    const p = rule.proposal;
    const addition = `Channel guidance for brand-owner review: casual greetings may be considered for ${selectedChannels.join(", ")}; keep other channel requirements unchanged.`;
    setEdited(current => ({ ...current, [p.id]: `${current[p.id] ?? p.proposed_text}\n\n${addition}` }));
  };
  return <div className="space-y-8">
    <PageHeading eyebrow="Governance / Learn from review" title="Guidelines that get clearer." description="Turn reviewer disagreements into considered rule revisions. Keep every change visible, versioned, and under human control." action={<Badge tone="accent"><Icon name="chart" size={13}/> Rule evolution studio</Badge>}/>
    {error && <Notice tone="danger">{error}</Notice>}{message && <Notice tone="success">{message}</Notice>}
    <div className="grid gap-4 sm:grid-cols-3">
      <Metric label="Rules with review feedback" value={loading ? "—" : data?.health.length ?? "—"} note="Rules represented in the returned review history"/>
      <Metric label="Live overrides" value={loading ? "—" : data?.health.reduce((sum, h) => sum + h.live_overrides, 0) ?? "—"} note="Human decisions from real review activity" tone="warning"/>
      <Metric label="Sample overrides" value={loading ? "—" : data?.health.reduce((sum, h) => sum + h.seeded_overrides, 0) ?? "—"} note="Seeded demo history, labelled separately"/>
    </div>
    {loading ? <Panel className="p-8"><p className="lv-muted" role="status">Loading rule feedback…</p></Panel> : data && <>
      <div className="flex flex-wrap items-center gap-3"><span className="lv-eyebrow">01 / Rule evolution</span><div className="lv-divider grow border-t"/><Badge>Human approval required</Badge></div>
      <Notice>{data.note} Health is aggregated by rule key across recorded versions; this backend does not provide isolated per-version measurements.</Notice>
      <div className="grid items-start gap-5 lg:grid-cols-[270px_minmax(0,1fr)]">
        <Panel className="p-3"><div className="lv-kicker px-3 py-3">Review signals</div><div className="space-y-1">{data.health.map(h => <button type="button" key={h.rule_key} aria-pressed={selected === h.rule_key} onClick={() => setSelected(h.rule_key)} className={`w-full rounded-xl border p-4 text-left transition-colors ${selected === h.rule_key ? "border-violet-400/40 bg-violet-400/10" : "border-transparent bg-transparent hover:bg-well"}`}><div className="flex justify-between gap-2"><span className="font-mono text-xs">{h.rule_key}</span><span className="lv-muted font-mono text-xs">v{h.version}</span></div><div className="mt-2 text-sm font-medium leading-5">{h.title}</div><div className="lv-muted mt-3 flex justify-between text-xs"><span>{h.overrides} overrides</span><span>{percentage(h.override_rate)}</span></div></button>)}</div>{!data.health.length && <p className="lv-muted p-3 text-sm">Review decisions will appear here.</p>}</Panel>
        {rule ? <Panel className="min-w-0 overflow-hidden">
          <div className="lv-divider flex flex-wrap items-start justify-between gap-4 border-b p-6"><div><div className="mb-3 flex flex-wrap items-center gap-2"><Badge tone="accent">{rule.rule_key}</Badge><Badge>Active v{rule.version}</Badge></div><h2 className="font-display text-xl font-semibold">{rule.title}</h2></div><Badge tone={rule.insufficient_history ? "warning" : "neutral"}>{rule.insufficient_history ? `Limited history · ${rule.overrides}/${rule.min_sample}` : `${percentage(rule.override_rate)} override rate`}</Badge></div>
          <div className="space-y-6 p-6"><div className="lv-well p-5"><div className="lv-kicker mb-3">Active wording / v{rule.version}</div><p className="text-sm leading-7">{rule.rule_text}</p></div>
            <div className="grid grid-cols-3 gap-3">{[["Overrides", rule.overrides], ["Accepted", rule.accepted], ["Decisions", rule.decisions]].map(([label, value]) => <div className="lv-well p-4" key={label}><div className="lv-muted text-xs">{label}</div><div className="mt-2 font-display text-2xl font-semibold">{value}</div></div>)}</div>
            <div className="grid gap-5 md:grid-cols-2"><div><h3 className="lv-kicker mb-3">Why reviewers disagree</h3>{rule.reasons.length ? <ul className="space-y-3">{rule.reasons.map((r, i) => <li key={i} className="flex items-start justify-between gap-3 text-sm leading-6"><span className="lv-muted">{r.reason}</span><Badge>{r.count}</Badge></li>)}</ul> : <p className="lv-muted text-sm">No reasons recorded.</p>}</div><div><h3 className="lv-kicker mb-3">Examples from review</h3><div className="space-y-3">{rule.examples.map((e, i) => <div className="lv-well p-3" key={i}><p className="text-sm leading-6">“{e.excerpt}”</p><p className="lv-muted mt-2 text-xs leading-5">{e.reason}</p>{e.seeded && <div className="mt-2"><Badge>Sample history</Badge></div>}</div>)}</div></div></div>
            {rule.proposal ? <div className="space-y-5 border-t border-line pt-6"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-display text-lg font-semibold">Shape the next version.</h3><Badge tone="warning">Unpublished proposal</Badge></div><p className="lv-muted text-sm leading-6">{rule.proposal.rationale}</p>
              <div><div className="lv-label mb-3">Channel guidance draft</div><div className="flex flex-wrap gap-2">{CHANNELS.map(channel => <Button key={channel} variant={selectedChannels.includes(channel) ? "primary" : "secondary"} disabled={!isOwner || !!busy} aria-pressed={selectedChannels.includes(channel)} onClick={() => setChannels(current => ({ ...current, [rule.rule_key]: selectedChannels.includes(channel) ? selectedChannels.filter(x => x !== channel) : [...selectedChannels, channel] }))}>{selectedChannels.includes(channel) && <Icon name="check" size={13}/>} {channel}</Button>)}</div><p className="lv-muted mt-3 text-xs leading-5">These controls draft wording only. They do not activate executable channel conditions.</p><Button className="mt-3" disabled={!isOwner || !selectedChannels.length || !!busy} onClick={appendConditions}>Append selected guidance <Icon name="plus" size={14}/></Button></div>
              <div className="grid gap-3 md:grid-cols-2"><div className="lv-well p-4"><div className="lv-eyebrow mb-3">Current / v{rule.version}</div><p className="text-sm leading-7">{rule.proposal.current_text}</p></div><label className="lv-well block p-4"><span className="lv-eyebrow mb-3 block">Proposed / v{rule.version + 1}</span><textarea className="lv-input min-h-40 w-full" aria-label="Proposed guideline wording" value={edited[rule.proposal.id] ?? rule.proposal.proposed_text} disabled={!isOwner || !!busy} onChange={e => { const value = e.target.value; const id = rule.proposal!.id; setEdited(current => ({ ...current, [id]: value })); }}/></label></div>
              <Notice tone="warning"><strong>Draft impact preview unavailable.</strong> This is a wording comparison, not a measured replay of affected drafts. The supplied backend retains existing deterministic matchers when publishing new wording.</Notice>
              <div className="flex flex-wrap items-center gap-3"><Button variant="primary" disabled={!isOwner || !!busy || !(edited[rule.proposal.id] ?? rule.proposal.proposed_text).trim()} onClick={() => decide(rule, "approve")}>{busy === rule.rule_key ? "Saving…" : `Publish wording v${rule.version + 1}`} <Icon name="arrow" size={15}/></Button><Button variant="danger" disabled={!isOwner || !!busy} onClick={() => decide(rule, "reject")}>Reject proposal</Button>{!isOwner && <span className="lv-muted text-xs">Brand Owner approval required.</span>}</div>
            </div> : <div className="flex flex-wrap items-center gap-4 border-t border-line pt-5"><Button variant="primary" disabled={!canSuggest || !!busy} onClick={() => suggest(rule)}><Icon name="spark" size={15}/>{busy === rule.rule_key ? "Preparing proposal…" : "Suggest clearer wording"}</Button><span className="lv-muted text-xs">A proposal never changes active rules automatically.</span></div>}
          </div></Panel> : <Empty title="Feedback starts with a review.">Accept or override findings to build a visible rule history.</Empty>}
      </div>
      <Panel className="p-6"><div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><div className="lv-eyebrow mb-2">Pattern library</div><h2 className="font-display text-lg font-semibold">Recurring issues, with their origins.</h2></div><Badge>Live / sample separated</Badge></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{data.recurring_issues.map(r => <div className="lv-well p-4" key={r.rule_key}><div className="flex justify-between gap-3"><span className="font-mono text-xs">{r.rule_key}</span><Badge>{r.category}</Badge></div><p className="my-3 text-sm font-medium">{r.title}</p><div className="lv-muted text-xs">{r.live_count} live findings · {r.seeded_count} sample findings</div></div>)}</div>{!data.recurring_issues.length && <p className="lv-muted text-sm">No recurring issues returned.</p>}</Panel>
    </>}
    <section className="space-y-5" aria-labelledby="benchmark-heading">
      <div className="flex flex-wrap items-center gap-3"><span className="lv-eyebrow">02 / Measured performance</span><div className="lv-divider grow border-t"/><Badge tone={privacy?.hosted ? "success" : "neutral"}>{privacy ? (privacy.hosted ? `Live AI · ${privacy.provider}` : `Offline Verifier · ${privacy.provider}`) : "Provider unavailable"}</Badge></div>
      <Panel className="p-6"><div className="flex flex-wrap items-center justify-between gap-5"><div><h2 id="benchmark-heading" className="font-display text-2xl font-semibold tracking-tight">Evidence over impressive numbers.</h2><p className="lv-muted mt-2 max-w-2xl text-sm leading-6">Run the labelled benchmark against the configured checker. Sample size and results come directly from its response.</p></div><Button variant="primary" disabled={evaluating} onClick={runEvaluation}><Icon name="refresh" size={15}/>{evaluating ? "Running benchmark…" : evaluation ? "Run benchmark again" : "Run live benchmark"}</Button></div>{evalError && <div className="mt-5"><Notice tone="danger">{evalError}</Notice></div>}</Panel>
      {evaluation ? <><div className="flex flex-wrap items-center gap-2"><Badge tone="accent">n = {evaluation.drafts_total}</Badge><Badge>{evaluation.problematic_drafts} problematic</Badge><Badge>{evaluation.clean_drafts} clean</Badge><span className="lv-muted text-xs">Results from the most recent benchmark response</span></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Quote validity" value={evaluation.citations_checked ? percentage(evaluation.citation_validity_rate) : "—"} note={`${evaluation.citations_valid} / ${evaluation.citations_checked} citations pass quote and source-reference checks`} tone="success"/><Metric label="Issue recall" value={evaluation.expected_issues ? percentage(evaluation.recall) : "—"} note={`${evaluation.true_positives} / ${evaluation.expected_issues} expected issue labels matched`}/><Metric label="Issue precision" value={evaluation.true_positives + evaluation.false_alarms ? percentage(evaluation.precision) : "—"} note={`${evaluation.false_alarms} unexpected issue labels`}/><Metric label="Average check time" value={`${evaluation.avg_review_time_ms} ms`} note={`${evaluation.total_time_ms} ms across the returned sample`}/></div>
      <div className="grid gap-4 md:grid-cols-2"><Panel className="p-5"><div className="flex items-center justify-between gap-3"><h3 className="font-medium">Factual support accuracy</h3><Badge tone="warning">Not measured</Badge></div><p className="lv-muted mt-3 text-sm leading-6">The supplied benchmark validates citations and issue labels. It does not return independently labelled claim-to-evidence factual support accuracy.</p></Panel><Panel className="p-5"><div className="flex items-center justify-between gap-3"><h3 className="font-medium">Misleading-pair rejection</h3><Badge tone="warning">Not measured</Badge></div><p className="lv-muted mt-3 text-sm leading-6">“40% lower costs” ≠ “40% lower downtime”. No separate adversarial-pair measurement is exposed by this backend.</p></Panel></div>
      <Panel className="p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-display text-lg font-semibold">Inspect the underlying cases.</h3><p className="lv-muted mt-2 text-xs">{evaluation.clean_draft_false_alarms} false alarms on {evaluation.clean_drafts} clean drafts · {evaluation.missed_issues} expected labels missed</p></div><Button onClick={() => setShowCases(v => !v)} aria-expanded={showCases}>{showCases ? "Hide" : "Inspect"} {evaluation.cases.length} cases <Icon name="chevron" size={15}/></Button></div>{showCases && <div className="mt-5 space-y-3">{evaluation.cases.map(c => <div key={c.id} className="lv-well p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap items-center gap-2"><Badge>{c.id}</Badge><span className="text-sm font-medium">{c.label}</span>{c.clean && <Badge tone="success">Clean reference</Badge>}</div><span className="lv-muted font-mono text-xs">{c.latency_ms} ms</span></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><div><div className="lv-kicker mb-2">Expected</div><p className="lv-muted break-words font-mono text-xs leading-6">{c.expected.join(", ") || "No issue labels"}</p></div><div><div className="lv-kicker mb-2">Observed</div><p className="lv-muted break-words font-mono text-xs leading-6">{c.observed.join(", ") || "No issue labels"}</p></div></div></div>)}</div>}</Panel></> : <Empty title="No benchmark run in this session.">Run the benchmark to inspect measured results.</Empty>}
    </section>
  </div>;
};
