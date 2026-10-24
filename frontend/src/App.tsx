import React, { useEffect, useState } from "react";
import {
  api,
  BrandInfo,
  DEMO_USERS,
  getToken,
  PrivacyInfo,
  setToken,
  UserInfo,
} from "./api";
import { BrandLibrary } from "./screens/BrandLibrary";
import { DraftReview } from "./screens/DraftReview";
import { EvidenceVault } from "./screens/EvidenceVault";
import { Insights } from "./screens/Insights";
import { ReviewQueue } from "./screens/ReviewQueue";
import { AppleIntro } from "./screens/AppleIntro";
import { Loader } from "./components/Loader";
import { GlobalWorkflowFlowchart } from "./components/Flowcharts";

type Screen = "intro" | "library" | "review" | "vault" | "queue" | "insights";

const DEMO_STEPS = [
  {
    step: 1,
    title: "1. Ingest Guidelines & Rules",
    desc: "Ingest brand guidelines and view active governance rules.",
    screen: "library" as Screen,
    persona: "olivia@lumina.demo",
  },
  {
    step: 2,
    title: "2. Check Hero Draft",
    desc: "Scan launch email, inspect deterministic flags and suggested fixes.",
    screen: "review" as Screen,
    persona: "casey@lumina.demo",
  },
  {
    step: 3,
    title: "3. Verify Evidence Passports",
    desc: "Inspect EV-4 expired proof vs EV-1 approved throughput citation.",
    screen: "vault" as Screen,
    persona: "casey@lumina.demo",
  },
  {
    step: 4,
    title: "4. Human Sign-Off Gate",
    desc: "Reviewer Riley Chen enforces approval gate and records audit trail.",
    screen: "queue" as Screen,
    persona: "riley@lumina.demo",
  },
  {
    step: 5,
    title: "5. Policy Health & Clarifications",
    desc: "Monitor rule overrides and approve v2 wording as Brand Owner.",
    screen: "insights" as Screen,
    persona: "olivia@lumina.demo",
  },
];

export const App: React.FC = () => {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [brand, setBrand] = useState<BrandInfo | null>(null);
  const [privacy, setPrivacy] = useState<PrivacyInfo | null>(null);
  const [screen, setScreen] = useState<Screen>("intro");
  const [selectedDraftId, setSelectedDraftId] = useState<number | null>(1);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showGuide, setShowGuide] = useState(true);
  const [activeStep, setActiveStep] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState("");

  const bootstrap = async (email?: string) => {
    setError("");
    try {
      if (email || !getToken()) {
        const res = await api.login(email || DEMO_USERS[0].email);
        setToken(res.token);
      }
      const me = await api.me();
      setUser(me.user);
      setBrand(me.brands[0] || null);
      setPrivacy(me.privacy);
    } catch {
      const res = await api.login(DEMO_USERS[0].email);
      setToken(res.token);
      const me = await api.me();
      setUser(me.user);
      setBrand(me.brands[0] || null);
      setPrivacy(me.privacy);
    }
  };

  useEffect(() => {
    bootstrap();
  }, []);

  const switchPersona = async (email: string) => {
    await bootstrap(email);
    setRefreshKey((k) => k + 1);
  };

  const handleResetDemo = async () => {
    try {
      await api.resetDemo();
      await bootstrap(DEMO_USERS[0].email);
      setSelectedDraftId(1);
      setScreen("review");
      setActiveStep(0);
      setRefreshKey((k) => k + 1);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to reset demo");
    }
  };

  const handleStepClick = async (idx: number) => {
    setActiveStep(idx);
    const s = DEMO_STEPS[idx];
    if (user && user.email !== s.persona) {
      await switchPersona(s.persona);
    }
    if (s.step <= 4) setSelectedDraftId(1);
    setScreen(s.screen);
  };

  const ready = !!user && !!brand;

  return (
    <>
    <Loader ready={ready} />
    {ready && user && brand && (
    <div className="app-shell">
      {/* Top Harbor Progress Bar */}
      <div
        className="progress"
        aria-hidden="true"
        style={{ transform: `scaleX(${((activeStep + 1) / DEMO_STEPS.length)})` }}
      ></div>

      {/* Top Header */}
      <header className="top-nav">
        <div className="brand-mark">
          <div className="logo-badge" title="BrandLint Spell-Check">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <path d="m9 12 2 2 4-4"/>
            </svg>
          </div>
          <div>
            <div className="brand-title">
              BrandLint <span className="brand-tag">Audit-Grade Brand Desk</span>
            </div>
          </div>
        </div>

        <nav className="main-tabs" aria-label="Main Navigation">
          <button
            className={`nav-tab ${screen === "intro" ? "active" : ""}`}
            onClick={() => setScreen("intro")}
          >
            <span className="tab-num">00</span> Overview
          </button>
          <button
            className={`nav-tab ${screen === "library" ? "active" : ""}`}
            onClick={() => setScreen("library")}
          >
            <span className="tab-num">01</span> Brand Library
          </button>
          <button
            className={`nav-tab ${screen === "review" ? "active" : ""}`}
            onClick={() => setScreen("review")}
          >
            <span className="tab-num">02</span> Draft Review
          </button>
          <button
            className={`nav-tab ${screen === "vault" ? "active" : ""}`}
            onClick={() => setScreen("vault")}
          >
            <span className="tab-num">03</span> Evidence Vault
          </button>
          <button
            className={`nav-tab ${screen === "queue" ? "active" : ""}`}
            onClick={() => setScreen("queue")}
          >
            <span className="tab-num">04</span> Review Queue
          </button>
          <button
            className={`nav-tab ${screen === "insights" ? "active" : ""}`}
            onClick={() => setScreen("insights")}
          >
            <span className="tab-num">05</span> Insights & Health
          </button>
        </nav>

        <div className="top-controls">
          <div className="persona-switcher">
            <span className="meta-label">ACTIVE ROLE</span>
            <select
              value={user.email}
              onChange={(e) => switchPersona(e.target.value)}
              aria-label="Switch active user persona"
            >
              {DEMO_USERS.map((u) => (
                <option key={u.email} value={u.email}>
                  {u.label} — {u.role}
                </option>
              ))}
            </select>
          </div>

          <button
            className="btn btn-sm btn-nav-ai"
            onClick={() => setShowPrivacy(!showPrivacy)}
            title="Inspect AI processing & privacy posture"
          >
            <span className="ai-dot"></span>
            AI: {privacy?.hosted ? `Hosted (${privacy.provider})` : "Local Engine"}
          </button>

          <button className="btn btn-sm" onClick={() => setShowGuide(!showGuide)}>
            {showGuide ? "Hide Pipeline" : "Show Pipeline"}
          </button>

          <button
            className="btn btn-ghost btn-sm btn-reset"
            onClick={handleResetDemo}
            title="Reset database to initial seeded demo state"
          >
            <span className="reset-icon">↺</span> Reset Demo
          </button>
        </div>
      </header>

      {showPrivacy && privacy && (
        <div className="privacy-drawer">
          <div className="privacy-content">
            <span className="privacy-badge">🔒 PRIVACY GUARANTEE</span>
            <span><strong>Data & Model Security:</strong> {privacy.notice}</span>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowPrivacy(false)}>
            Close ✕
          </button>
        </div>
      )}

      {/* Interactive Global Workflow Pipeline (replaces bulky text demo strip) */}
      {showGuide && screen !== "intro" && (
        <GlobalWorkflowFlowchart
          activeStep={activeStep}
          onStepClick={handleStepClick}
        />
      )}

      {error && <div className="banner banner-error">{error}</div>}

      {/* Main Screen Content */}
      <main className={`${screen === "intro" ? "main-intro-wrap" : "main-area"} screen-enter`} key={`${screen}-${refreshKey}`}>
        {screen === "intro" && (
          <AppleIntro
            onOpenScreen={(s) => setScreen(s)}
            onLaunchDraft={async (draftId, persona) => {
              setSelectedDraftId(draftId);
              if (persona && user.email !== persona) {
                await switchPersona(persona);
              }
              setScreen("review");
            }}
            onLaunchStep={async (idx) => {
              setActiveStep(idx);
              const s = DEMO_STEPS[idx];
              if (user.email !== s.persona) {
                await switchPersona(s.persona);
              }
              if (s.step <= 4) setSelectedDraftId(1);
              setScreen(s.screen);
            }}
          />
        )}

        {screen === "library" && <BrandLibrary brandId={brand.id} role={brand.role} />}

        {screen === "review" && (
          <DraftReview
            brandId={brand.id}
            role={brand.role}
            selectedDraftId={selectedDraftId}
            onSelectDraft={(id) => setSelectedDraftId(id)}
            onOpenQueue={(id) => {
              setSelectedDraftId(id);
              setScreen("queue");
            }}
          />
        )}

        {screen === "vault" && <EvidenceVault brandId={brand.id} role={brand.role} />}

        {screen === "queue" && (
          <ReviewQueue
            brandId={brand.id}
            role={brand.role}
            selectedDraftId={selectedDraftId}
            onSelectDraft={(id) => setSelectedDraftId(id)}
            onOpenEditor={(id) => {
              setSelectedDraftId(id);
              setScreen("review");
            }}
          />
        )}

        {screen === "insights" && <Insights brandId={brand.id} role={brand.role} />}
      </main>
    </div>
    )}
    </>
  );
};
