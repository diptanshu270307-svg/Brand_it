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

type Screen = "library" | "review" | "vault" | "queue" | "insights";

const DEMO_STEPS = [
  {
    step: 1,
    title: "1. Check the Hero Draft",
    desc: "In Draft Review, select “Launch email - productivity claim” (“Our platform guarantees 40% higher productivity.”) and click Run BrandLint Checks.",
    screen: "review" as Screen,
    persona: "casey@lumina.demo",
  },
  {
    step: 2,
    title: "2. Inspect Expired Proof & Accept Tone Fix",
    desc: "Click the 40% claim to open its Expired Evidence Passport (EV-4). Accept the “guarantees → helps deliver” fix, then click Test Approval Gate — the expired claim still blocks approval!",
    screen: "review" as Screen,
    persona: "casey@lumina.demo",
  },
  {
    step: 3,
    title: "3. Replace with Evidence-Backed Statement",
    desc: "Accept the TERM-01 product name fix and the evidence-backed 18% throughput rewrite (confirming the protected number change), then click Submit for Review.",
    screen: "review" as Screen,
    persona: "casey@lumina.demo",
  },
  {
    step: 4,
    title: "4. Human Approval & Audit Trail",
    desc: "Switch to Riley Chen (Reviewer) in Review Queue, approve Revision #4 with a note, and inspect the decision & privacy-preserving audit log.",
    screen: "queue" as Screen,
    persona: "riley@lumina.demo",
  },
  {
    step: 5,
    title: "5. Guideline Health Clarification",
    desc: "Open Insights, see TONE-01 overridden 6 times, click Suggest Clearer Wording, and switch to Olivia Brooks (Brand Owner) to approve TONE-01@2.",
    screen: "insights" as Screen,
    persona: "olivia@lumina.demo",
  },
];

export const App: React.FC = () => {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [brand, setBrand] = useState<BrandInfo | null>(null);
  const [privacy, setPrivacy] = useState<PrivacyInfo | null>(null);
  const [screen, setScreen] = useState<Screen>("review");
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

  if (!user || !brand) {
    return (
      <div className="loading-shell">
        <div className="loading-card">Loading BrandLint Review Desk...</div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      {/* Top Header */}
      <header className="top-nav">
        <div className="brand-mark">
          <div className="logo-badge" title="BrandLint Spell-Check">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <path d="m9 12 2 2 4-4"/>
            </svg>
          </div>
          <div>
            <div className="brand-title">
              BrandLint <span className="brand-tag">Spell-check for your brand</span>
            </div>
            <div className="brand-pitch">
              “BrandLint connects every finding to a rule, every claim to evidence, and every
              approval to a human.”
            </div>
          </div>
        </div>

        <nav className="main-tabs" aria-label="Main Navigation">
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
            <span className="meta-label">ACTIVE HUMAN ROLE</span>
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
            {showGuide ? "Hide Pitch Guide" : "Show Pitch Guide"}
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

      {/* Guided Hackathon Demo Strip */}
      {showGuide && (
        <div className="demo-strip">
          <div className="demo-strip-head">
            <div className="demo-strip-title-row">
              <span className="eyebrow">REPEATABLE PITCH WALKTHROUGH</span>
              <span className="step-badge">STEP {activeStep + 1} OF {DEMO_STEPS.length}</span>
            </div>
            <span className="muted-sm">
              Click any step below to instantly switch to the target screen and role:
            </span>
          </div>
          <div className="demo-steps">
            {DEMO_STEPS.map((s, idx) => (
              <button
                key={s.step}
                className={`demo-step-card ${activeStep === idx ? "active" : ""}`}
                onClick={async () => {
                  setActiveStep(idx);
                  if (user.email !== s.persona) {
                    await switchPersona(s.persona);
                  }
                  if (s.step <= 4) setSelectedDraftId(1);
                  setScreen(s.screen);
                }}
              >
                <div className="demo-step-top">
                  <span className="step-num-pill">{s.step}</span>
                  <span className="step-target-role">
                    {s.persona.includes("casey") ? "Creator" : s.persona.includes("riley") ? "Senior Reviewer" : "Brand Owner"}
                  </span>
                </div>
                <div className="demo-step-title">{s.title.replace(/^\d+\.\s*/, "")}</div>
                <div className="demo-step-desc">{s.desc}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <div className="banner banner-error">{error}</div>}

      {/* Main Screen Content */}
      <main className="main-area" key={refreshKey}>
        {screen === "library" && <BrandLibrary brandId={brand.id} role={brand.role} />}
        {screen === "review" && (
          <DraftReview
            brandId={brand.id}
            role={brand.role}
            selectedDraftId={selectedDraftId}
            onSelectDraft={setSelectedDraftId}
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
            onSelectDraft={setSelectedDraftId}
            onOpenEditor={(id) => {
              setSelectedDraftId(id);
              setScreen("review");
            }}
          />
        )}
        {screen === "insights" && <Insights brandId={brand.id} role={brand.role} />}
      </main>
    </div>
  );
};
