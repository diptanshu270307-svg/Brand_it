import React, { useEffect, useState } from "react";
import { api, DraftDetail, Passport, PrivacyInfo } from "../api";
import { GovernanceOrbit } from "../components/GovernanceOrbit";
import { Badge, Button, formatDate, Icon, Notice, Panel } from "../components/ui";

interface Props {
  onOpenScreen: (screen: "library" | "review" | "vault" | "queue" | "insights") => void;
  onLaunchDraft: (draftId: number, persona?: string) => void;
  onLaunchStep: (stepIdx: number) => void;
  brandId?: number;
  privacy?: PrivacyInfo | null;
}
interface Counts { rules: number | null; sources: number | null; passports: number | null; drafts: number | null }

export const AppleIntro: React.FC<Props> = ({ onOpenScreen, onLaunchDraft, onLaunchStep, brandId, privacy }) => {
  const [counts, setCounts] = useState<Counts>({ rules: null, sources: null, passports: null, drafts: null });
  const [draft, setDraft] = useState<DraftDetail | null>(null);
  const [passports, setPassports] = useState<Passport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setCounts({ rules: null, sources: null, passports: null, drafts: null }); setDraft(null); setPassports([]); setError("");
    if (!brandId) return () => { active = false; };
    setLoading(true);
    Promise.allSettled([api.library(brandId), api.listEvidence(brandId), api.listDrafts(brandId)]).then(async ([library, evidence, drafts]) => {
      if (!active) return;
      setCounts({ rules: library.status === "fulfilled" ? library.value.rules.filter(r => r.status === "active").length : null, sources: library.status === "fulfilled" ? library.value.documents.length : null, passports: evidence.status === "fulfilled" ? evidence.value.filter(p => p.state === "current").length : null, drafts: drafts.status === "fulfilled" ? drafts.value.length : null });
      if (evidence.status === "fulfilled") setPassports(evidence.value);
      if ([library, evidence, drafts].some(r => r.status === "rejected")) setError("Some workspace data could not be loaded. Unavailable counts are shown as a dash.");
      if (drafts.status === "fulfilled") {
        const candidate = drafts.value.find(d => !d.seeded) || drafts.value[0];
        if (candidate) { try { const detail = await api.getDraft(brandId, candidate.id); if (active) setDraft(detail); } catch { if (active) setError("The draft preview is unavailable. Open the Review Desk to retry."); } }
      }
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [brandId]);
  const claim = draft?.findings.find(f => f.is_claim);
  const proof = claim?.passport || passports.find(p => p.state === "current") || passports[0];
  const problem = draft?.findings.find(f => !f.disposition && !(f.is_claim && f.evidence_status === "supported"));
  const previewText = draft?.text || "";
  const start = problem && problem.start >= 0 && problem.end <= previewText.length ? problem.start : -1;
  const proofTone = proof?.state === "current" ? "success" : proof?.state === "expired" || proof?.state === "rejected" ? "danger" : "warning";
  return <div className="space-y-12 pb-4 sm:space-y-16">
    <section className="grid items-center gap-10 pt-3 lg:grid-cols-[0.9fr_1.15fr] lg:gap-12 lg:py-8" aria-labelledby="keynote-title">
      <div className="max-w-2xl">
        <div className="mb-7 flex flex-wrap items-center gap-3"><Badge tone="accent"><Icon name="spark" size={12}/> THE BRAND GOVERNANCE DESK</Badge><span className="lv-muted font-mono text-[10px] uppercase tracking-[.12em]">Made for human judgment</span></div>
        <h1 id="keynote-title" className="font-display text-5xl font-medium leading-[1.04] tracking-[-0.055em] sm:text-6xl xl:text-[74px]">Your brand.<br/>Backed by <span className="lv-gradient-text">proof.</span></h1>
        <p className="lv-muted mt-6 max-w-lg text-base leading-8 sm:text-lg">Catch the claim before the campaign. Give your team clear findings, traceable evidence, and the final say.</p>
        <div className="mt-8 flex flex-wrap gap-3"><Button variant="primary" className="!min-h-12 !px-6 !text-sm" onClick={() => onOpenScreen("review")}>Open Review Desk <Icon name="arrow" size={17}/></Button><Button className="!min-h-12 !px-5 !text-sm" onClick={() => onLaunchStep(0)}><Icon name="review" size={16}/> Start judge walkthrough</Button></div>
        <div className="lv-muted mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs"><span className="inline-flex items-center gap-2"><Icon name="book" size={13}/> Versioned sources</span><span className="inline-flex items-center gap-2"><Icon name="shield" size={13}/> Evidence-linked findings</span><span className="inline-flex items-center gap-2"><Icon name="lock" size={13}/> Human sign-off</span></div>
        <div className="mt-9 grid grid-cols-3 gap-4 border-t border-line/70 pt-6">{[["Active rules", counts.rules], ["Current passports", counts.passports], ["Workspace drafts", counts.drafts]].map(([label, value]) => <div key={label}><div className="font-display text-3xl font-medium tracking-tight">{value ?? "—"}</div><div className="lv-muted mt-1.5 text-[11px]">{label}</div></div>)}</div>
        <p className="lv-muted mt-3 font-mono text-[9px] uppercase tracking-widest">Workspace counts · loaded from the API</p>
      </div>
      <div className="relative min-w-0">
        <div className="pointer-events-none absolute -inset-7 rounded-full bg-violet-500/10 blur-3xl" aria-hidden="true"/>
        <div className="relative">
          <GovernanceOrbit mode="hero" activeScreen="intro" onNavigate={onOpenScreen} />
        </div>
      </div>
    </section>
    {error && <Notice tone="warning">{error}</Notice>}
    <section className="relative" aria-label="Live workspace preview">
      <Panel className="relative overflow-hidden !rounded-3xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/70 px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="lv-dot lv-text-accent"/>
            <span className="font-mono text-[10px] uppercase tracking-widest">Workspace preview · Live draft &amp; linked evidence</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={privacy?.hosted ? "success" : "neutral"}>{privacy ? privacy.hosted ? "Live AI" : "Offline Verifier" : "Provider pending"}</Badge>
            <Button variant="ghost" className="!min-h-8 !px-3 !py-1" onClick={() => draft ? onLaunchDraft(draft.id) : onOpenScreen("review")}>Inspect this draft <Icon name="arrow" size={14}/></Button>
          </div>
        </div>
        <div className="grid items-stretch gap-5 p-5 sm:p-6 lg:grid-cols-[1.15fr_auto_1fr]">
          <div className="flex flex-col space-y-3">
            <div className="flex items-center justify-between gap-3"><span className="lv-eyebrow">01 / Draft under review</span>{draft && <Badge>Revision {draft.revision}</Badge>}</div>
            <div className="lv-well flex flex-1 flex-col justify-between p-5 sm:p-6">
              <div>
                <div className="mb-4 flex flex-wrap items-center gap-2"><Badge>{draft?.channel || "Draft canvas"}</Badge>{draft?.seeded && <Badge>Sample draft</Badge>}{draft && <span className="lv-muted ml-auto font-mono text-[10px]">{draft.status.replace(/_/g, " ")}</span>}</div>
                <h2 className="font-display text-lg font-medium">{draft?.title || (loading ? "Loading your workspace…" : "Your next draft starts here.")}</h2>
                <div className="mt-4 whitespace-pre-wrap text-sm leading-8">{draft ? start >= 0 && problem ? <>{previewText.slice(0, start)}<mark className="rounded-md border-b border-amber-400/40 bg-amber-400/10 px-0.5 text-[var(--lv-warning)]">{previewText.slice(start, problem.end)}</mark>{previewText.slice(problem.end)}</> : previewText : <span className="lv-muted">Open the Review Desk to submit a draft and inspect its actual findings.</span>}</div>
              </div>
              {draft?.analysis && <div className="lv-muted mt-5 flex flex-wrap items-center gap-3 border-t border-line/60 pt-4 font-mono text-[10px]"><span>Checked revision {draft.revision}</span><span>{draft.analysis.provider}</span><span>{draft.blockers.length} approval blockers</span></div>}
            </div>
          </div>
          <div className="flex items-center justify-center text-muted" aria-hidden="true">
            <span className="lg:hidden"><Icon name="chevron" size={18}/></span>
            <span className="hidden rounded-full border border-line/70 bg-well/80 p-2.5 lg:inline-flex"><Icon name="arrow" size={16}/></span>
          </div>
          <div className="flex flex-col space-y-3">
            <div className="flex items-center justify-between gap-3"><span className="lv-eyebrow">02 / Source provenance</span>{proof && <Badge tone={proofTone}>{proof.state.replace(/_/g, " ")}</Badge>}</div>
            <div className="flex flex-1 flex-col justify-between rounded-2xl border border-violet-400/20 bg-violet-400/[0.04] p-5 sm:p-6">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-3"><span className="inline-flex items-center gap-2 text-sm font-medium"><Icon name="shield" size={16}/> {claim?.passport ? "Linked evidence passport" : "From your Evidence Vault"}</span>{proof && <span className="lv-text-accent font-mono text-xs">{proof.ref}</span>}</div>
                {proof ? <>
                  <p className="mt-4 text-sm leading-7">“{proof.excerpt}”</p>
                  <div className="lv-muted mt-4 flex flex-wrap gap-x-4 gap-y-2 font-mono text-[10px]"><span>{proof.document.title} · v{proof.document.version} · p.{proof.page}</span><span>Valid until {formatDate(proof.valid_until)}</span></div>
                  {!claim?.passport && <p className="lv-muted mt-3 text-[11px] leading-5">Vault preview only; this source has not been linked to the draft on the left.</p>}
                </> : <p className="lv-muted mt-3 text-sm leading-6">A passport shows the exact source, owner, version and validity date. No evidence loaded yet.</p>}
              </div>
              <div className="lv-muted mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line/50 pt-4 text-[11px]"><span className="inline-flex items-center gap-2"><Icon name="lock" size={13}/> Approval stays with a human.</span><button type="button" className="bg-transparent p-0 font-mono text-[11px] text-[var(--lv-accent)] hover:underline" onClick={() => onOpenScreen("vault")}>Open Evidence Vault →</button></div>
            </div>
          </div>
        </div>
      </Panel>
    </section>
    <section aria-labelledby="capabilities-title">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-5"><div><div className="lv-eyebrow mb-3">A considered review, from source to sign-off</div><h2 id="capabilities-title" className="font-display text-3xl font-medium tracking-[-0.03em]">More clarity. At every decision.</h2></div><p className="lv-muted max-w-sm text-sm leading-6">One shared workspace for the people creating content and the people accountable for it.</p></div>
      <div className="grid items-stretch gap-5 md:grid-cols-3">
        <Panel className="flex flex-col p-6 sm:p-7"><span className="mb-7 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-indigo-400/20 bg-indigo-400/10 text-[var(--lv-accent)]"><Icon name="shield" size={22}/></span><div className="lv-eyebrow mb-3">Evidence passports</div><h3 className="font-display text-xl font-medium leading-7">A claim should come<br/>with a source.</h3><p className="lv-muted mb-6 mt-4 grow text-sm leading-7">Inspect verbatim proof, ownership and expiry. See when evidence supports a finding and when it still needs review.</p><Button className="self-start" onClick={() => onOpenScreen("vault")}>Inspect the vault <Icon name="arrow" size={14}/></Button></Panel>
        <Panel className="flex flex-col p-6 sm:p-7"><span className="mb-7 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-fuchsia-400/20 bg-fuchsia-400/10 text-[var(--lv-accent)]"><Icon name="radar" size={22}/></span><div className="lv-eyebrow mb-3">Evidence recall radar</div><h3 className="font-display text-xl font-medium leading-7">Evidence changes.<br/>Know what depends on it.</h3><p className="lv-muted mb-6 mt-4 grow text-sm leading-7">Scan approved drafts for linked passports that are no longer current. Inspect affected content before the next decision.</p><Button className="self-start" onClick={() => onOpenScreen("vault")}>Open Recall Radar <Icon name="arrow" size={14}/></Button></Panel>
        <Panel className="flex flex-col p-6 sm:p-7"><span className="mb-7 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-violet-400/20 bg-violet-400/10 text-[var(--lv-accent)]"><Icon name="chart" size={22}/></span><div className="lv-eyebrow mb-3">Guideline health</div><h3 className="font-display text-xl font-medium leading-7">Disagreement can make<br/>the rulebook clearer.</h3><p className="lv-muted mb-6 mt-4 grow text-sm leading-7">Explore override reasons, compare proposed wording, and publish a new version only after a Brand Owner approves.</p><Button className="self-start" onClick={() => onOpenScreen("insights")}>Explore rule feedback <Icon name="arrow" size={14}/></Button></Panel>
      </div>
    </section>
    <Panel className="relative overflow-hidden p-7 sm:p-10"><div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-violet-500/[0.06] to-transparent" aria-hidden="true"/><div className="relative flex flex-wrap items-center justify-between gap-6"><div><div className="lv-eyebrow mb-3">Put it to the test</div><h2 className="font-display text-2xl font-medium tracking-tight sm:text-3xl">Bring a claim we haven't seen.</h2><p className="lv-muted mt-3 max-w-xl text-sm leading-7">Inspect the finding. Challenge the source. Review the edit. The judge walkthrough takes you through the actual workspace.</p></div><Button variant="primary" className="!min-h-12 !px-6" onClick={() => onLaunchStep(0)}>Start with an unfamiliar claim <Icon name="arrow" size={16}/></Button></div></Panel>
  </div>;
};
