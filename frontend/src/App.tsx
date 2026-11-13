import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react";
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
import { Loader } from "./components/Loader";
import { Navbar, TopSection } from "./components/Navbar";
import { WalkthroughFlow } from "./components/WalkthroughFlow";
import { WorkspaceTour } from "./components/WorkspaceTour";
import {
  Badge,
  BrandLintLogo,
  Button,
  ErrorBoundary,
  Icon,
  Modal,
  Notice,
  OptimizedImage,
  ScreenSkeleton,
  ShowcaseSkeleton,
  StatusAnnouncer,
  errorText,
} from "./components/ui";

const BrandLibrary = lazy(() =>
  import("./screens/BrandLibrary").then(m => ({ default: m.BrandLibrary }))
);
const DraftReview = lazy(() =>
  import("./screens/DraftReview").then(m => ({ default: m.DraftReview }))
);
const EvidenceVault = lazy(() =>
  import("./screens/EvidenceVault").then(m => ({ default: m.EvidenceVault }))
);
const Insights = lazy(() =>
  import("./screens/Insights").then(m => ({ default: m.Insights }))
);
const ReviewQueue = lazy(() =>
  import("./screens/ReviewQueue").then(m => ({ default: m.ReviewQueue }))
);
const AppleIntro = lazy(() =>
  import("./screens/AppleIntro").then(m => ({ default: m.AppleIntro }))
);
const GovernanceOrbit = lazy(() =>
  import("./components/GovernanceOrbit").then(m => ({ default: m.GovernanceOrbit }))
);
const ProledXdrShowcase = lazy(() =>
  import("./components/ProledXdrShowcase").then(m => ({ default: m.ProledXdrShowcase }))
);

type Screen = "intro" | "review" | "vault" | "queue" | "insights" | "library";

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
  const [bootSettled, setBootSettled] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showOrbit, setShowOrbit] = useState(false);
  const [showTour, setShowTour] = useState<boolean>(false);
  const [tourStep, setTourStep] = useState<number>(0);
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
    finally { setSwitching(false); setBootSettled(true); }
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
  const switchPersona = useCallback(async (email: string) => { const me = await bootstrap(email); if (me) setRefresh(v => v + 1); return me; }, []);
  const navigate = useCallback((next: Screen) => {
    setScreen(next);
    window.scrollTo({ top: 0 });
  }, []);
  const suppressHomeTourRef = useRef(false);
  const initialHomeTourDoneRef = useRef(false);
  const prevScreenRef = useRef<Screen>("intro");

  const openWorkspaceOrAuth = useCallback((next: Screen, anchorId?: string) => {
    if (!user || !brand) {
      if (anchorId) {
        const tryEl = document.getElementById("try");
        if (tryEl) {
          tryEl.scrollIntoView({ behavior: "smooth" });
          return;
        }
      }
      setAuthMsg("Sign in or pick a demo role below to open this workspace.");
      setAuthView("login");
      return;
    }
    if (next === "intro" && anchorId === "ad-image-scanner") {
      suppressHomeTourRef.current = true;
    }
    navigate(next);
    if (anchorId) {
      setTimeout(() => {
        document.getElementById(anchorId)?.scrollIntoView({ behavior: "smooth" });
      }, 120);
    }
  }, [user, brand, navigate]);
  const openDraft = useCallback((id: number) => {
    setSelectedDraftId(id);
    navigate("review");
  }, [navigate]);
  const independentReviewer = useCallback(async (senior: boolean, draft?: DraftDetail) => {
    const eligible = DEMO_USERS.filter(persona => senior
      ? ["senior_reviewer", "brand_owner"].includes(persona.badge)
      : ["reviewer", "senior_reviewer", "brand_owner"].includes(persona.badge));
    const candidate = eligible.find(persona => persona.label !== draft?.author);
    if (!candidate) { setError("No independent demo reviewer is available for this route."); return null; }
    const me = await switchPersona(candidate.email);
    if (me && draft && me.user.id === draft.author_id) { setError("Choose an independent reviewer. Authors cannot approve their own drafts."); return null; }
    return me;
  }, [switchPersona]);
  const switchReviewer = useCallback(async (senior = false) => {
    try { const draft = brand && selectedDraftId ? await api.getDraft(brand.id, selectedDraftId) : undefined; await independentReviewer(senior, draft); }
    catch (e) { setError(errorText(e)); }
  }, [brand, selectedDraftId, independentReviewer]);
  const openRecalledDraft = useCallback(async (id: number) => {
    if (!brand) return;
    try {
      const draft = await api.getDraft(brand.id, id);
      if (!draft.can_edit) {
        const author = DEMO_USERS.find(persona => persona.label === draft.author);
        if (author) { const me = await switchPersona(author.email); if (!me || me.user.id !== draft.author_id) return; }
      }
      openDraft(id);
    } catch (e) { setError(errorText(e)); }
  }, [brand, switchPersona, openDraft]);
  const openQueue = useCallback(async (id: number) => {
    if (!brand) return;
    try {
      const d = await api.getDraft(brand.id, id);
      const me = await independentReviewer(d.route === "senior" || d.computed_route === "senior", d);
      if (me) { setSelectedDraftId(id); navigate("queue"); }
    } catch (e) { setError(errorText(e)); }
  }, [brand, independentReviewer, navigate]);
  const handleSwitchPersonaProp = useCallback((email: string) => { void switchPersona(email); }, [switchPersona]);
  const handleLaunchDraftProp = useCallback((id: number, persona?: string) => {
    if (persona) {
      void switchPersona(persona).then(me => {
        if (me) openDraft(id);
      });
    } else openDraft(id);
  }, [switchPersona, openDraft]);
  const handleLaunchStepProp = useCallback((step?: number) => {
    setAuthView(null);
    setTourStep(step ?? 0);
    setShowTour(true);
  }, []);
  const handleOpenQueueProp = useCallback((id: number) => { void openQueue(id); }, [openQueue]);
  const handleOpenRecalledProp = useCallback((id: number) => { void openRecalledDraft(id); }, [openRecalledDraft]);
  const handleSwitchReviewerProp = useCallback((senior?: boolean) => { void switchReviewer(senior); }, [switchReviewer]);
  const [loaderActive, setLoaderActive] = useState(true);
  const ready = !!user && !!brand;

  // Activate the Walkthrough Guide modal automatically on initial homepage arrival and when returning to the homepage
  useEffect(() => {
    const cameFromOtherScreen = prevScreenRef.current !== "intro" && screen === "intro";
    prevScreenRef.current = screen;

    const canAutoOpen =
      screen === "intro" &&
      !loaderActive &&
      (ready || !!error || bootSettled) &&
      !authView &&
      !showAcceptInvite &&
      !showPrivacy &&
      !showReset &&
      !showOrbit &&
      !showTeamModal;

    if (!canAutoOpen) return;

    if (cameFromOtherScreen) {
      if (suppressHomeTourRef.current) {
        suppressHomeTourRef.current = false;
        return;
      }
      setTourStep(0);
      setShowTour(true);
      initialHomeTourDoneRef.current = true;
      return;
    }

    if (!initialHomeTourDoneRef.current) {
      initialHomeTourDoneRef.current = true;
      setTourStep(0);
      setShowTour(true);
    }
  }, [
    screen,
    loaderActive,
    ready,
    error,
    bootSettled,
    authView,
    showAcceptInvite,
    showPrivacy,
    showReset,
    showOrbit,
    showTeamModal,
  ]);

  // Global once-only GPU scroll-reveal observer across all workspace views and landing sections
  useEffect(() => {
    if (typeof window === "undefined") return;
    const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const revealAllPending = () => {
      document.querySelectorAll(".reveal-on-scroll:not(.is-revealed)").forEach(el => {
        el.classList.add("is-revealed");
      });
    };

    if (prefersReduced || typeof IntersectionObserver === "undefined") {
      revealAllPending();
      return;
    }

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-revealed");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.06, rootMargin: "0px 0px -24px 0px" }
    );

    const scan = () => {
      document.querySelectorAll(".reveal-on-scroll:not(.is-revealed)").forEach(el => {
        observer.observe(el);
      });
    };

    scan();
    const timer = window.setTimeout(scan, 80);
    const rootNode = document.getElementById("workspace") || document.body;
    const mutationObserver = new MutationObserver(() => scan());
    mutationObserver.observe(rootNode, { childList: true, subtree: true });

    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
      mutationObserver.disconnect();
    };
  }, [screen, ready]);
  const activeRoleLabel = (brand?.role || activeCompany?.role || "creator").replace(/_/g, " ");
  const cleanWorkspaceName = (raw?: string | null) =>
    (raw || "")
      .replace(/\s*\([^)]*(fictional|demo)[^)]*\)/gi, "")
      .trim();
  const displayBrandName = cleanWorkspaceName(brand?.name) || "Lumina Flow";
  const displayCompanyName = cleanWorkspaceName(activeCompany?.name) || displayBrandName;

  const handleSelectSection = useCallback((section: TopSection) => {
    if (section === "product") {
      if (user && brand) navigate("intro");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (section === "demo") {
      if (user && brand) {
        openWorkspaceOrAuth("intro", "ad-image-scanner");
      } else {
        const tryEl = document.getElementById("try");
        if (tryEl) tryEl.scrollIntoView({ behavior: "smooth" });
        else {
          setAuthMsg("");
          setAuthView("login");
        }
      }
      return;
    }
    document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" });
  }, [user, brand, navigate, openWorkspaceOrAuth]);

  const handlePrimaryCta = useCallback(() => {
    if (user && brand) {
      navigate("review");
      return;
    }
    const tryEl = document.getElementById("try");
    if (tryEl) tryEl.scrollIntoView({ behavior: "smooth" });
    else {
      setAuthMsg("");
      setAuthView("login");
    }
  }, [user, brand, navigate]);

  const handleToggleTheme = useCallback(() => {
    setTheme(t => (t === "dark" ? "light" : "dark"));
  }, []);

  const handleOpenTourNav = useCallback(() => {
    setAuthView(null);
    setTourStep(0);
    setShowTour(true);
  }, []);
  const handleOpenOrbitNav = useCallback(() => setShowOrbit(true), []);
  const handleOpenPrivacyNav = useCallback(() => setShowPrivacy(true), []);
  const handleOpenResetNav = useCallback(() => setShowReset(true), []);
  const handleOpenAuthNav = useCallback(() => {
    setAuthMsg("");
    setAuthView("login");
  }, []);
  const handleOpenTeamNav = useCallback(() => { void openTeamModal(); }, [openTeamModal]);
  const handleLogoutNav = useCallback(() => { void handleLogout(); }, [handleLogout]);

  return <>
    {loaderActive && (
      <Loader
        ready={ready || !!error || bootSettled}
        onRetry={() => { void bootstrap(undefined, true); }}
        onDone={() => setLoaderActive(false)}
      />
    )}
    <div className="lv-shell min-h-dvh bg-carbon text-bone">
      <StatusAnnouncer message={error || authMsg || teamMsg || null} />
      <a href="#workspace" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[1100] focus:rounded-md focus:bg-bone focus:px-4 focus:py-2 focus:font-display focus:text-xs focus:font-bold focus:uppercase focus:text-carbon">Skip to workspace</a>

      <Navbar
        user={user}
        ready={ready}
        brandName={displayBrandName}
        companyName={displayCompanyName}
        activeScreen={screen}
        activeRoleLabel={activeRoleLabel}
        theme={theme}
        companies={companies}
        activeCompanyId={activeCompany?.id}
        privacy={privacy}
        systemMode={systemMode}
        switching={switching}
        onSelectSection={handleSelectSection}
        onNavigateWorkspace={openWorkspaceOrAuth}
        onPrimaryCta={handlePrimaryCta}
        onToggleTheme={handleToggleTheme}
        onSwitchWorkspace={switchWorkspace}
        onSwitchPersona={handleSwitchPersonaProp}
        onOpenTeamModal={handleOpenTeamNav}
        onOpenTour={handleOpenTourNav}
        onOpenOrbit={handleOpenOrbitNav}
        onOpenPrivacy={handleOpenPrivacyNav}
        onOpenReset={handleOpenResetNav}
        onOpenAuth={handleOpenAuthNav}
        onLogout={handleLogoutNav}
      />

      {/* Governance Orbit Architecture Map Modal */}
      {showOrbit && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Architecture Map"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
        >
          <div className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-line bg-panel p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b border-line pb-3">
              <span className="font-sans text-lg font-bold text-bone">Workspace Architecture Map</span>
              <button
                type="button"
                onClick={() => setShowOrbit(false)}
                className="cursor-pointer rounded-full p-1 text-ash hover:bg-white/10 hover:text-bone"
                aria-label="Close Architecture Map"
              >
                <Icon name="close" size={16} />
              </button>
            </div>
            <Suspense fallback={<ShowcaseSkeleton height="h-[460px]" />}>
              <GovernanceOrbit
                mode="compact"
                activeScreen={screen}
                onNavigate={(s) => {
                  setShowOrbit(false);
                  navigate(s);
                }}
                onClose={() => setShowOrbit(false)}
              />
            </Suspense>
          </div>
        </div>
      )}

      {error && (
        <div className="mx-auto max-w-[1400px] px-4 py-4 sm:px-6">
          <Notice tone="danger">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>{error}</span>
              <Button onClick={() => { void bootstrap(); }}>Retry connection</Button>
            </div>
          </Notice>
        </div>
      )}

      <main id="workspace" tabIndex={-1} className="mx-auto max-w-[1400px] px-4 pb-12 pt-6 outline-none sm:px-6 sm:pt-8" key={`${brand?.id}-${refresh}`}>
        {ready && brand && user && (
          <ErrorBoundary onReset={() => setRefresh(v => v + 1)}>
            <Suspense fallback={<ScreenSkeleton />}>
              <div className="lv-enter motion-workspace" key={screen}>
                {screen === "intro" && (
                  <AppleIntro
                    brandId={brand.id}
                    brandName={displayBrandName}
                    companyId={activeCompany?.id || brand.company_id}
                    role={brand.role}
                    user={user}
                    privacy={privacy}
                    onOpenScreen={navigate}
                    onSwitchPersona={handleSwitchPersonaProp}
                    onLaunchDraft={handleLaunchDraftProp}
                    onLaunchStep={handleLaunchStepProp}
                  />
                )}
                {screen === "review" && (
                  <DraftReview
                    brandId={brand.id}
                    role={brand.role}
                    selectedDraftId={selectedDraftId}
                    onSelectDraft={setSelectedDraftId}
                    onOpenQueue={handleOpenQueueProp}
                  />
                )}
                {screen === "vault" && (
                  <EvidenceVault
                    brandId={brand.id}
                    role={brand.role}
                    onOpenDraft={handleOpenRecalledProp}
                  />
                )}
                {screen === "queue" && (
                  <ReviewQueue
                    brandId={brand.id}
                    role={brand.role}
                    selectedDraftId={selectedDraftId}
                    onSelectDraft={setSelectedDraftId}
                    onOpenEditor={openDraft}
                    onSwitchReviewer={handleSwitchReviewerProp}
                  />
                )}
                {screen === "insights" && <Insights brandId={brand.id} role={brand.role} />}
                {screen === "library" && <BrandLibrary brandId={brand.id} role={brand.role} />}
              </div>
            </Suspense>
          </ErrorBoundary>
        )}

        {!ready && (!switching || !loaderActive) && (
          <div className="space-y-16 py-6">
            {switching && !loaderActive && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-teal-500/30 bg-[#06121d]/80 px-4 py-3 text-xs text-teal-200">
                <span className="inline-flex items-center gap-2 font-mono uppercase tracking-wide">
                  <span className="size-2 rounded-full bg-teal-400 animate-pulse" />
                  Waking up Render API server — showing interactive UI preview in the meantime
                </span>
                <Button onClick={() => { void bootstrap(undefined, true); }}>Retry API</Button>
              </div>
            )}
            {/* BrandLint Unauthenticated Landing Experience */}
            <section id="how" className="guides contours ruler relative overflow-hidden rounded-2xl border border-line bg-carbon px-6 py-12 sm:px-10 sm:py-16">
              <div className="grid items-center gap-12 lg:grid-cols-[1.15fr_0.85fr]">
                <div>
                  <p className="font-label text-xs uppercase text-iris">Before it&apos;s published · BrandLint</p>
                  <h1 className="mt-4 font-display text-[clamp(2.5rem,6.5vw,5.25rem)] font-bold uppercase leading-[0.88] tracking-[-0.04em] text-bone">
                    <span className="block">Every claim</span>
                    <span className="relative mt-1 inline-block">
                      <span className="strike-bg text-bone/45">40% faster</span>
                      <span aria-hidden="true" className="swap-in mt-1 block text-[0.58em] leading-none text-ok sm:ml-4 sm:inline">
                        → 18% higher throughput*
                      </span>
                    </span>
                    <span className="mt-1 block">Checked.</span>
                  </h1>
                  <p className="mt-6 max-w-xl text-base leading-relaxed text-bone/75 sm:text-lg">
                    {user
                      ? "Your account is ready. Create your company workspace to start adding brand rules and approved facts, or accept an invitation from your team."
                      : "Paste a draft or drop a scanned PDF. BrandLint checks every line against your brand's rules and Evidence Vault, cites the exact rule and words, and swaps in approved wording before it goes live."}
                  </p>
                  <div className="mt-8 flex flex-wrap items-center gap-3">
                    <Button
                      variant="primary"
                      onClick={() => {
                        setAuthMsg("");
                        setAuthView(user ? "workspace" : "login");
                      }}
                      className="!h-12 !rounded-full !px-7 font-display !text-sm !font-bold uppercase"
                    >
                      {user ? "Create workspace" : "Sign in to workspace"} <Icon name="arrow" size={15} />
                    </Button>
                    {!user && (
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setAuthMsg("");
                          setAuthPassword("");
                          setAuthView("register");
                        }}
                        className="!h-12 !rounded-full !px-6 font-display !text-sm !font-bold uppercase"
                      >
                        Create an account
                      </Button>
                    )}
                    <Button
                      variant="secondary"
                      onClick={() => handleLaunchStepProp(0)}
                      className="!h-12 !rounded-full !px-6 font-display !text-sm !font-bold uppercase"
                    >
                      <Icon name="radar" size={15} /> Walkthrough Guide
                    </Button>
                  </div>
                </div>

                <div className="relative mx-auto w-full max-w-lg">
                  <div className="relative aspect-[16/10] overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl">
                    <OptimizedImage
                      src="/ads/aura-glow-guarantee-ad.webp"
                      fallbackSrc="/ads/aura-glow-guarantee-ad.jpg"
                      width={1024}
                      height={571}
                      eager
                      alt="Aura Glow Guarantee Banner Audit"
                      wrapperClassName="h-full w-full"
                      className="h-full w-full object-cover"
                    />
                    <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-black/30" />
                    <div aria-hidden="true" className="box-in absolute inset-x-4 top-[4%] h-[22%] rounded-lg border-2 border-blocking bg-blocking/15">
                      <span className="absolute -bottom-5 left-2 rounded bg-blocking px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-white">
                        CLAIM-01 · Unqualified Guarantee
                      </span>
                    </div>
                    <div aria-hidden="true" className="scan-y pointer-events-none absolute inset-x-0 h-14 bg-gradient-to-b from-transparent via-teal/20 to-transparent">
                      <div className="h-0.5 w-full bg-teal" />
                    </div>
                    <div aria-hidden="true" className="finding-pop paper absolute inset-x-4 bottom-3 rounded-xl p-3.5">
                      <div className="flex items-center justify-between gap-2 font-label text-[10px] font-bold uppercase">
                        <span className="flex items-center gap-1.5 text-[#b42318]">
                          <span className="size-2 rotate-45 bg-blocking" /> Aura Glow Ad #1 · Requires EV-1
                        </span>
                        <span className="font-mono text-ink/60">33.8% Text Density</span>
                      </div>
                      <p className="mt-1 rounded bg-[#1e7f55]/12 px-2.5 py-1 text-xs font-semibold text-[#145a3c]">
                        ✓ Fix: “92% reported visibly brighter skin after 30 days (EV-1, n=124)”
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Apple MacBook Pro PROLED XDR Display-Inspired Tandem Verification Showcase */}
            <div id="numbers" className="reveal-on-scroll overflow-hidden rounded-2xl border border-line">
              <Suspense fallback={<ShowcaseSkeleton height="h-[520px]" />}>
                <ProledXdrShowcase
                  onTryChecker={() => {
                    setAuthMsg("");
                    setAuthView(user ? "workspace" : "login");
                  }}
                />
              </Suspense>
            </div>

            {/* Interactive 4-Step Walkthrough Guide (Scan -> Evidence -> Approval -> Publish) */}
            <section
              id="walkthrough-guide"
              aria-labelledby="landing-walkthrough-heading"
              className="mx-auto w-full max-w-[1120px] space-y-6"
            >
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="font-label text-xs uppercase text-iris">Workflow · Interactive Walkthrough</p>
                  <h2
                    id="landing-walkthrough-heading"
                    className="mt-2 font-display text-3xl font-bold uppercase leading-[0.95] tracking-[-0.02em] text-bone sm:text-4xl"
                  >
                    Scan to Publish in Four Steps.
                  </h2>
                </div>
                <Button
                  variant="secondary"
                  onClick={handleOpenTourNav}
                  className="!rounded-full font-mono !text-xs"
                >
                  Expand Modal Guide ↗
                </Button>
              </div>
              <WalkthroughFlow
                mode="inline"
                stepIndex={tourStep}
                onStepChange={setTourStep}
              />
            </section>

            {/* Quick 1-click Demo Role Cards */}
            {!user && systemMode?.allow_persona_switch !== false && (
              <section id="try" className="reveal-on-scroll space-y-6">
                <div>
                  <p className="font-label text-xs uppercase text-iris">Try the demo · Role-based governance</p>
                  <h2 className="mt-2 font-display text-4xl font-bold uppercase leading-[0.9] tracking-[-0.03em] text-bone">
                    Pick a role to step inside.
                  </h2>
                </div>
                <div className="reveal-stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    { email: DEMO_USERS[0].email, name: "Creator · Alex", blurb: "Checks drafts, applies fixes, submits for review.", num: "01", accent: "bg-[#0a2540] border-b border-teal/25", icon: "file" },
                    { email: DEMO_USERS[1].email, name: "Reviewer · Samira", blurb: "Reviews submitted posts and gives first-stage approval.", num: "02", accent: "bg-[#0f2924] border-b border-ok/25", icon: "review" },
                    { email: DEMO_USERS[2].email, name: "Senior · Morgan", blurb: "Signs off escalated claims and senior review routes.", num: "03", accent: "bg-[#221d12] border-b border-major/25", icon: "shield" },
                    { email: DEMO_USERS[3].email, name: "Brand Owner · Olivia", blurb: "Edits rules, gives final approval, reads guideline health.", num: "04", accent: "bg-[#0b1f33] border-b border-teal/30", icon: "chart" },
                  ].map(card => (
                    <button
                      key={card.email}
                      type="button"
                      onClick={() => { void switchPersona(card.email); }}
                      className="group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-line bg-panel text-left transition-colors hover:border-teal"
                    >
                      <div className={`guides contours relative aspect-[4/3] w-full overflow-hidden ${card.accent}`}>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-navy/85 text-teal shadow-sm transition-transform duration-300 group-hover:scale-105">
                            <Icon name={card.icon} size={22} />
                          </div>
                        </div>
                        <span className="absolute left-3 top-3 rounded-full border border-white/15 bg-[#0b1220]/85 px-2.5 py-0.5 font-mono text-[11px] text-white">
                          {card.num}
                        </span>
                      </div>
                      <div className="flex flex-1 flex-col justify-between p-4">
                        <div>
                          <p className="font-display text-lg font-bold uppercase tracking-[-0.02em] text-bone">{card.name}</p>
                          <p className="mt-1 text-xs leading-relaxed text-ash">{card.blurb}</p>
                        </div>
                        <span className="mt-4 inline-flex items-center justify-between border-t border-line pt-3 font-label text-xs font-bold uppercase text-bone group-hover:text-iris">
                          <span>Enter workspace</span>
                          <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">→</span>
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      {/* =====================================================================
          CORPORATE CONVERSION BANNER + 5-COLUMN ARCHITECTURAL FOOTER
         ===================================================================== */}
      <footer id="contact" className="relative overflow-hidden border-t border-line bg-[#0b1220] text-white">
        <div
          aria-hidden="true"
          className="h-[2px] w-full bg-teal/50"
        />

        <div className="relative mx-auto max-w-[1400px] px-4 py-14 sm:px-6 sm:py-16">
          <div className="reveal-on-scroll relative mb-14 overflow-hidden rounded-2xl border border-white/15 bg-[#111a2e] p-8 text-center shadow-lustro-card sm:p-12">
            <span className="inline-flex items-center gap-2 rounded-full border border-teal/35 bg-teal/10 px-4 py-1 font-mono text-[11px] font-semibold uppercase tracking-wider text-[#2dd4bf]">
              <span>Silence Is Never Clearance · Evidence Or Silence</span>
            </span>
            <h2 className="mx-auto mt-4 max-w-3xl font-sans text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
              Ready to Audit Your Brand&apos;s{" "}
              <span className="text-[#14b8a6]">
                Next Ad Campaign &amp; Copy?
              </span>
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base">
              Every check lists what it verified — and what still needs human judgement — so a clean result is never mistaken for a blanket sign-off.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3.5">
              <button
                type="button"
                onClick={() => openWorkspaceOrAuth("review")}
                className="cursor-pointer rounded-full bg-[#14b8a6] px-7 py-3.5 font-sans text-sm font-bold text-[#0a2540] transition hover:bg-[#2dd4bf]"
              >
                Open Content &amp; Ad Checker →
              </button>
              <button
                type="button"
                onClick={() => openWorkspaceOrAuth("intro", "ad-image-scanner")}
                className="cursor-pointer rounded-full border border-white/20 bg-white/[0.06] px-6 py-3.5 font-sans text-sm font-semibold text-white transition hover:border-white/35 hover:bg-white/[0.12]"
              >
                Scan Aura Glow Ads ↑
              </button>
            </div>
          </div>

          <div className="grid gap-10 border-b border-white/10 pb-12 md:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr_1fr]">
            <div className="space-y-4">
              <div className="flex items-center gap-2.5">
                <BrandLintLogo />
                <span className="font-sans text-xl font-extrabold tracking-tight text-white">
                  Brand<span className="text-[#14b8a6]">Lint</span>
                </span>
              </div>
              <p className="max-w-xs text-xs leading-relaxed text-slate-300">
                Enterprise AI &amp; deterministic brand governance platform for ad images, product packaging labels, promotional copy, and four-eyes compliance sign-off.
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowPrivacy(true)}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 font-mono text-[11px] text-slate-200 transition hover:border-teal/50 hover:text-white"
                >
                  <span className={`size-2 rounded-full ${privacy?.hosted ? "bg-emerald-400" : "bg-amber-400"}`} />
                  <span>
                    {privacy ? (privacy.hosted ? `Live AI · ${privacy.provider}` : `Local Verifier · ${privacy.provider}`) : "Connecting"}
                  </span>
                </button>
              </div>
            </div>

            {/* Col 2: SERVICES & CHECKERS */}
            <div className="space-y-3">
              <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-white">
                Services &amp; Checkers
              </h3>
              <ul className="space-y-2.5 text-xs text-slate-400">
                <li>
                  <button type="button" className="cursor-pointer rounded border-0 bg-transparent p-0 text-slate-400 transition-colors hover:text-white" onClick={() => openWorkspaceOrAuth("review")}>
                    Text &amp; Post Claim Checker
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className="cursor-pointer rounded border-0 bg-transparent p-0 text-slate-400 transition-colors hover:text-white"
                    onClick={() => openWorkspaceOrAuth("intro", "ad-image-scanner")}
                  >
                    Ad Image &amp; Placement Scanner
                  </button>
                </li>
                <li>
                  <button type="button" className="cursor-pointer rounded border-0 bg-transparent p-0 text-slate-400 transition-colors hover:text-white" onClick={() => openWorkspaceOrAuth("library")}>
                    Deterministic Brand Rulebook
                  </button>
                </li>
                <li>
                  <button type="button" className="cursor-pointer rounded border-0 bg-transparent p-0 text-slate-400 transition-colors hover:text-white" onClick={() => openWorkspaceOrAuth("vault")}>
                    Evidence Vault Passports
                  </button>
                </li>
                <li>
                  <button type="button" className="cursor-pointer rounded border-0 bg-transparent p-0 text-slate-400 transition-colors hover:text-white" onClick={() => openWorkspaceOrAuth("insights")}>
                    33-Case Evaluation Benchmark
                  </button>
                </li>
              </ul>
            </div>

            {/* Col 3: AURA GLOW CAMPAIGN */}
            <div className="space-y-3">
              <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-white">
                Aura Glow Campaign
              </h3>
              <ul className="space-y-2.5 text-xs text-slate-400">
                <li>
                  <button
                    type="button"
                    className="cursor-pointer rounded border-0 bg-transparent p-0 text-slate-400 transition-colors hover:text-white"
                    onClick={() => openWorkspaceOrAuth("intro", "aura-glow-campaign-gallery")}
                  >
                    01 · Money-Back Guarantee Ad
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className="cursor-pointer rounded border-0 bg-transparent p-0 text-slate-400 transition-colors hover:text-white"
                    onClick={() => openWorkspaceOrAuth("intro", "aura-glow-campaign-gallery")}
                  >
                    02 · 3-SKU Packaging Lineup
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className="cursor-pointer rounded border-0 bg-transparent p-0 text-slate-400 transition-colors hover:text-white"
                    onClick={() => openWorkspaceOrAuth("intro", "aura-glow-campaign-gallery")}
                  >
                    03 · Bathroom Mirror Routine
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className="cursor-pointer rounded border-0 bg-transparent p-0 text-slate-400 transition-colors hover:text-white"
                    onClick={() => openWorkspaceOrAuth("intro", "aura-glow-campaign-gallery")}
                  >
                    04 · Cheek Dropper Portrait
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className="cursor-pointer rounded border-0 bg-transparent p-0 text-slate-400 transition-colors hover:text-white"
                    onClick={() => openWorkspaceOrAuth("intro", "aura-glow-campaign-gallery")}
                  >
                    05 · Macro Serum Texture
                  </button>
                </li>
              </ul>
            </div>

            {/* Col 4: PLATFORMS & TOOLS */}
            <div className="space-y-3">
              <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-white">
                Platforms &amp; Safe Zones
              </h3>
              <ul className="space-y-2.5 text-xs text-slate-400">
                <li>LinkedIn Sponsored 1.91:1</li>
                <li>Instagram Story &amp; Reels 9:16</li>
                <li>Meta Feed &amp; Square 4:5</li>
                <li>Landing Page &amp; Display 16:9</li>
                <li>WCAG AA/AAA Contrast Engine</li>
              </ul>
            </div>

            {/* Col 5: GOVERNANCE & ROLES */}
            <div className="space-y-3">
              <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-white">
                Governance &amp; Roles
              </h3>
              <ul className="space-y-2.5 text-xs text-slate-400">
                <li>
                  <button type="button" className="cursor-pointer rounded border-0 bg-transparent p-0 text-slate-400 transition-colors hover:text-white" onClick={() => openWorkspaceOrAuth("queue")}>
                    Four-Eyes Approvals Queue
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className="cursor-pointer rounded border-0 bg-transparent p-0 text-slate-400 transition-colors hover:text-white"
                    onClick={() => {
                      if (ready || !!error) setShowTour(true);
                      else openWorkspaceOrAuth("intro", "try");
                    }}
                  >
                    5-Step Interactive Tour
                  </button>
                </li>
                <li>
                  <button type="button" className="cursor-pointer rounded border-0 bg-transparent p-0 text-slate-400 transition-colors hover:text-white" onClick={() => setShowPrivacy(true)}>
                    Privacy &amp; AI Processing
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className="cursor-pointer rounded border-0 bg-transparent p-0 text-slate-400 transition-colors hover:text-white"
                    onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                  >
                    ↑ Back to Top
                  </button>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Copyright & Quick Links Bar */}
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 font-mono text-xs text-slate-400">
            <p>© {new Date().getFullYear()} BrandLint · {displayCompanyName}. Built for verifiable brand &amp; ad governance.</p>
            <div className="flex flex-wrap items-center gap-5">
              <button type="button" className="cursor-pointer rounded border-0 bg-transparent p-0 text-slate-400 transition-colors hover:text-white" onClick={() => openWorkspaceOrAuth("intro", "how")}>Home</button>
              <button type="button" className="cursor-pointer rounded border-0 bg-transparent p-0 text-slate-400 transition-colors hover:text-white" onClick={() => openWorkspaceOrAuth("review")}>Check Content</button>
              <button type="button" className="cursor-pointer rounded border-0 bg-transparent p-0 text-slate-400 transition-colors hover:text-white" onClick={() => openWorkspaceOrAuth("queue")}>Approvals</button>
              <button type="button" className="cursor-pointer rounded border-0 bg-transparent p-0 text-slate-400 transition-colors hover:text-white" onClick={() => openWorkspaceOrAuth("library")}>Rules</button>
              <button type="button" className="cursor-pointer rounded border-0 bg-transparent p-0 text-slate-400 transition-colors hover:text-white" onClick={() => openWorkspaceOrAuth("vault")}>Facts</button>
              <button type="button" className="cursor-pointer rounded border-0 bg-transparent p-0 text-slate-400 transition-colors hover:text-white" onClick={() => openWorkspaceOrAuth("insights")}>Insights</button>
            </div>
          </div>
        </div>
      </footer>
      {!loaderActive && showTour && !authView && !showAcceptInvite && (
        <WorkspaceTour
          open
          onClose={() => setShowTour(false)}
          currentStepIndex={tourStep}
          onStepChange={setTourStep}
          user={user}
          companyName={displayCompanyName}
          brandName={displayBrandName}
          role={brand?.role || activeCompany?.role}
          privacy={privacy}
          theme={theme}
          onToggleTheme={() => setTheme(t => (t === "dark" ? "light" : "dark"))}
          onNavigate={openWorkspaceOrAuth}
          onOpenAuth={view => {
            setShowTour(false);
            setAuthMsg("");
            setAuthPassword("");
            setAuthView(view);
          }}
          onOpenTeamModal={() => {
            void openTeamModal();
          }}
          onLogout={() => {
            void handleLogout();
          }}
          onSwitchPersona={email => {
            void switchPersona(email);
          }}
          onOpenPrivacy={() => setShowPrivacy(true)}
          onOpenReset={() => setShowReset(true)}
          allowPersonaSwitch={systemMode?.allow_persona_switch !== false}
          allowReset={!!systemMode?.allow_reset}
        />
      )}
      {showPrivacy && <Modal title="Processing & privacy" onClose={() => setShowPrivacy(false)}><div className="space-y-5"><Badge tone={privacy?.hosted ? "success" : "warning"}>{privacy?.hosted ? "Hosted AI processing" : "Local verification"} · {privacy?.provider || "Unknown"}</Badge><p className="text-sm leading-7">{privacy?.notice || "Processing information is unavailable. Reconnect before submitting confidential content."}</p><Notice>Offline checks demonstrate the workflow. They do not establish factual truth or comprehensive claim detection. Source matches and human decisions remain visible.</Notice></div></Modal>}
      {showReset && <Modal title="Reset the demo workspace?" onClose={() => setShowReset(false)}><p className="lv-muted mb-6 text-sm leading-6">This replaces demo drafts, evidence decisions and review history with the original sample data.</p><div className="flex justify-end gap-2"><Button onClick={() => setShowReset(false)}>Cancel</Button><Button variant="danger" disabled={switching} onClick={async () => { setSwitching(true); try { await api.resetDemo(); await switchPersona(DEMO_USERS[0].email); setSelectedDraftId(null); navigate("review"); setShowReset(false); } catch (e) { setError(errorText(e)); } finally { setSwitching(false); } }}>Reset sample data</Button></div></Modal>}
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
                          ? "border-teal/60 bg-teal/15 text-ink"
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
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${teamTab === "members" ? "bg-teal/15 text-iris" : "text-muted hover:text-ink"}`}
                onClick={() => { setTeamTab("members"); setTeamMsg(""); }}
              >
                Members ({members.length})
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${teamTab === "invite" ? "bg-teal/15 text-iris" : "text-muted hover:text-ink"}`}
                onClick={() => { setTeamTab("invite"); setTeamMsg(""); setInviteResult(null); }}
              >
                Invite Member
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${teamTab === "settings" ? "bg-teal/15 text-iris" : "text-muted hover:text-ink"}`}
                onClick={() => { setTeamTab("settings"); setTeamMsg(""); }}
              >
                Settings
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${teamTab === "roles" ? "bg-teal/15 text-iris" : "text-muted hover:text-ink"}`}
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
                              ? "border-teal/60 bg-teal/15 text-ink"
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
              <div className="p-3 bg-teal/10 border border-teal/30 rounded-xl space-y-1">
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
