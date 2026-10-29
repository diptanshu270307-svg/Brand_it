import React, { useEffect, useState } from "react";
import { api, BrandInfo, DEMO_USERS, DraftDetail, getToken, PrivacyInfo, setToken, UserInfo } from "./api";
import { BrandLibrary } from "./screens/BrandLibrary";
import { DraftReview } from "./screens/DraftReview";
import { EvidenceVault } from "./screens/EvidenceVault";
import { Insights } from "./screens/Insights";
import { ReviewQueue } from "./screens/ReviewQueue";
import { AppleIntro } from "./screens/AppleIntro";
import { Loader } from "./components/Loader";
import { GovernanceOrbit } from "./components/GovernanceOrbit";
import { Badge, Button, Icon, Modal, Notice, errorText } from "./components/ui";

type Screen = "intro" | "review" | "vault" | "queue" | "insights" | "library";
const TABS: { id: Screen; label: string; icon: string }[] = [
  { id: "intro", label: "Keynote", icon: "spark" }, { id: "review", label: "Draft Review", icon: "file" },
  { id: "vault", label: "Evidence Vault & Recall", icon: "radar" }, { id: "queue", label: "Review Queue", icon: "review" },
  { id: "insights", label: "Guideline Health", icon: "chart" }, { id: "library", label: "Brand Library", icon: "book" },
];
const STEPS = ["Unfamiliar claim", "Inspect 5-dim proof", "Verified fix", "Human sign-off", "Revoke & recall"];

export const App: React.FC = () => {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [brand, setBrand] = useState<BrandInfo | null>(null);
  const [privacy, setPrivacy] = useState<PrivacyInfo | null>(null);
  const [screen, setScreen] = useState<Screen>("intro");
  const [selectedDraftId, setSelectedDraftId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [switching, setSwitching] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showWalkthrough, setShowWalkthrough] = useState(true);
  const [showOrbit, setShowOrbit] = useState(false);
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const [showReset, setShowReset] = useState(false);
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem("brandlint_theme") === "light" ? "light" : "dark"; } catch { return "dark"; } });
  useEffect(() => { document.documentElement.dataset.theme = theme; try { localStorage.setItem("brandlint_theme", theme); } catch { /* Session theme still works. */ } }, [theme]);
  const bootstrap = async (email?: string) => {
    setError(""); setSwitching(true);
    try {
      if (email || !getToken()) { const login = await api.login(email || DEMO_USERS[0].email); setToken(login.token); }
      let me;
      try { me = await api.me(); }
      catch (e) {
        if (email || !(e instanceof Error) || !("status" in e) || e.status !== 401) throw e;
        const login = await api.login(DEMO_USERS[0].email); setToken(login.token); me = await api.me();
      }
      setUser(me.user); setBrand(me.brands[0] || null); setPrivacy(me.privacy);
      if (!me.brands.length) setError("This account has no brand workspace. Choose another demo role.");
      return me;
    } catch (e) { setError(errorText(e)); return null; }
    finally { setSwitching(false); }
  };
  useEffect(() => { void bootstrap(); }, []);
  const switchPersona = async (email: string) => { const me = await bootstrap(email); if (me) setRefresh(v => v + 1); return me; };
  const navigate = (next: Screen) => { setScreen(next); window.scrollTo({ top: 0 }); };
  const openDraft = (id: number) => { setSelectedDraftId(id); navigate("review"); };
  const independentReviewer = async (senior: boolean, draft?: DraftDetail) => {
    const eligible = DEMO_USERS.filter(persona => senior
      ? ["senior_reviewer", "brand_owner"].includes(persona.badge)
      : ["reviewer", "senior_reviewer", "brand_owner"].includes(persona.badge));
    const candidate = eligible.find(persona => persona.label !== draft?.author);
    if (!candidate) { setError("No independent demo reviewer is available for this route."); return null; }
    const me = await switchPersona(candidate.email);
    if (me && draft && me.user.id === draft.author_id) { setError("Choose an independent reviewer. Authors cannot approve their own drafts."); return null; }
    return me;
  };
  const switchReviewer = async (senior = false) => {
    try { const draft = brand && selectedDraftId ? await api.getDraft(brand.id, selectedDraftId) : undefined; await independentReviewer(senior, draft); }
    catch (e) { setError(errorText(e)); }
  };
  const openRecalledDraft = async (id: number) => {
    if (!brand) return;
    try {
      const draft = await api.getDraft(brand.id, id);
      if (!draft.can_edit) {
        const author = DEMO_USERS.find(persona => persona.label === draft.author);
        if (author) { const me = await switchPersona(author.email); if (!me || me.user.id !== draft.author_id) return; }
      }
      openDraft(id);
    } catch (e) { setError(errorText(e)); }
  };
  const openQueue = async (id: number) => {
    if (!brand) return;
    try {
      const d = await api.getDraft(brand.id, id);
      const me = await independentReviewer(d.route === "senior" || d.computed_route === "senior", d);
      if (me) { setSelectedDraftId(id); navigate("queue"); }
    } catch (e) { setError(errorText(e)); }
  };
  const walk = async (step: number) => {
    setActiveStep(step);
    if (step === 4) { const me = await switchPersona("olivia@lumina.demo"); if (me) navigate("vault"); }
    else if (step === 3 && selectedDraftId) await openQueue(selectedDraftId);
    else if (step === 3) { await switchReviewer(); navigate("queue"); }
    else { const me = await switchPersona("casey@lumina.demo"); if (me) navigate("review"); }
  };
  const ready = !!user && !!brand;
  return <>
    <Loader ready={ready || !!error}/>
    <div className="lustro-app">
      <a href="#workspace" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[1100] focus:rounded-xl focus:bg-surface focus:p-3">Skip to workspace</a>
      <header className="sticky top-0 z-40 border-b border-line/60 bg-well/80 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-[1800px] items-center gap-3 px-4 py-3 lg:gap-5 lg:px-7">
          <button type="button" onClick={() => navigate("intro")} className="flex shrink-0 items-center gap-2.5 border-0 bg-transparent p-0 text-ink" aria-label="BrandLint keynote"><span className="lv-logo"><span><Icon name="shield" size={19}/></span></span><span className="hidden font-display text-base font-semibold tracking-tight sm:block">BrandLint<span className="lv-muted ml-1 text-xs font-normal">/</span></span></button>
          <nav aria-label="Workspaces" className="lv-studio-scroll flex min-w-0 flex-1 items-center gap-1 overflow-x-auto py-1">{TABS.map(t => <button type="button" key={t.id} onClick={() => navigate(t.id)} className="lv-nav-tab" aria-current={screen === t.id ? "page" : undefined}><Icon name={t.icon} size={13}/>{t.label}</button>)}</nav>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={() => setShowPrivacy(true)} className="border-0 bg-transparent p-0" aria-label={`View AI processing details: ${privacy?.hosted ? "Live AI" : "Offline verifier"}`}><Badge tone={privacy?.hosted ? "success" : "warning"} className="!px-2"><span className="lv-dot"/><span className="hidden xl:inline">{privacy ? privacy.hosted ? "Live AI" : privacy.provider === "mock" ? "Offline verifier" : "Provider unavailable" : "Connecting"}</span></Badge></button>
            <Button variant="ghost" onClick={() => setTheme(t => t === "dark" ? "light" : "dark")} aria-label={`Switch to ${theme === "dark" ? "Daylight" : "Lustro Velvet"} theme`} title={theme === "dark" ? "Daylight" : "Lustro Velvet"} className="!h-9 !min-h-9 !px-2.5"><Icon name={theme === "dark" ? "sun" : "moon"} size={16}/></Button>
            <label className="relative"><span className="sr-only">Demo role</span><select className="lv-input !w-[108px] !rounded-full !py-2 !text-xs sm:!w-[144px]" value={user?.email || ""} disabled={switching} onChange={e => { void switchPersona(e.target.value); }}><option value="" disabled>Choose role</option>{DEMO_USERS.map(u => <option key={u.email} value={u.email}>{u.label.split(" ")[0]} · {u.role}</option>)}</select></label>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-[1800px] px-4 lg:px-7">
        <div className="flex min-h-11 flex-wrap items-center justify-between gap-2 border-b border-line/50 py-2">
          <div className="flex flex-wrap items-center gap-4">
            <button type="button" className="flex items-center gap-2 border-0 bg-transparent p-0 text-muted hover:text-ink" onClick={() => setShowWalkthrough(v => !v)} aria-expanded={showWalkthrough} aria-controls="judge-walkthrough"><Icon name="spark" size={13}/><span className="font-mono text-[10px] uppercase tracking-widest">60-second judge walkthrough</span><Icon name="chevron" size={12} className={showWalkthrough ? "rotate-180" : ""}/></button>
            {screen !== "intro" && <button type="button" className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition ${showOrbit ? "border-violet-400/45 bg-violet-400/15 text-ink" : "border-line/70 bg-transparent text-muted hover:text-ink"}`} onClick={() => setShowOrbit(v => !v)} aria-expanded={showOrbit} aria-controls="workspace-orbit-guide"><Icon name="radar" size={12}/><span>Visual guide</span></button>}
          </div>
          <div className="flex items-center gap-3"><span className="hidden text-[10px] text-muted sm:inline">{brand?.name || "Workspace"} <span className="mx-1 text-muted/40">/</span> Human decisions. Traceable proof.</span><button type="button" onClick={() => setShowReset(true)} disabled={!ready || switching} className="flex items-center gap-1 border-0 bg-transparent p-0 text-[10px] text-muted hover:text-ink"><Icon name="refresh" size={11}/>Reset demo</button></div>
        </div>
        {showWalkthrough && <div id="judge-walkthrough" className="lv-studio-scroll flex gap-2 overflow-x-auto py-3">{STEPS.map((s, i) => <button type="button" key={s} onClick={() => { void walk(i); }} disabled={!ready || switching} className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] ${activeStep === i ? "border-violet-400/40 bg-violet-400/10 text-ink" : "border-line/70 bg-transparent text-muted hover:text-ink"}`}><span className={`grid h-5 w-5 place-items-center rounded-full font-mono text-[9px] ${activeStep === i ? "bg-violet-400/20 text-[var(--lv-accent)]" : "bg-surface"}`}>{String(i + 1).padStart(2,"0")}</span>{s}{i < STEPS.length - 1 && <Icon name="arrow" size={11}/>}</button>)}</div>}
        {screen !== "intro" && showOrbit && <div id="workspace-orbit-guide" className="pt-3"><GovernanceOrbit mode="compact" activeScreen={screen} onClose={() => setShowOrbit(false)} /></div>}
      </div>
      {error && <div className="mx-auto max-w-[1800px] px-4 py-4 lg:px-7"><Notice tone="danger"><div className="flex flex-wrap items-center justify-between gap-3"><span>{error}</span><Button onClick={() => { void bootstrap(); }}>Retry connection</Button></div></Notice></div>}
      <main id="workspace" tabIndex={-1} className="mx-auto max-w-[1800px] px-4 pb-12 pt-6 outline-none sm:pt-8 lg:px-7" key={`${brand?.id}-${refresh}`}>
        {ready && brand && user && <div className="lv-enter" key={screen}>
          {screen === "intro" && <AppleIntro brandId={brand.id} privacy={privacy} onOpenScreen={navigate} onLaunchDraft={(id, persona) => { if (persona) { void switchPersona(persona).then(me => { if (me) openDraft(id); }); } else openDraft(id); }} onLaunchStep={i => { void walk(i); }}/ >}
          {screen === "review" && <DraftReview brandId={brand.id} role={brand.role} selectedDraftId={selectedDraftId} onSelectDraft={setSelectedDraftId} onOpenQueue={id => { void openQueue(id); }}/ >}
          {screen === "vault" && <EvidenceVault brandId={brand.id} role={brand.role} onOpenDraft={id => { void openRecalledDraft(id); }}/ >}
          {screen === "queue" && <ReviewQueue brandId={brand.id} role={brand.role} selectedDraftId={selectedDraftId} onSelectDraft={setSelectedDraftId} onOpenEditor={openDraft} onSwitchReviewer={senior => { void switchReviewer(senior); }}/ >}
          {screen === "insights" && <Insights brandId={brand.id} role={brand.role}/ >}
          {screen === "library" && <BrandLibrary brandId={brand.id} role={brand.role}/ >}
        </div>}
      </main>
      <footer className="mx-auto max-w-[1800px] px-4 pb-10 pt-2 lg:px-7">
        <div className="lv-footer-shell">
          <div className="flex flex-col justify-between gap-6 p-6 sm:p-7 lg:flex-row lg:items-center">
            <div className="max-w-lg">
              <div className="flex flex-wrap items-center gap-2.5">
                <button type="button" onClick={() => navigate("intro")} className="inline-flex items-center gap-2.5 bg-transparent p-0 text-ink" aria-label="Return to BrandLint keynote">
                  <span className="lv-logo"><span><Icon name="shield" size={18}/></span></span>
                  <span className="font-display text-lg font-semibold tracking-tight">BrandLint</span>
                </button>
                <Badge tone="accent">Governance Studio</Badge>
              </div>
              <p className="lv-muted mt-2.5 text-xs leading-6">
                Spell-check for your brand. Every promotional claim grounded in traceable proof — humans make the final call.
              </p>
            </div>
            <nav aria-label="Footer workspaces" className="flex flex-col gap-2.5 lg:items-end">
              <span className="lv-kicker">Explore workspaces</span>
              <div className="flex flex-wrap gap-2 lg:justify-end">
                <button type="button" className="lv-footer-link" aria-current={screen === "review" ? "page" : undefined} onClick={() => navigate("review")}><Icon name="file" size={13}/>Draft Review</button>
                <button type="button" className="lv-footer-link" aria-current={screen === "vault" ? "page" : undefined} onClick={() => navigate("vault")}><Icon name="radar" size={13}/>Evidence Vault</button>
                <button type="button" className="lv-footer-link" aria-current={screen === "queue" ? "page" : undefined} onClick={() => navigate("queue")}><Icon name="review" size={13}/>Human Review</button>
                <button type="button" className="lv-footer-link" aria-current={screen === "insights" ? "page" : undefined} onClick={() => navigate("insights")}><Icon name="chart" size={13}/>Measured Benchmark</button>
                <button type="button" className="lv-footer-link" aria-current={screen === "library" ? "page" : undefined} onClick={() => navigate("library")}><Icon name="book" size={13}/>Brand Library</button>
              </div>
            </nav>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line/55 bg-well/40 px-6 py-3.5 sm:px-7">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
              <span className="inline-flex items-center gap-1.5 text-ink/90"><Icon name="lock" size={12} className="lv-text-accent"/>Zero autonomous sign-off · Independent human approval</span>
              {brand && <span className="text-muted/80">· {brand.name} ({brand.role.replace(/_/g, " ")})</span>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="lv-footer-status" onClick={() => setShowPrivacy(true)}>
                <span className={`lv-dot ${privacy?.hosted ? "text-[var(--lv-success)]" : "text-[var(--lv-warning)]"}`}/>
                <span>{privacy ? (privacy.hosted ? `Live AI · ${privacy.provider}` : `Offline verifier · ${privacy.provider}`) : "Connecting"} · Processing & privacy</span>
                <Icon name="arrow" size={11}/>
              </button>
              <button type="button" className="lv-footer-status" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="Scroll back to top">
                <Icon name="chevron" size={12} className="rotate-180"/>
                <span>Top</span>
              </button>
            </div>
          </div>
        </div>
      </footer>
      {showPrivacy && <Modal title="Processing & privacy" onClose={() => setShowPrivacy(false)}><div className="space-y-5"><Badge tone={privacy?.hosted ? "success" : "warning"}>{privacy?.hosted ? "Hosted AI processing" : "Local verification"} · {privacy?.provider || "Unknown"}</Badge><p className="text-sm leading-7">{privacy?.notice || "Processing information is unavailable. Reconnect before submitting confidential content."}</p><Notice>Offline checks demonstrate the workflow. They do not establish factual truth or comprehensive claim detection. Source matches and human decisions remain visible.</Notice></div></Modal>}
      {showReset && <Modal title="Reset the demo workspace?" onClose={() => setShowReset(false)}><p className="lv-muted mb-6 text-sm leading-6">This replaces demo drafts, evidence decisions and review history with the original sample data.</p><div className="flex justify-end gap-2"><Button onClick={() => setShowReset(false)}>Cancel</Button><Button variant="danger" disabled={switching} onClick={async () => { setSwitching(true); try { await api.resetDemo(); await switchPersona(DEMO_USERS[0].email); setSelectedDraftId(null); navigate("review"); setShowReset(false); setActiveStep(null); } catch (e) { setError(errorText(e)); } finally { setSwitching(false); } }}>Reset sample data</Button></div></Modal>}
    </div>
  </>;
};
