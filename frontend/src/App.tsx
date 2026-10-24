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
  const [showGuide, setShowGuide] = useState(false);
  const [showWorkspacesMenu, setShowWorkspacesMenu] = useState(false);
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

  // Close three-dot menu when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".three-dots-menu-wrap")) {
        setShowWorkspacesMenu(false);
      }
    };
    if (showWorkspacesMenu) {
      window.addEventListener("click", handleOutsideClick);
      return () => window.removeEventListener("click", handleOutsideClick);
    }
  }, [showWorkspacesMenu]);

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
          {/* Top Progress Bar */}
          <div
            className="progress"
            aria-hidden="true"
            style={{
              transform: `scaleX(${(activeStep + 1) / DEMO_STEPS.length})`,
            }}
          ></div>

          {/* Top Header matching reference dark bar with three-dot dropdown */}
          <header className="top-nav top-nav-modern">
            <div
              className="brand-mark"
              onClick={() => setScreen("intro")}
              style={{ cursor: "pointer" }}
              title="BrandLint Home"
            >
              <div className="logo-badge" title="BrandLint Spell-Check">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
              </div>
              <div>
                <div className="brand-title">
                  BrandLint <span className="brand-tag">Governance</span>
                </div>
              </div>
            </div>

            {/* Center navigation links matching reference layout */}
            <nav className="nav-center-links" aria-label="Main Section Links">
              <button
                type="button"
                className={`nav-link-item ${screen === "intro" ? "active" : ""}`}
                onClick={() => setScreen("intro")}
              >
                Overview
              </button>
              <a
                href="#features"
                className="nav-link-item"
                onClick={(e) => {
                  if (screen !== "intro") {
                    e.preventDefault();
                    setScreen("intro");
                    setTimeout(
                      () =>
                        document
                          .getElementById("features")
                          ?.scrollIntoView({ behavior: "smooth" }),
                      100
                    );
                  }
                }}
              >
                Features
              </a>
              <a
                href="#metrics"
                className="nav-link-item"
                onClick={(e) => {
                  if (screen !== "intro") {
                    e.preventDefault();
                    setScreen("intro");
                    setTimeout(
                      () =>
                        document
                          .getElementById("metrics")
                          ?.scrollIntoView({ behavior: "smooth" }),
                      100
                    );
                  }
                }}
              >
                Benchmarks
              </a>
              <a
                href="#platform"
                className="nav-link-item"
                onClick={(e) => {
                  if (screen !== "intro") {
                    e.preventDefault();
                    setScreen("intro");
                    setTimeout(
                      () =>
                        document
                          .getElementById("platform")
                          ?.scrollIntoView({ behavior: "smooth" }),
                      100
                    );
                  }
                }}
              >
                Platform
              </a>
            </nav>

            <div className="top-controls">
              <div className="persona-switcher">
                <span className="meta-label">ROLE</span>
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

              {/* Three-Dot Dropdown Menu for Workspaces */}
              <div className="three-dots-menu-wrap">
                <button
                  type="button"
                  className={`btn-three-dots ${showWorkspacesMenu ? "active" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowWorkspacesMenu(!showWorkspacesMenu);
                  }}
                  title="Review Desk Workspaces & Actions"
                  aria-expanded={showWorkspacesMenu}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <circle cx="12" cy="5" r="2.2" />
                    <circle cx="12" cy="12" r="2.2" />
                    <circle cx="12" cy="19" r="2.2" />
                  </svg>
                  <span className="three-dots-label">Workspaces</span>
                  <span className="three-dots-arrow">▾</span>
                </button>

                {showWorkspacesMenu && (
                  <div
                    className="dropdown-popover"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="dropdown-section-title">
                      REVIEW DESK WORKSPACES
                    </div>

                    <button
                      type="button"
                      className={`dropdown-item ${
                        screen === "library" ? "item-active" : ""
                      }`}
                      onClick={() => {
                        setScreen("library");
                        setShowWorkspacesMenu(false);
                      }}
                    >
                      <div className="dropdown-item-icon bg-blue">
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                        </svg>
                      </div>
                      <div className="dropdown-item-text">
                        <div className="dropdown-item-title">
                          01 · Brand Library
                          {screen === "library" && (
                            <span className="pill-dot">Active</span>
                          )}
                        </div>
                        <div className="dropdown-item-sub">
                          Brand guidelines, rule extraction & owner gates
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      className={`dropdown-item ${
                        screen === "review" ? "item-active" : ""
                      }`}
                      onClick={() => {
                        setScreen("review");
                        setShowWorkspacesMenu(false);
                      }}
                    >
                      <div className="dropdown-item-icon bg-green">
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <circle cx="12" cy="12" r="10" />
                          <line x1="22" y1="12" x2="18" y2="12" />
                          <line x1="6" y1="12" x2="2" y2="12" />
                          <line x1="12" y1="6" x2="12" y2="2" />
                          <line x1="12" y1="22" x2="12" y2="18" />
                        </svg>
                      </div>
                      <div className="dropdown-item-text">
                        <div className="dropdown-item-title">
                          02 · Draft Review Desk
                          {screen === "review" && (
                            <span className="pill-dot">Active</span>
                          )}
                        </div>
                        <div className="dropdown-item-sub">
                          Pre-flight checks, evidence matches & intent diffs
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      className={`dropdown-item ${
                        screen === "vault" ? "item-active" : ""
                      }`}
                      onClick={() => {
                        setScreen("vault");
                        setShowWorkspacesMenu(false);
                      }}
                    >
                      <div className="dropdown-item-icon bg-purple">
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                          <path d="m9 12 2 2 4-4" />
                        </svg>
                      </div>
                      <div className="dropdown-item-text">
                        <div className="dropdown-item-title">
                          03 · Evidence Vault
                          {screen === "vault" && (
                            <span className="pill-dot">Active</span>
                          )}
                        </div>
                        <div className="dropdown-item-sub">
                          Claim passports, excerpts & expiry dates
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      className={`dropdown-item ${
                        screen === "queue" ? "item-active" : ""
                      }`}
                      onClick={() => {
                        setScreen("queue");
                        setShowWorkspacesMenu(false);
                      }}
                    >
                      <div className="dropdown-item-icon bg-amber">
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                          <path d="m16 11 2 2 4-4" />
                        </svg>
                      </div>
                      <div className="dropdown-item-text">
                        <div className="dropdown-item-title">
                          04 · Review Queue
                          {screen === "queue" && (
                            <span className="pill-dot">Active</span>
                          )}
                        </div>
                        <div className="dropdown-item-sub">
                          Senior review routes & human approval gates
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      className={`dropdown-item ${
                        screen === "insights" ? "item-active" : ""
                      }`}
                      onClick={() => {
                        setScreen("insights");
                        setShowWorkspacesMenu(false);
                      }}
                    >
                      <div className="dropdown-item-icon bg-cyan">
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                        </svg>
                      </div>
                      <div className="dropdown-item-text">
                        <div className="dropdown-item-title">
                          05 · Insights & Health
                          {screen === "insights" && (
                            <span className="pill-dot">Active</span>
                          )}
                        </div>
                        <div className="dropdown-item-sub">
                          Rule override analytics & wording tuning
                        </div>
                      </div>
                    </button>

                    <div className="dropdown-divider" />
                    <div className="dropdown-section-title">
                      DEMO & PRIVACY TOOLS
                    </div>

                    <div className="dropdown-actions-row">
                      <button
                        type="button"
                        className="btn btn-sm btn-ghost"
                        onClick={() => {
                          setShowPrivacy(true);
                          setShowWorkspacesMenu(false);
                        }}
                      >
                        🔒 AI Privacy
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-ghost"
                        onClick={() => {
                          setShowGuide(!showGuide);
                          setShowWorkspacesMenu(false);
                        }}
                      >
                        {showGuide ? "Hide Pipeline" : "Show Pipeline"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-ghost"
                        onClick={() => {
                          handleResetDemo();
                          setShowWorkspacesMenu(false);
                        }}
                      >
                        ↺ Reset Demo
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Primary Green Pill CTA matching reference design */}
              <button
                type="button"
                className="btn-crypgo-green"
                onClick={() => setScreen("review")}
                title="Launch Draft Review Desk"
              >
                Open Review Desk →
              </button>
            </div>
          </header>

          {showPrivacy && privacy && (
            <div className="privacy-drawer">
              <div className="privacy-content">
                <span className="privacy-badge">🔒 PRIVACY GUARANTEE</span>
                <span>
                  <strong>Data & Model Security:</strong> {privacy.notice}
                </span>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setShowPrivacy(false)}
              >
                Close ✕
              </button>
            </div>
          )}

          {/* Interactive Global Workflow Pipeline (if toggled) */}
          {showGuide && screen !== "intro" && (
            <GlobalWorkflowFlowchart
              activeStep={activeStep}
              onStepClick={handleStepClick}
            />
          )}

          {error && <div className="banner banner-error">{error}</div>}

          {/* Main Screen Content */}
          <main
            className={`${
              screen === "intro" ? "main-intro-wrap" : "main-area"
            } screen-enter`}
            key={`${screen}-${refreshKey}`}
          >
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

            {screen === "library" && (
              <BrandLibrary brandId={brand.id} role={brand.role} />
            )}

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

            {screen === "vault" && (
              <EvidenceVault brandId={brand.id} role={brand.role} />
            )}

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

            {screen === "insights" && (
              <Insights brandId={brand.id} role={brand.role} />
            )}
          </main>
        </div>
      )}
    </>
  );
};
