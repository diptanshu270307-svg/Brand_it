import React, { useEffect, useState } from "react";
import {
  api,
  ChannelConditionItem,
  EvaluationData,
  GuidelineHealthItem,
  InsightsData,
  PrivacyInfo,
  SimulationResult,
} from "../api";
import {
  Badge,
  Button,
  Empty,
  errorText,
  ExpandableDetails,
  Icon,
  Metric,
  Notice,
  PageHeading,
  Panel,
  StatusAnnouncer,
  percentage,
} from "../components/ui";

interface Props {
  brandId: number;
  role: string;
}

const AVAILABLE_CHANNELS = ["Instagram", "Investor Update", "Email", "Blog", "Landing Page", "Twitter / X"];

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
  const [channelConditions, setChannelConditions] = useState<Record<string, ChannelConditionItem[]>>({});
  const [condChannel, setCondChannel] = useState(AVAILABLE_CHANNELS[0]);
  const [condAction, setCondAction] = useState<"allow" | "restrict">("allow");
  const [condReason, setCondReason] = useState("");
  const [simulation, setSimulation] = useState<Record<string, SimulationResult | null>>({});
  const [simulating, setSimulating] = useState<Record<string, boolean>>({});
  const [showCases, setShowCases] = useState(false);

  const isOwner = role === "brand_owner";
  const canSuggest = ["brand_owner", "reviewer", "senior_reviewer"].includes(role);

  const refresh = async () => {
    const next = await api.getInsights(brandId);
    setData(next);
    setSelected(current =>
      next.health.some(h => h.rule_key === current) ? current : next.health[0]?.rule_key || ""
    );
    setEdited(current => {
      const updated = { ...current };
      next.health.forEach(h => {
        if (h.proposal && updated[h.proposal.id] === undefined) {
          updated[h.proposal.id] = h.proposal.proposed_text;
        }
      });
      return updated;
    });
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setEvalError("");
    setData(null);
    setEvaluation(null);
    setEdited({});
    setChannelConditions({});
    setSimulation({});

    Promise.allSettled([api.getInsights(brandId), api.me(), api.getEvaluation(brandId)]).then(([ins, me, ev]) => {
      if (!active) return;
      if (ins.status === "fulfilled") {
        setData(ins.value);
        setSelected(ins.value.health[0]?.rule_key || "");
        // Pre-populate conditions from pending proposals or active rules
        const initialConds: Record<string, ChannelConditionItem[]> = {};
        ins.value.health.forEach(h => {
          if (h.proposal?.channel_conditions && h.proposal.channel_conditions.length) {
            initialConds[h.rule_key] = h.proposal.channel_conditions;
          } else if (h.channel_conditions && h.channel_conditions.length) {
            initialConds[h.rule_key] = h.channel_conditions;
          }
        });
        setChannelConditions(initialConds);
      } else {
        setError(errorText(ins.reason));
      }
      if (me.status === "fulfilled") setPrivacy(me.value.privacy);
      if (ev.status === "fulfilled") setEvaluation(ev.value);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [brandId, role]);

  const runEvaluation = async () => {
    if (evaluating) return;
    setEvaluating(true);
    setEvalError("");
    try {
      const [result, me] = await Promise.all([api.runEvaluation(brandId), api.me()]);
      setEvaluation(result);
      setPrivacy(me.privacy);
    } catch (e) {
      setEvalError(errorText(e));
    } finally {
      setEvaluating(false);
    }
  };

  const suggest = async (h: GuidelineHealthItem) => {
    if (busy) return;
    setBusy(h.rule_key);
    setError("");
    setMessage("");
    try {
      const p = await api.suggestWording(brandId, h.rule_key);
      setEdited(current => ({ ...current, [p.id]: p.proposed_text }));
      await refresh();
      setMessage(`A clearer wording suggestion for ${h.rule_key} is ready for review. The active rule has not changed.`);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy("");
    }
  };

  const runSimulation = async (h: GuidelineHealthItem) => {
    if (!h.proposal || simulating[h.rule_key]) return;
    setSimulating(current => ({ ...current, [h.rule_key]: true }));
    setError("");
    const proposedText = (edited[h.proposal.id] ?? h.proposal.proposed_text).trim();
    const conds = channelConditions[h.rule_key] || [];
    try {
      const sim = await api.simulateRule(brandId, h.rule_key, proposedText, conds);
      setSimulation(current => ({ ...current, [h.rule_key]: sim }));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSimulating(current => ({ ...current, [h.rule_key]: false }));
    }
  };

  const addCondition = (ruleKey: string) => {
    const existing = channelConditions[ruleKey] || [];
    if (existing.some(c => c.channel === condChannel)) return;
    const item: ChannelConditionItem = {
      channel: condChannel,
      action: condAction,
      reason: condReason.trim() || undefined,
    };
    setChannelConditions(current => ({
      ...current,
      [ruleKey]: [...existing, item],
    }));
    setCondReason("");
  };

  const removeCondition = (ruleKey: string, channelName: string) => {
    setChannelConditions(current => ({
      ...current,
      [ruleKey]: (current[ruleKey] || []).filter(c => c.channel !== channelName),
    }));
  };

  const decide = async (h: GuidelineHealthItem, decision: "approve" | "reject") => {
    if (!h.proposal || busy) return;
    setBusy(h.rule_key);
    setError("");
    setMessage("");
    const conds = channelConditions[h.rule_key] || [];
    const text = edited[h.proposal.id] ?? h.proposal.proposed_text;
    try {
      await api.decideProposal(brandId, h.proposal.id, decision, text, conds);
      await refresh();
      setMessage(
        decision === "approve"
          ? `Published policy v${h.version + 1} for ${h.rule_key} with explicit channel conditions. Impacted approved drafts have been routed into the revalidation workflow.`
          : `The proposed wording for ${h.rule_key} was rejected.`
      );
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy("");
    }
  };

  const rule = data?.health.find(h => h.rule_key === selected);
  const currentConds = rule ? channelConditions[rule.rule_key] || [] : [];
  const currentSim = rule ? simulation[rule.rule_key] : null;

  return (
    <div className="space-y-8">
      <StatusAnnouncer message={message || error || evalError || (evaluating ? "Evaluating proposed policy against drafts…" : null)} />
      <PageHeading
        eyebrow="Governance / Guideline health"
        title="Insights"
        description="Rules your team finds unclear. Inspect review outcomes isolated by version and content channel, draft explicit channel conditions, and evaluate impact against real drafts before publishing."
        action={
          <Badge tone="accent">
            <Icon name="chart" size={13} /> Guideline health
          </Badge>
        }
      />

      {error && (
        <Notice tone="danger" action={<Button variant="ghost" className="!text-xs" onClick={refresh}>Retry</Button>}>
          {error}
        </Notice>
      )}
      {message && <Notice tone="success">{message}</Notice>}

      <div className="grid gap-4 sm:grid-cols-3">
        <Metric
          label="Rules with review feedback"
          value={loading ? "—" : data?.health.length ?? "—"}
          note="Rules represented in the returned review history"
        />
        <Metric
          label="Live overrides"
          value={loading ? "—" : data?.health.reduce((sum, h) => sum + h.live_overrides, 0) ?? "—"}
          note="Human decisions from real review activity"
          tone="warning"
        />
        <Metric
          label="Sample overrides"
          value={loading ? "—" : data?.health.reduce((sum, h) => sum + h.seeded_overrides, 0) ?? "—"}
          note="Seeded demo history, labelled separately"
        />
      </div>

      {loading ? (
        <Panel className="p-8">
          <p className="lv-muted" role="status">Loading rule feedback…</p>
        </Panel>
      ) : data && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <span className="lv-eyebrow">01 / Rule evolution</span>
            <div className="lv-divider grow border-t" />
            <Badge>Human owner approval required</Badge>
          </div>

          <Notice>
            {data.note} Review outcomes and statistics are isolated by rule version and content channel with uncertainty metrics.
          </Notice>

          <div className="grid items-start gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
            <Panel className="p-3">
              <div className="lv-kicker px-3 py-3">Rules your team finds unclear</div>
              <div className="space-y-1 motion-stagger">
                {data.health.map(h => (
                  <button
                    type="button"
                    key={h.rule_key}
                    aria-pressed={selected === h.rule_key}
                    onClick={() => setSelected(h.rule_key)}
                    className={`motion-interactive w-full rounded-xl border p-4 text-left transition-colors ${
                      selected === h.rule_key
                        ? "border-violet-400/40 bg-violet-400/10"
                        : "border-transparent bg-transparent hover:bg-well"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium leading-5">{h.title}</div>
                      <Badge className="text-[10px]">v{h.version}</Badge>
                    </div>
                    <div className="lv-muted mt-2 flex justify-between text-xs">
                      <span>{h.overrides} overrides (v{h.version})</span>
                      <span>{percentage(h.override_rate)}</span>
                    </div>
                  </button>
                ))}
              </div>
              {!data.health.length && (
                <p className="lv-muted p-3 text-sm">Review decisions will appear here.</p>
              )}
            </Panel>

            {rule ? (
              <Panel className="min-w-0 overflow-hidden">
                <div className="lv-divider flex flex-wrap items-start justify-between gap-4 border-b p-6">
                  <div>
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Badge tone="accent">Guideline</Badge>
                      <Badge>v{rule.version}</Badge>
                      {rule.category && <Badge>{rule.category}</Badge>}
                    </div>
                    <h2 className="font-display text-xl font-semibold">{rule.title}</h2>
                  </div>
                  <Badge tone={rule.insufficient_history ? "warning" : "neutral"}>
                    {rule.insufficient_history
                      ? `Limited history · ${rule.decisions}/${rule.min_sample} reviews`
                      : `${percentage(rule.override_rate)} override rate (n = ${rule.decisions})`}
                  </Badge>
                </div>

                <div className="space-y-6 p-6">
                  {/* Active wording */}
                  <div className="lv-well p-5">
                    <div className="lv-kicker mb-3">Active wording / v{rule.version}</div>
                    <p className="text-sm leading-7">{rule.rule_text}</p>
                    {rule.exempt_channels && rule.exempt_channels.length > 0 && (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium text-emerald-400">Exempt channels:</span>
                        {rule.exempt_channels.map(ch => (
                          <Badge key={ch} tone="success" className="text-xs">
                            {ch} (allowed)
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Uncertainty & Statistical sample notice */}
                  {rule.insufficient_history ? (
                    <Notice tone="warning">
                      <strong>Low sample size:</strong> {rule.uncertainty_label || `Only ${rule.decisions} reviews recorded for v${rule.version}. Not enough history to conclude this rule is unclear.`}
                    </Notice>
                  ) : (
                    <Notice tone="neutral">
                      <strong>Statistical confidence:</strong> {rule.uncertainty_label || `Calculated across n = ${rule.decisions} reviews for v${rule.version}.`}
                    </Notice>
                  )}

                  {/* Version Breakdown (v1 vs v2 statistics isolated) */}
                  {rule.version_breakdown && rule.version_breakdown.length > 0 && (
                    <div>
                      <h3 className="lv-kicker mb-3">Statistics by rule version (Isolated)</h3>
                      <div className="overflow-x-auto rounded-xl border border-line">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-well/60 text-muted">
                            <tr>
                              <th className="p-3">Version</th>
                              <th className="p-3">Status</th>
                              <th className="p-3">Decisions</th>
                              <th className="p-3">Overrides</th>
                              <th className="p-3">Accepted</th>
                              <th className="p-3">Override Rate</th>
                              <th className="p-3">Confidence</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-line/40">
                            {rule.version_breakdown.map(v => (
                              <tr key={v.version} className={v.version === rule.version ? "bg-violet-500/5 font-medium" : ""}>
                                <td className="p-3 font-semibold">v{v.version}</td>
                                <td className="p-3">
                                  <Badge tone={v.status === "active" ? "accent" : "neutral"} className="text-[10px]">
                                    {v.status}
                                  </Badge>
                                </td>
                                <td className="p-3">{v.decisions}</td>
                                <td className="p-3">{v.overrides} ({v.live_overrides} live, {v.seeded_overrides} sample)</td>
                                <td className="p-3">{v.accepted}</td>
                                <td className="p-3">{percentage(v.override_rate)}</td>
                                <td className="p-3">
                                  {v.insufficient_history ? (
                                    <span className="text-amber-400">n &lt; 5 (low sample)</span>
                                  ) : (
                                    <span className="text-emerald-400">Reliable sample</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Channel Breakdown */}
                  {rule.outcomes_by_channel && Object.keys(rule.outcomes_by_channel).length > 0 && (
                    <div>
                      <h3 className="lv-kicker mb-3">Review outcomes by content channel</h3>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {Object.entries(rule.outcomes_by_channel).map(([ch, st]) => (
                          <div key={ch} className="lv-well p-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold">{ch}</span>
                              <Badge className="text-[10px]">{st.decisions} reviews</Badge>
                            </div>
                            <div className="mt-2 flex justify-between text-xs text-muted">
                              <span>Overrides: {st.overrides}</span>
                              <span>Accepted: {st.accepted}</span>
                            </div>
                            <div className="mt-1 flex justify-between text-xs font-medium">
                              <span>Override rate:</span>
                              <span className={st.override_rate && st.override_rate > 0.4 ? "text-amber-400" : ""}>
                                {percentage(st.override_rate)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Active version metrics */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      ["Overrides (v" + rule.version + ")", rule.overrides],
                      ["Accepted (v" + rule.version + ")", rule.accepted],
                      ["Decisions (v" + rule.version + ")", rule.decisions],
                    ].map(([label, value]) => (
                      <div className="lv-well p-4" key={label}>
                        <div className="lv-muted text-xs">{label}</div>
                        <div className="mt-2 font-display text-2xl font-semibold">{value}</div>
                      </div>
                    ))}
                  </div>

                  <div className="grid gap-5 md:grid-cols-2">
                    <div>
                      <h3 className="lv-kicker mb-3">Why reviewers disagree</h3>
                      {rule.reasons.length ? (
                        <ul className="space-y-3">
                          {rule.reasons.map((r, i) => (
                            <li key={i} className="flex items-start justify-between gap-3 text-sm leading-6">
                              <span className="lv-muted">{r.reason}</span>
                              <Badge>{r.count}</Badge>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="lv-muted text-sm">No reasons recorded.</p>
                      )}
                    </div>
                    <div>
                      <h3 className="lv-kicker mb-3">Examples from review</h3>
                      <div className="space-y-3">
                        {rule.examples.map((e, i) => (
                          <div className="lv-well p-3" key={i}>
                            <p className="text-sm leading-6">“{e.excerpt}”</p>
                            <p className="lv-muted mt-2 text-xs leading-5">{e.reason}</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {e.channel && <Badge className="text-[10px]">{e.channel}</Badge>}
                              {e.rule_version && <Badge className="text-[10px]">v{e.rule_version}</Badge>}
                              {e.seeded && <Badge className="text-[10px]">Sample history</Badge>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Shaping Next Version */}
                  {rule.proposal ? (
                    <div className="space-y-6 border-t border-line pt-6">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <h3 className="font-display text-lg font-semibold">Shape policy version v{rule.version + 1}</h3>
                        <Badge tone="warning">Unpublished proposal</Badge>
                      </div>

                      <p className="lv-muted text-sm leading-6">{rule.proposal.rationale}</p>

                      {/* Explicit Channel Conditions Builder */}
                      <div className="rounded-xl border border-line bg-well/40 p-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-semibold">Explicit channel conditions (Validated structured data)</div>
                          <Badge tone="accent">Validated data · No eval</Badge>
                        </div>
                        <p className="lv-muted text-xs leading-5">
                          Configure explicit channel behavior for this rule version, such as casual greetings permitted on Instagram but restricted in investor copy.
                        </p>

                        {/* Existing drafted conditions */}
                        <div className="space-y-2">
                          {currentConds.length === 0 ? (
                            <p className="text-xs text-muted italic">No channel conditions attached. Rule applies uniformly across channels.</p>
                          ) : (
                            currentConds.map(cond => (
                              <div
                                key={cond.channel}
                                className="flex items-center justify-between rounded-lg border border-line bg-well p-2.5 text-xs"
                              >
                                <div className="flex items-center gap-2">
                                  <Badge tone={cond.action === "allow" || cond.action === "exempt" ? "success" : "warning"}>
                                    {cond.action === "allow" || cond.action === "exempt" ? "Allow / Exempt" : "Restricted"}
                                  </Badge>
                                  <span className="font-semibold">{cond.channel}</span>
                                  {cond.reason && <span className="text-muted truncate max-w-xs">({cond.reason})</span>}
                                </div>
                                {isOwner && (
                                  <Button
                                    variant="ghost"
                                    className="!py-0.5 !px-1.5 text-red-400 hover:text-red-300"
                                    onClick={() => removeCondition(rule.rule_key, cond.channel)}
                                  >
                                    Remove
                                  </Button>
                                )}
                              </div>
                            ))
                          )}
                        </div>

                        {/* Add Condition Row */}
                        {isOwner && (
                          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-line/40">
                            <select
                              className="lv-input !py-1 text-xs"
                              value={condChannel}
                              onChange={e => setCondChannel(e.target.value)}
                              aria-label="Target channel"
                            >
                              {AVAILABLE_CHANNELS.map(ch => (
                                <option key={ch} value={ch}>
                                  {ch}
                                </option>
                              ))}
                            </select>

                            <select
                              className="lv-input !py-1 text-xs"
                              value={condAction}
                              onChange={e => setCondAction(e.target.value as "allow" | "restrict")}
                              aria-label="Condition action"
                            >
                              <option value="allow">Allow / Exempt</option>
                              <option value="restrict">Strictly Restrict</option>
                            </select>

                            <input
                              type="text"
                              className="lv-input !py-1 text-xs grow"
                              placeholder="Reason (e.g. casual tone accepted on social copy)"
                              value={condReason}
                              onChange={e => setCondReason(e.target.value)}
                              aria-label="Condition reason"
                            />

                            <Button className="!py-1 !text-xs" onClick={() => addCondition(rule.rule_key)}>
                              Add condition <Icon name="plus" size={13} />
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* Wording Editor */}
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="lv-well p-4">
                          <div className="lv-eyebrow mb-3">Current wording / v{rule.version}</div>
                          <p className="text-sm leading-7">{rule.proposal.current_text}</p>
                        </div>
                        <label className="lv-well block p-4">
                          <span className="lv-eyebrow mb-3 block">Proposed wording / v{rule.version + 1}</span>
                          <textarea
                            className="lv-input min-h-40 w-full text-sm"
                            aria-label="Proposed guideline wording"
                            value={edited[rule.proposal.id] ?? rule.proposal.proposed_text}
                            disabled={!isOwner || !!busy}
                            onChange={e => {
                              const value = e.target.value;
                              const id = rule.proposal!.id;
                              setEdited(current => ({ ...current, [id]: value }));
                            }}
                          />
                        </label>
                      </div>

                      {/* Pre-publication Draft Simulation */}
                      <div className="rounded-xl border border-line bg-well/40 p-4 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold">Pre-publication draft evaluation</div>
                            <p className="lv-muted text-xs mt-1">
                              Simulate candidate wording and channel conditions against real saved drafts in this workspace before publishing.
                            </p>
                          </div>
                          <Button
                            variant="secondary"
                            disabled={simulating[rule.rule_key]}
                            onClick={() => runSimulation(rule)}
                          >
                            <Icon name="refresh" size={14} />
                            {simulating[rule.rule_key] ? "Evaluating drafts…" : currentSim ? "Re-evaluate drafts" : "Evaluate impact against saved drafts"}
                          </Button>
                        </div>

                        {currentSim && (
                          <div className="space-y-3 pt-2">
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              <Badge tone="accent">Sample size: {currentSim.drafts_evaluated} drafts</Badge>
                              <Badge tone={currentSim.changed_count > 0 ? "success" : "neutral"}>
                                {currentSim.changed_count} changed findings
                              </Badge>
                              <Badge tone="neutral">{currentSim.unchanged_count} unchanged drafts</Badge>
                              {currentSim.findings_eliminated_count > 0 && (
                                <Badge tone="success">
                                  {currentSim.findings_eliminated_count} unnecessary blocker(s) eliminated
                                </Badge>
                              )}
                            </div>

                            {currentSim.changed_drafts.length > 0 && (
                              <div className="space-y-2 mt-3">
                                <div className="lv-kicker text-xs">Drafts with changed findings</div>
                                {currentSim.changed_drafts.map((cd, idx) => (
                                  <div key={idx} className="rounded-lg border border-line bg-well p-3 text-xs space-y-1">
                                    <div className="flex items-center justify-between">
                                      <span className="font-semibold">{cd.title}</span>
                                      <Badge>{cd.channel}</Badge>
                                    </div>
                                    <p className="text-emerald-400">
                                      {cd.change_type === "findings_eliminated"
                                        ? `Finding eliminated on ${cd.channel}: “${(cd.quotes_eliminated || []).join(", ")}” will no longer block review.`
                                        : `Finding added: “${(cd.quotes_added || []).join(", ")}”`}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}

                            {currentSim.unchanged_drafts.length > 0 && (
                              <ExpandableDetails summary={`Inspect ${currentSim.unchanged_count} unchanged draft(s)`}>
                                <div className="space-y-1 text-xs pt-2">
                                  {currentSim.unchanged_drafts.map((ud, idx) => (
                                    <div key={idx} className="flex justify-between py-1 border-b border-line/30 text-muted">
                                      <span>{ud.title} ({ud.channel})</span>
                                      <span>{ud.findings_count} findings maintained</span>
                                    </div>
                                  ))}
                                </div>
                              </ExpandableDetails>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Publishing Controls */}
                      <div className="space-y-3 border-t border-line pt-4">
                        <div className="flex flex-wrap items-center gap-3">
                          <Button
                            variant="primary"
                            disabled={!isOwner || !!busy || !(edited[rule.proposal.id] ?? rule.proposal.proposed_text).trim()}
                            onClick={() => decide(rule, "approve")}
                          >
                            {busy === rule.rule_key ? "Publishing…" : `Publish policy v${rule.version + 1}`}
                            <Icon name="arrow" size={15} />
                          </Button>
                          <Button
                            variant="danger"
                            disabled={!isOwner || !!busy}
                            onClick={() => decide(rule, "reject")}
                          >
                            Reject proposal
                          </Button>
                          {!isOwner && (
                            <span className="lv-muted text-xs">
                              Brand Owner approval required to publish new policy versions.
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted leading-5">
                          Publishing policy v{rule.version + 1} will supersede v{rule.version} and automatically route any approved drafts citing the old version into the Evidence Revalidation workflow.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-4 border-t border-line pt-5">
                      <Button
                        variant="primary"
                        disabled={!canSuggest || !!busy}
                        onClick={() => suggest(rule)}
                      >
                        <Icon name="spark" size={15} />
                        {busy === rule.rule_key ? "Preparing proposal…" : "Suggest clearer wording"}
                      </Button>
                      <span className="lv-muted text-xs">
                        A proposal never changes active rules automatically.
                      </span>
                    </div>
                  )}
                </div>
              </Panel>
            ) : (
              <Empty title="Feedback starts with a review.">
                Accept or override findings to build a visible rule history.
              </Empty>
            )}
          </div>

          <Panel className="p-6">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="lv-eyebrow mb-2">Pattern library</div>
                <h2 className="font-display text-lg font-semibold">Recurring issues, with their origins.</h2>
              </div>
              <Badge>Live / sample separated</Badge>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {data.recurring_issues.map(r => (
                <div className="lv-well p-4" key={r.rule_key}>
                  <div className="flex justify-between gap-3">
                    <span className="text-xs font-medium">{r.title}</span>
                    <Badge>{r.category}</Badge>
                  </div>
                  <div className="lv-muted my-2 text-xs">
                    {r.live_count} live findings · {r.seeded_count} sample findings
                  </div>
                  <ExpandableDetails summary="Technical ID">
                    <p className="font-mono text-[11px] text-muted">{r.rule_key}</p>
                  </ExpandableDetails>
                </div>
              ))}
            </div>
            {!data.recurring_issues.length && (
              <p className="lv-muted text-sm">No recurring issues returned.</p>
            )}
          </Panel>
        </>
      )}

      {/* Benchmark section */}
      <section className="space-y-5" aria-labelledby="benchmark-heading">
        <div className="flex flex-wrap items-center gap-3">
          <span className="lv-eyebrow">02 / Measured performance</span>
          <div className="lv-divider grow border-t" />
          <Badge tone={privacy?.hosted ? "success" : "neutral"}>
            {privacy
              ? privacy.hosted
                ? `Live AI · ${privacy.provider}`
                : `Offline Verifier · ${privacy.provider}`
              : "Provider unavailable"}
          </Badge>
        </div>
        <Panel className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-5">
            <div>
              <h2 id="benchmark-heading" className="font-display text-2xl font-semibold tracking-tight">
                Evidence over impressive numbers.
              </h2>
              <p className="lv-muted mt-2 max-w-2xl text-sm leading-6">
                Run the labelled benchmark against the configured checker. Sample size and results come directly from its response.
              </p>
            </div>
            <Button variant="primary" disabled={evaluating} onClick={runEvaluation} aria-busy={evaluating}>
              <Icon name="refresh" size={15} />
              {evaluating ? "Running benchmark…" : evaluation ? "Run benchmark again" : "Run live benchmark"}
            </Button>
          </div>
          {evalError && (
            <div className="mt-5">
              <Notice tone="danger" action={<Button variant="ghost" className="!text-xs" onClick={runEvaluation}>Retry</Button>}>
                {evalError}
              </Notice>
            </div>
          )}
        </Panel>

        {evaluation ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="accent">n = {evaluation.drafts_total}</Badge>
              <Badge>{evaluation.problematic_drafts} problematic</Badge>
              <Badge>{evaluation.clean_drafts} clean</Badge>
              <span className="lv-muted text-xs">Results from the most recent benchmark response</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Metric
                label="Quote validity"
                value={evaluation.citations_checked ? percentage(evaluation.citation_validity_rate) : "—"}
                note={`${evaluation.citations_valid} / ${evaluation.citations_checked} citations pass quote and source-reference checks`}
                tone="success"
              />
              <Metric
                label="Issue recall"
                value={evaluation.expected_issues ? percentage(evaluation.recall) : "—"}
                note={`${evaluation.true_positives} / ${evaluation.expected_issues} expected issue labels matched`}
              />
              <Metric
                label="Issue precision"
                value={evaluation.true_positives + evaluation.false_alarms ? percentage(evaluation.precision) : "—"}
                note={`${evaluation.false_alarms} unexpected issue labels`}
              />
              <Metric
                label="Average check time"
                value={`${evaluation.avg_review_time_ms} ms`}
                note={`${evaluation.total_time_ms} ms across the returned sample`}
              />
            </div>
            <ExpandableDetails summary="Model and evaluation runtime details">
              <div className="space-y-2 font-mono text-xs">
                <div className="flex justify-between border-b border-line/40 py-1.5">
                  <span className="text-muted">Checker provider:</span>
                  <span className="font-semibold">{privacy?.provider || "Configured checker"}</span>
                </div>
                <div className="flex justify-between border-b border-line/40 py-1.5">
                  <span className="text-muted">Execution mode:</span>
                  <span>{privacy?.hosted ? "Hosted AI provider" : "Offline Verifier"}</span>
                </div>
                <div className="flex justify-between border-b border-line/40 py-1.5">
                  <span className="text-muted">Sample latency:</span>
                  <span>{evaluation.total_time_ms} ms total ({evaluation.avg_review_time_ms} ms avg)</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-muted">Edge cases:</span>
                  <span>
                    {evaluation.clean_draft_false_alarms} false alarms on clean drafts · {evaluation.missed_issues} missed labels
                  </span>
                </div>
              </div>
            </ExpandableDetails>
            <div className="grid gap-4 md:grid-cols-2">
              <Panel className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-medium">Factual support accuracy</h3>
                  <Badge tone="warning">Not measured</Badge>
                </div>
                <p className="lv-muted mt-3 text-sm leading-6">
                  The supplied benchmark validates citations and issue labels. It does not return independently labelled claim-to-evidence factual support accuracy.
                </p>
              </Panel>
              <Panel className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-medium">Misleading-pair rejection</h3>
                  <Badge tone="warning">Not measured</Badge>
                </div>
                <p className="lv-muted mt-3 text-sm leading-6">
                  “40% lower costs” ≠ “40% lower downtime”. No separate adversarial-pair measurement is exposed by this backend.
                </p>
              </Panel>
            </div>
            <Panel className="p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-lg font-semibold">Inspect the underlying cases</h3>
                  <p className="lv-muted mt-2 text-xs">
                    {evaluation.clean_draft_false_alarms} false alarms on {evaluation.clean_drafts} clean drafts · {evaluation.missed_issues} expected labels missed
                  </p>
                </div>
                <Button onClick={() => setShowCases(v => !v)} aria-expanded={showCases}>
                  {showCases ? "Hide" : "Inspect"} {evaluation.cases.length} cases <Icon name="chevron" size={15} />
                </Button>
              </div>
              {showCases && (
                <div className="mt-5 space-y-3">
                  {evaluation.cases.map(c => (
                    <div key={c.id} className="lv-well p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge>{c.id}</Badge>
                          <span className="text-sm font-medium">{c.label}</span>
                          {c.clean && <Badge tone="success">Clean reference</Badge>}
                        </div>
                        <span className="lv-muted font-mono text-xs">{c.latency_ms} ms</span>
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div>
                          <div className="lv-kicker mb-2">Expected</div>
                          <p className="lv-muted break-words font-mono text-xs leading-6">
                            {c.expected.join(", ") || "No issue labels"}
                          </p>
                        </div>
                        <div>
                          <div className="lv-kicker mb-2">Observed</div>
                          <p className="lv-muted break-words font-mono text-xs leading-6">
                            {c.observed.join(", ") || "No issue labels"}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </>
        ) : (
          <Empty title="No benchmark run in this session.">Run the benchmark to inspect measured results.</Empty>
        )}
      </section>
    </div>
  );
};
