import React, { useEffect, useState } from "react";
import {
  api,
  BrandInfo,
  CompanyInfo,
  CompanyInvitationItem,
  CompanyMember,
  DEMO_USERS,
  DraftDetail,
  InvitationDetails,
  PrivacyInfo,
  RoleExplanation,
  SystemModeInfo,
  UserInfo,
} from "./api";
import { BrandLibrary } from "./screens/BrandLibrary";
import { DraftReview } from "./screens/DraftReview";
import { EvidenceVault } from "./screens/EvidenceVault";
import { Insights } from "./screens/Insights";
import { ReviewQueue } from "./screens/ReviewQueue";
import { AppleIntro } from "./screens/AppleIntro";
import { Loader } from "./components/Loader";
import { GovernanceOrbit } from "./components/GovernanceOrbit";
import { Badge, Button, Icon, Modal, Notice, StatusAnnouncer, errorText } from "./components/ui";

type Screen = "intro" | "review" | "vault" | "queue" | "insights" | "library";
const TABS: { id: Screen; label: string; icon: string }[] = [
  { id: "intro", label: "Home", icon: "spark" },
  { id: "review", label: "Check content", icon: "file" },
  { id: "vault", label: "Approved facts", icon: "radar" },
  { id: "queue", label: "Approvals", icon: "review" },
  { id: "library", label: "Brand rules", icon: "book" },
  { id: "insights", label: "Insights", icon: "chart" },
];
const STEPS = ["Paste claim", "Inspect proof", "Apply fix", "Human approval", "Check outdated claims"];

export const App: React.FC = () => {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [brand, setBrand] = useState<BrandInfo | null>(null);
  const [companies, setCompanies] = useState<CompanyInfo[]>([]);
  const [activeCompany, setActiveCompany] = useState<CompanyInfo | null>(null);
  const [roles, setRoles] = useState<Record<string, RoleExplanation>>({});
  const [privacy, setPrivacy] = useState<PrivacyInfo | null>(null);
  const [systemMode, setSystemMode] = useState<SystemModeInfo | null>(null);
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
  const [authView, setAuthView] = useState<"login" | "register" | "workspace" | "forgot" | "reset" | null>(null);
  const [authName, setAuthName] = useState("");
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [newBrandName, setNewBrandName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authResetToken, setAuthResetToken] = useState("");
  const [authMsg, setAuthMsg] = useState("");
  const [authBusy, setAuthBusy] = useState(false);

  // Workspace & Team Administration State
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [teamTab, setTeamTab] = useState<"members" | "invite" | "settings" | "roles">("members");
  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [invitations, setInvitations] = useState<CompanyInvitationItem[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("creator");
  const [inviteResult, setInviteResult] = useState<string | null>(null);
  const [teamBusy, setTeamBusy] = useState(false);
  const [teamMsg, setTeamMsg] = useState("");
  const [companyNameEdit, setCompanyNameEdit] = useState("");

  // Invitation Acceptance State
  const [inviteToken, setInviteToken] = useState("");
  const [inviteDetails, setInviteDetails] = useState<InvitationDetails | null>(null);
  const [showAcceptInvite, setShowAcceptInvite] = useState(false);
  const [acceptName, setAcceptName] = useState("");
  const [acceptPassword, setAcceptPassword] = useState("");

  const [theme, setTheme] = useState(() => { try { return localStorage.getItem("brandlint_theme") === "light" ? "light" : "dark"; } catch { return "dark"; } });
  useEffect(() => { document.documentElement.dataset.theme = theme; try { localStorage.setItem("brandlint_theme", theme); } catch { /* Session theme still works. */ } }, [theme]);

  // Check for recovery token or invitation token in URL fragment on initial load
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (window.location.hash.startsWith("#reset-token=")) {
        const token = window.location.hash.slice("#reset-token=".length);
        if (token) {
          setAuthResetToken(token);
          setAuthView("reset");
        }
      } else if (window.location.hash.startsWith("#invite-token=")) {
        const token = window.location.hash.slice("#invite-token=".length);
        if (token) {
          setInviteToken(token);
          void api.inspectInvitation(token).then(details => {
            setInviteDetails(details);
            setShowAcceptInvite(true);
          }).catch(err => {
            setError(errorText(err));
          });
        }
      }
    }
  }, []);

  const bootstrap = async (email?: string, forceAutoDemo = false) => {
    setError(""); setSwitching(true);
    try {
      const modeInfo = await api.getSystemMode().catch(() => null);
      if (modeInfo) setSystemMode(modeInfo);

      const isProd = modeInfo?.is_production ?? false;
      if (email) {
        if (!isProd && email.endsWith(".demo")) {
          await api.demoSwitch(email);
        } else {
          await api.login(email);
        }
      }

      let me;
      try {
        me = await api.me();
      } catch (e) {
        if (!(e instanceof Error) || !("status" in e) || e.status !== 401) throw e;
        if (!isProd && forceAutoDemo) {
          await api.demoSwitch(DEMO_USERS[0].email).catch(() => api.login(DEMO_USERS[0].email));
          me = await api.me();
        } else {
          setUser(null);
          setBrand(null);
          setActiveCompany(null);
          setCompanies([]);
          setAuthView("login");
          return null;
        }
      }
      setUser(me.user);
      setCompanies(me.companies || []);
      setRoles(me.roles || {});

      const userCompanies = me.companies || [];
      if (userCompanies.length) {
        const currentCo = userCompanies.find(c => c.id === activeCompany?.id) || userCompanies[0];
        setActiveCompany(currentCo);
        if (currentCo.brands && currentCo.brands.length) {
          setBrand(currentCo.brands[0]);
        } else {
          setBrand(me.brands[0] || null);
        }
      } else {
        setActiveCompany(null);
        setBrand(me.brands[0] || null);
      }
      setPrivacy(me.privacy);
      if (!me.brands.length && !userCompanies.length) {
        setAuthMsg("");
        if (!showAcceptInvite) setAuthView("workspace");
      }
      return me;
    } catch (e) { setError(errorText(e)); return null; }
    finally { setSwitching(false); }
  };
  useEffect(() => { void bootstrap(undefined, true); }, []);

  const handleLogout = async () => {
    setSwitching(true);
    try {
      await api.logout();
      setUser(null);
      setBrand(null);
      setActiveCompany(null);
      setCompanies([]);
      setSelectedDraftId(null);
      setAuthView("login");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSwitching(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthMsg("");
    setAuthBusy(true);
    try {
      await api.login(authEmail.trim(), authPassword);
      setAuthView(null);
      setAuthPassword("");
      setSelectedDraftId(null);
      await bootstrap();
    } catch (err) {
      setAuthMsg(errorText(err));
    } finally {
      setAuthBusy(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthMsg("");
    setAuthBusy(true);
    try {
      await api.register(authName.trim(), authEmail.trim(), authPassword);
      setAuthView(null);
      setAuthPassword("");
      setSelectedDraftId(null);
      await bootstrap();
    } catch (err) {
      setAuthMsg(errorText(err));
    } finally {
      setAuthBusy(false);
    }
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthMsg("");
    setAuthBusy(true);
    try {
      await api.createCompany(newWorkspaceName.trim(), newBrandName.trim() || undefined);
      setAuthView(null);
      setNewWorkspaceName("");
      setNewBrandName("");
      setSelectedDraftId(null);
      await bootstrap();
      setScreen("library");
    } catch (err) {
      setAuthMsg(errorText(err));
    } finally {
      setAuthBusy(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthMsg("");
    setAuthBusy(true);
    try {
      const res = await api.forgotPassword(authEmail.trim());
      setAuthMsg(res.message);
    } catch (err) {
      setAuthMsg(errorText(err));
    } finally {
      setAuthBusy(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthMsg("");
    setAuthBusy(true);
    try {
      const res = await api.resetPassword(authResetToken.trim(), authPassword);
      setAuthMsg(res.message);
      if (typeof window !== "undefined") {
        window.history.replaceState(null, "", window.location.pathname);
      }
      setTimeout(() => {
        setAuthView("login");
        setAuthPassword("");
      }, 1500);
    } catch (err) {
      setAuthMsg(errorText(err));
    } finally {
      setAuthBusy(false);
    }
  };

  const switchWorkspace = (companyId: number) => {
    const target = companies.find(c => c.id === companyId);
    if (!target) return;
    setActiveCompany(target);
    if (target.brands && target.brands.length) {
      setBrand(target.brands[0]);
    }
    setRefresh(v => v + 1);
  };

  const openTeamModal = async () => {
    if (!activeCompany) return;
    setShowTeamModal(true);
    setTeamTab("members");
    setTeamMsg("");
    setInviteResult(null);
    setCompanyNameEdit(activeCompany.name);
    await loadTeamData(activeCompany.id);
  };

  const loadTeamData = async (companyId: number) => {
    setTeamBusy(true);
    try {
      const [memList, invList] = await Promise.all([
        api.getCompanyMembers(companyId).catch(() => []),
        api.getInvitations(companyId).catch(() => []),
      ]);
      setMembers(memList);
      setInvitations(invList);
    } catch (e) {
      setTeamMsg(errorText(e));
    } finally {
      setTeamBusy(false);
    }
  };

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCompany) return;
    setTeamBusy(true);
    setTeamMsg("");
    setInviteResult(null);
    try {
      const res = await api.createInvitation(activeCompany.id, inviteEmail.trim(), inviteRole);
      setInviteResult(res.invite_url);
      setInviteEmail("");
      await loadTeamData(activeCompany.id);
    } catch (err) {
      setTeamMsg(errorText(err));
    } finally {
      setTeamBusy(false);
    }
  };

  const handleRoleChange = async (userId: number, newRole: string) => {
    if (!activeCompany) return;
    setTeamBusy(true);
    setTeamMsg("");
    try {
      await api.updateMemberRole(activeCompany.id, userId, newRole);
      await loadTeamData(activeCompany.id);
      if (userId === user?.id) {
        await bootstrap();
      }
    } catch (err) {
      setTeamMsg(errorText(err));
    } finally {
      setTeamBusy(false);
    }
  };

  const handleRemoveMember = async (userId: number) => {
    if (!activeCompany || !window.confirm("Are you sure you want to remove this member from the workspace?")) return;
    setTeamBusy(true);
    setTeamMsg("");
    try {
      await api.removeMember(activeCompany.id, userId);
      await loadTeamData(activeCompany.id);
    } catch (err) {
      setTeamMsg(errorText(err));
    } finally {
      setTeamBusy(false);
    }
  };

  const handleRevokeInvitation = async (invitationId: number) => {
    if (!activeCompany) return;
    setTeamBusy(true);
    setTeamMsg("");
    try {
      await api.revokeInvitation(activeCompany.id, invitationId);
      await loadTeamData(activeCompany.id);
    } catch (err) {
      setTeamMsg(errorText(err));
    } finally {
      setTeamBusy(false);
    }
  };

  const handleUpdateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCompany) return;
    setTeamBusy(true);
    setTeamMsg("");
    try {
      const updated = await api.updateCompany(activeCompany.id, { name: companyNameEdit.trim() });
      setActiveCompany(prev => (prev ? { ...prev, name: updated.name } : null));
      setCompanies(prev => prev.map(c => (c.id === activeCompany.id ? { ...c, name: updated.name } : c)));
      setTeamMsg("Workspace settings updated successfully.");
    } catch (err) {
      setTeamMsg(errorText(err));
    } finally {
      setTeamBusy(false);
    }
  };

  const handleAcceptInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthBusy(true);
    setAuthMsg("");
    try {
      await api.acceptInvitation(inviteToken.trim(), acceptName.trim() || undefined, acceptPassword || undefined);
      setShowAcceptInvite(false);
      setInviteToken("");
      if (typeof window !== "undefined") {
        window.history.replaceState(null, "", window.location.pathname);
      }
      await bootstrap();
    } catch (err) {
      setAuthMsg(errorText(err));
    } finally {
      setAuthBusy(false);
    }
  };
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
      <StatusAnnouncer message={error || authMsg || teamMsg || null} />
      <a href="#workspace" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[1100] focus:rounded-xl focus:bg-surface focus:p-3">Skip to workspace</a>
      <header className="sticky top-0 z-40 border-b border-line/60 bg-well/80 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-[1800px] items-center gap-3 px-4 py-3 lg:gap-5 lg:px-7">
          <button type="button" onClick={() => navigate("intro")} className="flex shrink-0 items-center gap-2.5 border-0 bg-transparent p-0 text-ink" aria-label="BrandLint keynote"><span className="lv-logo"><span><Icon name="shield" size={19}/></span></span><span className="hidden font-display text-base font-semibold tracking-tight sm:block">BrandLint<span className="lv-muted ml-1 text-xs font-normal">/</span></span></button>
          <nav aria-label="Workspaces" className="lv-studio-scroll flex min-w-0 flex-1 items-center gap-1 overflow-x-auto py-1">{TABS.map(t => <button type="button" key={t.id} onClick={() => navigate(t.id)} className="lv-nav-tab" aria-current={screen === t.id ? "page" : undefined}><Icon name={t.icon} size={13}/>{t.label}</button>)}</nav>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={() => setShowPrivacy(true)} className="border-0 bg-transparent p-0" aria-label={`View AI processing details: ${privacy?.hosted ? "Live AI" : "Offline verifier"}`}><Badge tone={privacy?.hosted ? "success" : "warning"} className="!px-2"><span className="lv-dot"/><span className="hidden xl:inline">{privacy ? privacy.hosted ? "Live AI" : privacy.provider === "mock" ? "Offline verifier" : "Provider unavailable" : "Connecting"}</span></Badge></button>
            <Button variant="ghost" onClick={() => setTheme(t => t === "dark" ? "light" : "dark")} aria-label={`Switch to ${theme === "dark" ? "Daylight" : "Lustro Velvet"} theme`} title={theme === "dark" ? "Daylight" : "Lustro Velvet"} className="!h-9 !min-h-9 !px-2.5"><Icon name={theme === "dark" ? "sun" : "moon"} size={16}/></Button>
            {companies.length > 1 && (
              <label className="relative" title="Switch company workspace">
                <span className="sr-only">Company Workspace</span>
                <select
                  className="lv-input !w-[110px] !rounded-full !py-1.5 !text-xs sm:!w-[150px]"
                  value={activeCompany?.id || ""}
                  onChange={e => switchWorkspace(Number(e.target.value))}
                >
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {user ? (
              <Button
                variant="secondary"
                onClick={openTeamModal}
                className="!h-9 !min-h-9 !px-3 !text-xs flex items-center gap-2 rounded-full border-line/70 hover:border-violet-400/40"
                aria-label="Account, team and workspace settings"
                title={`${user.name} (${activeCompany?.name || "Workspace"}) - Account & Settings`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400" aria-hidden="true" />
                <span className="font-medium truncate max-w-[90px] sm:max-w-[130px]">{user.name}</span>
                <Icon name="settings" size={13} className="text-muted" />
              </Button>
            ) : (
              <Button variant="primary" onClick={() => { setAuthMsg(""); setAuthView("login"); }} className="!h-9 !min-h-9 !px-3.5 !text-xs">
                Sign in
              </Button>
            )}
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-[1800px] px-4 lg:px-7">
        <div className="flex min-h-11 flex-wrap items-center justify-between gap-2 border-b border-line/50 py-2">
          <div className="flex flex-wrap items-center gap-4">
            <button type="button" className="flex items-center gap-2 border-0 bg-transparent p-0 text-muted hover:text-ink" onClick={() => setShowWalkthrough(v => !v)} aria-expanded={showWalkthrough} aria-controls="judge-walkthrough"><Icon name="spark" size={13}/><span className="font-mono text-[10px] uppercase tracking-widest">60-second judge walkthrough</span><Icon name="chevron" size={12} className={showWalkthrough ? "rotate-180" : ""}/></button>
            {screen !== "intro" && <button type="button" className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition ${showOrbit ? "border-violet-400/45 bg-violet-400/15 text-ink" : "border-line/70 bg-transparent text-muted hover:text-ink"}`} onClick={() => setShowOrbit(v => !v)} aria-expanded={showOrbit} aria-controls="workspace-orbit-guide"><Icon name="radar" size={12}/><span>Visual guide</span></button>}
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-[10px] text-muted sm:inline"><strong className="text-ink">{activeCompany?.name || brand?.name || "Workspace"}</strong>{brand?.name && activeCompany?.name !== brand?.name ? ` · ${brand.name}` : ""} <span className="mx-1 text-muted/40">/</span> Human decisions. Traceable proof.</span>
            {systemMode?.allow_reset && (
              <button type="button" onClick={() => setShowReset(true)} disabled={!ready || switching} className="flex items-center gap-1 border-0 bg-transparent p-0 text-[10px] text-muted hover:text-ink"><Icon name="refresh" size={11}/>Reset demo</button>
            )}
          </div>
        </div>
        {showWalkthrough && <div id="judge-walkthrough" className="lv-studio-scroll flex gap-2 overflow-x-auto py-3">{STEPS.map((s, i) => <button type="button" key={s} onClick={() => { void walk(i); }} disabled={!ready || switching} className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] ${activeStep === i ? "border-violet-400/40 bg-violet-400/10 text-ink" : "border-line/70 bg-transparent text-muted hover:text-ink"}`}><span className={`grid h-5 w-5 place-items-center rounded-full font-mono text-[9px] ${activeStep === i ? "bg-violet-400/20 text-[var(--lv-accent)]" : "bg-surface"}`}>{String(i + 1).padStart(2,"0")}</span>{s}{i < STEPS.length - 1 && <Icon name="arrow" size={11}/>}</button>)}</div>}
        {screen !== "intro" && showOrbit && <div id="workspace-orbit-guide" className="pt-3"><GovernanceOrbit mode="compact" activeScreen={screen} onClose={() => setShowOrbit(false)} /></div>}
      </div>
      {error && <div className="mx-auto max-w-[1800px] px-4 py-4 lg:px-7"><Notice tone="danger"><div className="flex flex-wrap items-center justify-between gap-3"><span>{error}</span><Button onClick={() => { void bootstrap(); }}>Retry connection</Button></div></Notice></div>}
      <main id="workspace" tabIndex={-1} className="mx-auto max-w-[1800px] px-4 pb-12 pt-6 outline-none sm:pt-8 lg:px-7" key={`${brand?.id}-${refresh}`}>
        {ready && brand && user && <div className="lv-enter motion-workspace" key={screen}>
          {screen === "intro" && (
            <AppleIntro
              brandId={brand.id}
              companyId={activeCompany?.id || brand.company_id}
              role={brand.role}
              user={user}
              privacy={privacy}
              onOpenScreen={navigate}
              onLaunchDraft={(id, persona) => {
                if (persona) {
                  void switchPersona(persona).then(me => {
                    if (me) openDraft(id);
                  });
                } else openDraft(id);
              }}
              onLaunchStep={i => {
                void walk(i);
              }}
            />
          )}
          {screen === "review" && <DraftReview brandId={brand.id} role={brand.role} selectedDraftId={selectedDraftId} onSelectDraft={setSelectedDraftId} onOpenQueue={id => { void openQueue(id); }}/ >}
          {screen === "vault" && <EvidenceVault brandId={brand.id} role={brand.role} onOpenDraft={id => { void openRecalledDraft(id); }}/ >}
          {screen === "queue" && <ReviewQueue brandId={brand.id} role={brand.role} selectedDraftId={selectedDraftId} onSelectDraft={setSelectedDraftId} onOpenEditor={openDraft} onSwitchReviewer={senior => { void switchReviewer(senior); }}/ >}
          {screen === "insights" && <Insights brandId={brand.id} role={brand.role}/ >}
          {screen === "library" && <BrandLibrary brandId={brand.id} role={brand.role}/ >}
        </div>}
        {!ready && !switching && (
          <div className="py-24 text-center max-w-md mx-auto space-y-4">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-violet-400/10 border border-violet-400/20 flex items-center justify-center text-[var(--lv-accent)]">
              <Icon name="lock" size={24} />
            </div>
            <h2 className="text-xl font-semibold text-ink">{user ? "Set up your workspace" : "Sign in to BrandLint"}</h2>
            <p className="text-xs text-muted leading-relaxed">
              {user ? "Your account is ready. Create your company workspace to start adding brand rules and approved facts, or accept an invitation from your team." : "Sign in with your workspace account, or create an account to set up your company's brand rules, evidence and approval queues."}
            </p>
            <div className="pt-2">
              <Button variant="primary" onClick={() => { setAuthMsg(""); setAuthView(user ? "workspace" : "login"); }} className="!px-6 !py-2.5">
                {user ? "Create workspace" : "Sign in to workspace"}
              </Button>
              {!user && <Button variant="ghost" className="ml-2" onClick={() => { setAuthMsg(""); setAuthPassword(""); setAuthView("register"); }}>Create an account</Button>}
            </div>
          </div>
        )}
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
                <button type="button" className="lv-footer-link" aria-current={screen === "review" ? "page" : undefined} onClick={() => navigate("review")}><Icon name="file" size={13}/>Check content</button>
                <button type="button" className="lv-footer-link" aria-current={screen === "vault" ? "page" : undefined} onClick={() => navigate("vault")}><Icon name="radar" size={13}/>Approved facts</button>
                <button type="button" className="lv-footer-link" aria-current={screen === "queue" ? "page" : undefined} onClick={() => navigate("queue")}><Icon name="review" size={13}/>Approvals</button>
                <button type="button" className="lv-footer-link" aria-current={screen === "library" ? "page" : undefined} onClick={() => navigate("library")}><Icon name="book" size={13}/>Brand rules</button>
                <button type="button" className="lv-footer-link" aria-current={screen === "insights" ? "page" : undefined} onClick={() => navigate("insights")}><Icon name="chart" size={13}/>Insights</button>
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
      {authView === "login" && (
        <Modal title="Sign in to BrandLint" onClose={() => setAuthView(null)}>
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            {authMsg && <Notice tone="danger" className="text-xs">{authMsg}</Notice>}

            {systemMode?.allow_persona_switch !== false && (
              <div className="rounded-xl border border-line/60 bg-surface/50 p-3 space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-mono text-muted">Demo Personas (password: demo1234)</span>
                  <span className="text-[10px] text-muted/80">Click to fill</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                  {DEMO_USERS.map(u => (
                    <button
                      key={u.email}
                      type="button"
                      onClick={() => {
                        setAuthEmail(u.email);
                        setAuthPassword("demo1234");
                        setAuthMsg("");
                      }}
                      className={`px-2 py-1.5 text-left text-xs rounded-lg border transition ${
                        authEmail === u.email
                          ? "border-violet-400/60 bg-violet-400/15 text-ink"
                          : "border-line/50 bg-well/60 text-muted hover:text-ink hover:bg-well"
                      }`}
                    >
                      <div className="font-medium text-ink truncate">{u.label.split(" ")[0]}</div>
                      <div className="text-[10px] text-muted truncate">{u.role}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="lv-label">Email address</label>
              <input type="email" required className="lv-input" value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="name@company.com" autoFocus />
            </div>
            <div>
              <label className="lv-label">Password</label>
              <input type="password" required className="lv-input" value={authPassword} onChange={e => setAuthPassword(e.target.value)} placeholder="••••••••••••" />
            </div>
            <div className="flex items-center justify-between pt-2">
              <button type="button" onClick={() => { setAuthMsg(""); setAuthView("forgot"); }} className="border-0 bg-transparent p-0 text-xs text-[var(--lv-accent)] hover:underline">
                Forgot password?
              </button>
              <Button variant="primary" type="submit" disabled={authBusy}>
                {authBusy ? "Signing in…" : "Sign in"}
              </Button>
            </div>
            <div className="border-t border-line/60 pt-4 text-center text-xs text-muted">
              New to BrandLint? <button type="button" className="border-0 bg-transparent p-0 text-[var(--lv-accent)] hover:underline" disabled={authBusy} onClick={() => { setAuthMsg(""); setAuthPassword(""); setAuthView("register"); }}>Create an account</button>
            </div>
          </form>
        </Modal>
      )}
      {authView === "register" && (
        <Modal title="Create your BrandLint account" onClose={() => { if (!authBusy) setAuthView(null); }}>
          <form onSubmit={handleRegisterSubmit} className="space-y-4">
            <p className="lv-muted text-xs leading-6">Create your account, then set up your company workspace. If your team already uses BrandLint, ask its owner for an invitation.</p>
            {authMsg && <Notice tone="danger" className="text-xs">{authMsg}</Notice>}
            <label className="block"><span className="lv-label">Full name</span><input required maxLength={200} autoComplete="name" autoFocus className="lv-input" value={authName} disabled={authBusy} onChange={e => setAuthName(e.target.value)} placeholder="Your name"/></label>
            <label className="block"><span className="lv-label">Work email</span><input type="email" required autoComplete="email" className="lv-input" value={authEmail} disabled={authBusy} onChange={e => setAuthEmail(e.target.value)} placeholder="name@company.com"/></label>
            <label className="block"><span className="lv-label">Password (minimum 12 characters)</span><input type="password" required minLength={12} maxLength={256} autoComplete="new-password" className="lv-input" value={authPassword} disabled={authBusy} onChange={e => setAuthPassword(e.target.value)} placeholder="Choose a strong password"/></label>
            <div className="flex items-center justify-between gap-3 pt-2"><Button variant="ghost" disabled={authBusy} onClick={() => { setAuthMsg(""); setAuthPassword(""); setAuthView("login"); }}>Back to sign in</Button><Button variant="primary" type="submit" disabled={authBusy}>{authBusy ? "Creating account…" : "Create account"}</Button></div>
          </form>
        </Modal>
      )}
      {authView === "workspace" && user && (
        <Modal title="Create your company workspace" onClose={() => { if (!authBusy) setAuthView(null); }}>
          <form onSubmit={handleCreateWorkspace} className="space-y-4">
            <p className="lv-muted text-xs leading-6">You will become the workspace's Brand Owner. Add your team and configure its permissions after setup.</p>
            {authMsg && <Notice tone="danger" className="text-xs">{authMsg}</Notice>}
            <label className="block"><span className="lv-label">Company name</span><input required minLength={2} maxLength={200} autoComplete="organization" autoFocus className="lv-input" value={newWorkspaceName} disabled={authBusy} onChange={e => setNewWorkspaceName(e.target.value)} placeholder="Your company"/></label>
            <label className="block"><span className="lv-label">Brand name (optional)</span><input maxLength={200} className="lv-input" value={newBrandName} disabled={authBusy} onChange={e => setNewBrandName(e.target.value)} placeholder="Defaults to your company name"/></label>
            <div className="flex items-center justify-between gap-3 pt-2"><Button variant="ghost" disabled={authBusy} onClick={() => { void handleLogout(); }}>Sign out</Button><Button variant="primary" type="submit" disabled={authBusy || newWorkspaceName.trim().length < 2}>{authBusy ? "Creating workspace…" : "Create workspace"}</Button></div>
          </form>
        </Modal>
      )}
      {authView === "forgot" && (
        <Modal title="Reset your password" onClose={() => setAuthView(null)}>
          <form onSubmit={handleForgotSubmit} className="space-y-4">
            <p className="lv-muted text-xs leading-5">
              Enter your registered work email. If an account exists, a secure single-use recovery link will be generated.
            </p>
            {authMsg && <Notice tone="accent" className="text-xs">{authMsg}</Notice>}
            <div>
              <label className="lv-label">Work email</label>
              <input type="email" required className="lv-input" value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="name@company.com" autoFocus />
            </div>
            <div className="flex items-center justify-between pt-2">
              <button type="button" onClick={() => { setAuthMsg(""); setAuthView("login"); }} className="border-0 bg-transparent p-0 text-xs text-muted hover:text-ink">
                ← Back to sign in
              </button>
              <Button variant="primary" type="submit" disabled={authBusy}>
                {authBusy ? "Sending…" : "Send recovery link"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
      {authView === "reset" && (
        <Modal title="Choose a new password" onClose={() => setAuthView(null)}>
          <form onSubmit={handleResetSubmit} className="space-y-4">
            <p className="lv-muted text-xs leading-5">
              Enter your new password. All existing sessions will be invalidated upon reset.
            </p>
            {authMsg && <Notice tone="accent" className="text-xs">{authMsg}</Notice>}
            {!authResetToken && (
              <div>
                <label className="lv-label">Recovery token</label>
                <input type="text" required className="lv-input" value={authResetToken} onChange={e => setAuthResetToken(e.target.value)} placeholder="Paste recovery token" />
              </div>
            )}
            <div>
              <label className="lv-label">New password (minimum 12 characters)</label>
              <input type="password" required minLength={12} className="lv-input" value={authPassword} onChange={e => setAuthPassword(e.target.value)} placeholder="••••••••••••" autoFocus />
            </div>
            <div className="flex items-center justify-between pt-2">
              <button type="button" onClick={() => { setAuthMsg(""); setAuthView("login"); }} className="border-0 bg-transparent p-0 text-xs text-muted hover:text-ink">
                Cancel
              </button>
              <Button variant="primary" type="submit" disabled={authBusy}>
                {authBusy ? "Updating…" : "Update password"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
      {showTeamModal && (
        <Modal title={`${activeCompany?.name || "Company"} Workspace & Team`} onClose={() => setShowTeamModal(false)} wide>
          <div className="space-y-4">
            {teamMsg && (
              <Notice tone={teamMsg.includes("fail") || teamMsg.includes("error") || teamMsg.includes("prevent") || teamMsg.includes("Cannot") ? "danger" : "accent"} className="text-xs">
                {teamMsg}
              </Notice>
            )}

            <div className="flex border-b border-line/60 gap-2 pb-2">
              <button
                type="button"
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${teamTab === "members" ? "bg-violet-400/20 text-[var(--lv-accent)]" : "text-muted hover:text-ink"}`}
                onClick={() => { setTeamTab("members"); setTeamMsg(""); }}
              >
                Members ({members.length})
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${teamTab === "invite" ? "bg-violet-400/20 text-[var(--lv-accent)]" : "text-muted hover:text-ink"}`}
                onClick={() => { setTeamTab("invite"); setTeamMsg(""); setInviteResult(null); }}
              >
                Invite Member
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${teamTab === "settings" ? "bg-violet-400/20 text-[var(--lv-accent)]" : "text-muted hover:text-ink"}`}
                onClick={() => { setTeamTab("settings"); setTeamMsg(""); }}
              >
                Settings
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${teamTab === "roles" ? "bg-violet-400/20 text-[var(--lv-accent)]" : "text-muted hover:text-ink"}`}
                onClick={() => { setTeamTab("roles"); setTeamMsg(""); }}
              >
                Role Reference
              </button>
            </div>

            {teamTab === "members" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-muted">
                  <span>Active members with access to this company workspace and brands</span>
                  <span className="font-mono text-[11px]">{members.length} member{members.length === 1 ? "" : "s"}</span>
                </div>
                <div className="divide-y divide-line/40 max-h-72 overflow-y-auto">
                  {members.map(m => {
                    const isSelf = m.user_id === user?.id;
                    const isOwner = activeCompany?.role === "brand_owner";
                    return (
                      <div key={m.id} className="py-2.5 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-xs text-ink truncate">{m.name}</span>
                            {isSelf && <span className="text-[10px] bg-surface px-1.5 py-0.5 rounded text-muted font-mono">You</span>}
                          </div>
                          <span className="text-[11px] text-muted truncate block">{m.email}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {isOwner ? (
                            <select
                              className="lv-input !w-auto !py-1 !text-xs"
                              value={m.role}
                              disabled={teamBusy}
                              onChange={e => { void handleRoleChange(m.user_id, e.target.value); }}
                            >
                              <option value="creator">Creator</option>
                              <option value="reviewer">Reviewer</option>
                              <option value="senior_reviewer">Senior Reviewer</option>
                              <option value="brand_owner">Owner</option>
                            </select>
                          ) : (
                            <Badge tone={m.role === "brand_owner" ? "accent" : "neutral"} className="text-[10px] capitalize">
                              {m.role.replace(/_/g, " ")}
                            </Badge>
                          )}
                          {isOwner && (
                            <button
                              type="button"
                              disabled={teamBusy}
                              onClick={() => { void handleRemoveMember(m.user_id); }}
                              className="border-0 bg-transparent text-muted hover:text-red-400 p-1 rounded"
                              title={isSelf ? "Leave workspace" : "Remove member"}
                            >
                              <Icon name="close" size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {teamTab === "invite" && (
              <div className="space-y-4">
                {activeCompany?.role !== "brand_owner" ? (
                  <Notice tone="neutral" className="text-xs">
                    Only workspace owners can send invitations to new team members.
                  </Notice>
                ) : (
                  <form onSubmit={handleInviteSubmit} className="space-y-3">
                    <p className="lv-muted text-xs leading-5">
                      Invitations are company-scoped, single-use, and expire in 7 days. Once accepted, the invited user will have instant access to all brands in {activeCompany.name}.
                    </p>
                    {inviteResult && (
                      <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl space-y-1.5">
                        <span className="text-xs font-medium text-emerald-400 flex items-center gap-1.5">
                          <Icon name="check" size={13} /> Invitation created!
                        </span>
                        <p className="text-[11px] text-muted break-all">
                          Invite Link: <code className="bg-black/30 px-1 py-0.5 rounded text-ink">{inviteResult}</code>
                        </p>
                        <button
                          type="button"
                          onClick={() => { void navigator.clipboard?.writeText(inviteResult); }}
                          className="text-xs text-[var(--lv-accent)] hover:underline"
                        >
                          Copy invite link
                        </button>
                      </div>
                    )}
                    <div>
                      <label className="lv-label">Recipient email address</label>
                      <input
                        type="email"
                        required
                        className="lv-input"
                        placeholder="colleague@company.com"
                        value={inviteEmail}
                        onChange={e => setInviteEmail(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="lv-label">Assigned role</label>
                      <select
                        className="lv-input"
                        value={inviteRole}
                        onChange={e => setInviteRole(e.target.value)}
                      >
                        <option value="creator">Creator</option>
                        <option value="reviewer">Reviewer</option>
                        <option value="senior_reviewer">Senior Reviewer</option>
                        <option value="brand_owner">Owner</option>
                      </select>
                      {roles[inviteRole] && (
                        <p className="text-[11px] text-muted mt-1.5">
                          {roles[inviteRole].description}
                        </p>
                      )}
                    </div>
                    <div className="flex justify-end pt-2">
                      <Button variant="primary" type="submit" disabled={teamBusy || !inviteEmail.trim()}>
                        {teamBusy ? "Sending…" : "Send Invitation"}
                      </Button>
                    </div>
                  </form>
                )}

                {invitations.length > 0 && (
                  <div className="pt-3 border-t border-line/50 space-y-2">
                    <span className="text-xs font-medium text-muted block">Pending & Revocable Invitations</span>
                    <div className="divide-y divide-line/40 max-h-48 overflow-y-auto">
                      {invitations.map(inv => (
                        <div key={inv.id} className="py-2 flex items-center justify-between gap-2 text-xs">
                          <div className="min-w-0">
                            <span className="font-mono text-ink truncate block">{inv.email}</span>
                            <span className="text-[11px] text-muted">
                              Role: {inv.role_label || inv.role.replace(/_/g, " ")} · Status: <span className="capitalize">{inv.status}</span>
                            </span>
                          </div>
                          {inv.status === "pending" && activeCompany?.role === "brand_owner" && (
                            <Button
                              variant="ghost"
                              onClick={() => { void handleRevokeInvitation(inv.id); }}
                              disabled={teamBusy}
                              className="!h-7 !min-h-7 !px-2 !text-[11px] text-red-400 hover:text-red-300"
                            >
                              Revoke
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {teamTab === "settings" && (
              <div className="space-y-4">
                {companies.length > 1 && (
                  <div className="p-3.5 rounded-xl border border-line/60 bg-surface/40 space-y-2">
                    <label className="lv-label">Switch Company Workspace</label>
                    <p className="text-xs text-muted">You belong to multiple company workspaces. Select one to switch:</p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {companies.map(c => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => switchWorkspace(c.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                            c.id === activeCompany?.id
                              ? "border-violet-400/60 bg-violet-400/20 text-ink"
                              : "border-line/60 bg-well text-muted hover:text-ink"
                          }`}
                        >
                          {c.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {activeCompany?.role !== "brand_owner" ? (
                  <Notice tone="neutral" className="text-xs">
                    Only workspace owners can modify workspace settings.
                  </Notice>
                ) : (
                  <form onSubmit={handleUpdateCompany} className="space-y-3">
                    <div>
                      <label className="lv-label">Workspace Company Name</label>
                      <input
                        type="text"
                        required
                        className="lv-input"
                        value={companyNameEdit}
                        onChange={e => setCompanyNameEdit(e.target.value)}
                      />
                    </div>
                    <div className="text-[11px] text-muted space-y-1">
                      <div>Workspace Slug: <code className="bg-surface px-1 py-0.5 rounded font-mono">{activeCompany.slug}</code></div>
                      <div>Created: <span className="font-mono">{new Date(activeCompany.created_at).toLocaleDateString()}</span></div>
                    </div>
                    <div className="flex justify-end pt-2">
                      <Button variant="primary" type="submit" disabled={teamBusy || !companyNameEdit.trim()}>
                        {teamBusy ? "Saving…" : "Save Workspace"}
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {teamTab === "roles" && (
              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                <p className="lv-muted text-xs leading-5">
                  BrandLint roles enforce four-eyes governance and strict tenant separation. Authors can never approve their own drafts.
                </p>
                {Object.entries(roles).map(([k, r]) => (
                  <div key={k} className="p-3 rounded-xl border border-line/60 bg-surface/40 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-xs text-ink">{r.label}</span>
                      <Badge tone={k === "brand_owner" ? "accent" : "neutral"} className="text-[10px] font-mono">{k}</Badge>
                    </div>
                    <p className="text-xs text-muted leading-relaxed">{r.description}</p>
                    {r.permissions && r.permissions.length > 0 && (
                      <ul className="text-[11px] text-muted list-disc list-inside space-y-0.5 pt-1">
                        {r.permissions.map((perm, i) => (
                          <li key={i}>{perm}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}

            {user && (
              <div className="pt-4 mt-2 border-t border-line/60 flex flex-wrap items-center justify-between gap-3 text-xs bg-well/40 -mx-6 -mb-6 p-4 rounded-b-2xl">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" aria-hidden="true" />
                  <span className="text-muted">Signed in:</span>
                  <strong className="text-ink">{user.name}</strong>
                  <span className="font-mono text-muted text-[11px]">({user.email})</span>
                  {activeCompany?.role && (
                    <Badge tone={activeCompany.role === "brand_owner" ? "accent" : "neutral"} className="text-[10px]">
                      {activeCompany.role.replace(/_/g, " ")}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {systemMode?.allow_persona_switch !== false && (
                    <select
                      className="lv-input !w-auto !py-1 !text-xs"
                      value={user.email}
                      disabled={switching}
                      onChange={e => {
                        setShowTeamModal(false);
                        void switchPersona(e.target.value);
                      }}
                      title="Quick switch demo persona"
                    >
                      <option value="" disabled>Switch persona</option>
                      {DEMO_USERS.map(u => (
                        <option key={u.email} value={u.email}>
                          {u.label.split(" ")[0]} ({u.role})
                        </option>
                      ))}
                    </select>
                  )}
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setShowTeamModal(false);
                      void handleLogout();
                    }}
                    className="!py-1 !px-2.5 !text-xs text-rose-400 hover:text-rose-300"
                  >
                    Sign out
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
      {showAcceptInvite && (
        <Modal title="Workspace Invitation" onClose={() => setShowAcceptInvite(false)}>
          <form onSubmit={handleAcceptInvitation} className="space-y-4">
            {inviteDetails ? (
              <div className="p-3 bg-violet-400/10 border border-violet-400/30 rounded-xl space-y-1">
                <p className="text-xs text-ink">
                  You have been invited to join <strong>{inviteDetails.company_name}</strong> as <strong>{inviteDetails.role_label}</strong>.
                </p>
                <p className="text-[11px] text-muted">{inviteDetails.role_description}</p>
                <p className="text-[10px] text-muted/70 pt-1">Invited email: <span className="font-mono">{inviteDetails.email}</span></p>
              </div>
            ) : (
              <p className="lv-muted text-xs">Accept your invitation to join the company workspace.</p>
            )}

            {authMsg && <Notice tone="danger" className="text-xs">{authMsg}</Notice>}

            {!user && (
              <>
                <div>
                  <label className="lv-label">Your full name</label>
                  <input
                    type="text"
                    required
                    className="lv-input"
                    value={acceptName}
                    onChange={e => setAcceptName(e.target.value)}
                    placeholder="Your Name"
                  />
                </div>
                <div>
                  <label className="lv-label">Set account password (minimum 12 characters)</label>
                  <input
                    type="password"
                    required
                    minLength={12}
                    className="lv-input"
                    value={acceptPassword}
                    onChange={e => setAcceptPassword(e.target.value)}
                    placeholder="••••••••••••"
                  />
                </div>
              </>
            )}

            {user && (
              <Notice tone="accent" className="text-xs">
                Accepting invitation as currently signed-in user: <strong>{user.email}</strong>
              </Notice>
            )}

            <div className="flex items-center justify-between pt-2">
              <Button variant="ghost" onClick={() => setShowAcceptInvite(false)}>
                Decline / Close
              </Button>
              <Button variant="primary" type="submit" disabled={authBusy}>
                {authBusy ? "Accepting…" : "Join Workspace"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  </>;
};
