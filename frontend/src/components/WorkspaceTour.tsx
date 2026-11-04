import React, { useState } from "react";
import { DEMO_USERS, PrivacyInfo, UserInfo } from "../api";
import { Badge, Button, Icon, Modal } from "./ui";

export type TourScreen = "intro" | "review" | "vault" | "queue" | "insights" | "library";

interface WorkspaceTourProps {
  open: boolean;
  onClose: () => void;
  user: UserInfo | null;
  companyName?: string;
  brandName?: string;
  role?: string;
  privacy: PrivacyInfo | null;
  theme: string;
  onToggleTheme: () => void;
  onNavigate: (screen: TourScreen) => void;
  onOpenAuth: (view: "login" | "register") => void;
  onOpenTeamModal: () => void;
  onLogout: () => void;
  onSwitchPersona: (email: string) => void;
  onOpenPrivacy: () => void;
  onOpenReset?: () => void;
  allowPersonaSwitch?: boolean;
  allowReset?: boolean;
}

interface TourStep {
  id: string;
  badge: string;
  title: string;
  location: string;
  icon: string;
  summary: string;
  bullets: { label: string; detail: string }[];
}

const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    badge: "Step 1 of 7 · Welcome",
    title: "Welcome to the BrandLint Workspace",
    location: "Full Governance Desk Overview",
    icon: "shield",
    summary:
      "BrandLint is pre-publication spell-check for your brand, with a human in charge. Every finding links to a rule, every claim links to verifiable evidence, and every approval requires an authorized human.",
    bullets: [
      {
        label: "Top Header Bar",
        detail: "Navigate between the 6 core workspaces, check Live AI status, toggle Dark/Light theme, and manage your account (Log in / Log off).",
      },
      {
        label: "Walkthrough Sub-Bar",
        detail: "Use the 5-step guided strip below the header to jump through a complete 60-second product demo or reset sample data anytime.",
      },
      {
        label: "Role-Based Access",
        detail: "Experience the workspace as a Content Creator, Reviewer, Senior Legal Reviewer, or Brand Owner.",
      },
    ],
  },
  {
    id: "auth",
    badge: "Step 2 of 7 · Account & Access",
    title: "Log In, Log Off & Switch Personas",
    location: "Top-Right Corner of the Header Bar",
    icon: "users",
    summary:
      "Your account control center lives in the top-right corner of the screen. Click your name badge (or the 'Sign in' button) to manage authentication, switch demo personas, or sign out.",
    bullets: [
      {
        label: "Log In & Create Account",
        detail: "Click 'Sign in' to log in with email/password, register a new company account, or use one-click Demo Persona fill.",
      },
      {
        label: "Log Off (Sign Out)",
        detail: "Click your profile button in the top-right corner to open the Workspace & Team modal, then click 'Sign out' in the bottom-right corner.",
      },
      {
        label: "Instant Persona Switcher",
        detail: "In demo mode, switch instantly between Casey (Creator), Riley (Reviewer), Sam (Senior Reviewer), Olivia (Brand Owner), and Noah (Separate Tenant).",
      },
      {
        label: "Team & Invitations",
        detail: "Brand Owners can invite new members, assign roles, and switch between multiple company workspaces.",
      },
    ],
  },
  {
    id: "navigation",
    badge: "Step 3 of 7 · Navigation Tabs",
    title: "The 6 Core Workspace Screens",
    location: "Top Center Navigation Bar",
    icon: "spark",
    summary:
      "Use the 6 tabs in the top navigation bar to move through the complete pre-publication compliance lifecycle:",
    bullets: [
      {
        label: "1. Home",
        detail: "Executive overview with setup progress, recent drafts, pending approvals, and interactive workflow cards.",
      },
      {
        label: "2. Check content",
        detail: "The main Draft Review studio—paste copy, run AI + deterministic checks, inspect claims, and apply fixes.",
      },
      {
        label: "3. Approved facts",
        detail: "The Evidence Vault—browse verified source PDFs, page citations, owners, and expiration dates (current vs. expired).",
      },
      {
        label: "4. Approvals",
        detail: "The Review Queue—where independent reviewers approve clean drafts or where unresolved blockers lock publication.",
      },
      {
        label: "5. Brand rules",
        detail: "The Brand Library—upload guideline PDFs, inspect AI-extracted rules, and publish versioned brand rules.",
      },
      {
        label: "6. Insights",
        detail: "Guideline Health (tracks reviewer overrides & proposes v1 → v2 rule rewrites) plus the 18-Draft Benchmark.",
      },
    ],
  },
  {
    id: "checking",
    badge: "Step 4 of 7 · Draft Review",
    title: "Checking Content & Evidence Passports",
    location: "'Check content' Tab (Screen 2)",
    icon: "file",
    summary:
      "Inside 'Check content', creators write or select a draft, specify Audience, Purpose, and Call-to-Action (CTA), and click 'Run BrandLint Checks'.",
    bullets: [
      {
        label: "Inline Highlighted Findings",
        detail: "Issues are highlighted directly in the text and grouped into Must Fix blockers, Needs Review claims, and Suggestions.",
      },
      {
        label: "Claim Evidence Coverage",
        detail: "The right-hand panel calculates exact proof coverage (supported_claims / detected_claims) and shows Must-Fix blockers.",
      },
      {
        label: "Clickable Evidence Passports",
        detail: "Click any flagged claim to open its Evidence Passport showing the exact PDF source excerpt, owner, and expiration status.",
      },
    ],
  },
  {
    id: "fixes",
    badge: "Step 5 of 7 · Safe Rewrites",
    title: "Intent-Preserving Fixes & Protected Changes",
    location: "'Check content' Tab → Findings List",
    icon: "check",
    summary:
      "BrandLint never silently overwrites your copy. Every suggested fix is shown as a clear before/after diff (− original / + replacement).",
    bullets: [
      {
        label: "One-Click Fix Acceptance",
        detail: "Click 'Accept fix' on routine tone or formatting suggestions to automatically create a new revision and re-verify.",
      },
      {
        label: "Protected Change Confirmation",
        detail: "If a fix alters a product name (e.g. LuminaFlow → Lumina Flow), number (40% → 18%), or CTA, you must check the explicit confirmation box first.",
      },
      {
        label: "Revision Timeline",
        detail: "Every edit is tracked in the revision history dropdown with author attribution and timestamps.",
      },
    ],
  },
  {
    id: "approvals",
    badge: "Step 6 of 7 · Human Sign-Off",
    title: "Risk-Based Routing & Hard Approval Gates",
    location: "'Approvals' Tab (Screen 4)",
    icon: "review",
    summary:
      "AI never approves content on its own. BrandLint enforces four-eyes human governance and blocks unverified claims on the backend.",
    bullets: [
      {
        label: "Standard vs. Senior Routing",
        detail: "Routine drafts route to Standard Review (Riley Chen). Drafts with sensitive or expired claims escalate to Senior Legal Review (Sam Patel).",
      },
      {
        label: "Hard Backend Approval Lock",
        detail: "If a draft has unresolved blockers or expired evidence, the backend blocks approval (HTTP 409) until fixed.",
      },
      {
        label: "Privacy-Preserving Audit Trail",
        detail: "Approvals log cryptographic hashes, rule versions, and reviewer sign-offs without leaking raw draft text into audit logs.",
      },
    ],
  },
  {
    id: "utilities",
    badge: "Step 7 of 7 · Quick Utilities",
    title: "Walkthrough Strip, AI Status, Theme & Reset",
    location: "Top Header & Sub-Header Bar",
    icon: "settings",
    summary:
      "Quick utility controls let you customize your view, verify live AI status, or reset the workspace at any time:",
    bullets: [
      {
        label: "60-Second Judge Walkthrough",
        detail: "Click steps 01 through 05 in the sub-header bar to automatically jump through the complete demo story.",
      },
      {
        label: "Live AI Status Badge",
        detail: "Click the 'Live AI' badge in the top-right to view active Gemini model details and data privacy guarantees.",
      },
      {
        label: "Theme Toggle (Sun / Moon)",
        detail: "Switch between Lustro Velvet (Dark mode) and Daylight (Light mode).",
      },
      {
        label: "Reset Demo Data",
        detail: "Click 'Reset demo' in the sub-header to restore all sample drafts and evidence to their original starting state.",
      },
    ],
  },
];

export const WorkspaceTour: React.FC<WorkspaceTourProps> = ({
  open,
  onClose,
  user,
  companyName,
  brandName,
  role,
  privacy,
  theme,
  onToggleTheme,
  onNavigate,
  onOpenAuth,
  onOpenTeamModal,
  onLogout,
  onSwitchPersona,
  onOpenPrivacy,
  onOpenReset,
  allowPersonaSwitch = true,
  allowReset = true,
}) => {
  const [mode, setMode] = useState<"steps" | "all">("steps");
  const [stepIdx, setStepIdx] = useState(0);
  const [hideOnStartup, setHideOnStartup] = useState<boolean>(() => {
    try {
      return localStorage.getItem("brandlint_hide_tour_on_start") === "true";
    } catch {
      return false;
    }
  });

  if (!open) return null;

  const currentStep = TOUR_STEPS[stepIdx] || TOUR_STEPS[0];

  const handleToggleHideOnStartup = (checked: boolean) => {
    setHideOnStartup(checked);
    try {
      if (checked) {
        localStorage.setItem("brandlint_hide_tour_on_start", "true");
      } else {
        localStorage.removeItem("brandlint_hide_tour_on_start");
      }
    } catch {
      // Ignore storage errors
    }
  };

  const jumpToScreen = (target: TourScreen) => {
    onNavigate(target);
    onClose();
  };

  return (
    <Modal title="Workspace Tour & Interactive Guide" onClose={onClose} wide>
      <div className="space-y-5">
        {/* Top Mode Bar & Status Summary */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line/60 bg-well/60 p-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setMode("steps")}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-medium transition ${
                mode === "steps"
                  ? "bg-violet-500/20 text-ink border border-violet-400/50 shadow-sm"
                  : "bg-transparent text-muted hover:text-ink border border-transparent"
              }`}
            >
              <Icon name="spark" size={14} />
              Step-by-Step Tutorial ({stepIdx + 1}/{TOUR_STEPS.length})
            </button>
            <button
              type="button"
              onClick={() => setMode("all")}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-medium transition ${
                mode === "all"
                  ? "bg-violet-500/20 text-ink border border-violet-400/50 shadow-sm"
                  : "bg-transparent text-muted hover:text-ink border border-transparent"
              }`}
            >
              <Icon name="book" size={14} />
              All Options at a Glance
            </button>
          </div>

          {/* Current Session Pill */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {user ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                <span className="text-muted">Signed in as:</span>
                <strong className="text-ink">{user.name}</strong>
                {(companyName || brandName) && (
                  <span className="text-muted">
                    · {companyName || brandName}
                  </span>
                )}
                {role && (
                  <span className="rounded bg-surface px-1.5 py-0.5 font-mono text-[10px] uppercase text-muted">
                    {role.replace(/_/g, " ")}
                  </span>
                )}
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1">
                <span className="h-2 w-2 rounded-full bg-amber-400" />
                <span className="text-amber-200">Currently signed out</span>
              </div>
            )}
          </div>
        </div>

        {mode === "steps" ? (
          <div className="space-y-5">
            {/* Step Progress Dots */}
            <div className="grid grid-cols-7 gap-1.5">
              {TOUR_STEPS.map((s, idx) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStepIdx(idx)}
                  className={`group flex flex-col gap-1.5 rounded-xl border p-2 text-left transition ${
                    idx === stepIdx
                      ? "border-violet-400/60 bg-violet-500/15 text-ink"
                      : idx < stepIdx
                      ? "border-emerald-500/30 bg-emerald-500/5 text-muted hover:text-ink"
                      : "border-line/50 bg-surface/30 text-muted hover:text-ink"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] font-semibold">
                      0{idx + 1}
                    </span>
                    {idx < stepIdx && (
                      <Icon name="check" size={11} className="text-emerald-400" />
                    )}
                  </div>
                  <span className="hidden truncate text-[11px] font-medium sm:block">
                    {s.title.split(" ")[0]}
                  </span>
                </button>
              ))}
            </div>

            {/* Active Step Card */}
            <div className="rounded-2xl border border-line/70 bg-surface/40 p-5 sm:p-6 space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="accent">{currentStep.badge}</Badge>
                    <span className="inline-flex items-center gap-1 rounded-full border border-line/60 bg-well/70 px-2.5 py-0.5 font-mono text-[11px] text-muted">
                      Where to find it: <strong className="text-ink ml-1">{currentStep.location}</strong>
                    </span>
                  </div>
                  <h3 className="font-display text-xl font-semibold text-ink pt-1">
                    {currentStep.title}
                  </h3>
                </div>
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-violet-400/30 bg-violet-500/15 text-[var(--lv-accent)]">
                  <Icon name={currentStep.icon} size={22} />
                </div>
              </div>

              <p className="text-sm leading-6 text-muted">
                {currentStep.summary}
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                {currentStep.bullets.map((b, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-line/50 bg-well/50 p-3.5 space-y-1"
                  >
                    <div className="flex items-center gap-2 text-xs font-semibold text-ink">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-500/20 font-mono text-[10px] text-[var(--lv-accent)]">
                        {i + 1}
                      </span>
                      <span>{b.label}</span>
                    </div>
                    <p className="text-xs leading-5 text-muted pl-7">
                      {b.detail}
                    </p>
                  </div>
                ))}
              </div>

              {/* Interactive Action Sandbox for the current step */}
              <div className="rounded-xl border border-violet-400/30 bg-violet-500/10 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] uppercase tracking-wider text-ink font-semibold flex items-center gap-1.5">
                    <Icon name="spark" size={13} className="text-[var(--lv-accent)]" />
                    Try These Controls Right Now
                  </span>
                </div>

                {currentStep.id === "welcome" && (
                  <div className="flex flex-wrap gap-2">
                    <Button variant="primary" onClick={() => jumpToScreen("review")}>
                      <Icon name="file" size={14} /> Go to Check Content Studio
                    </Button>
                    <Button variant="secondary" onClick={() => setStepIdx(1)}>
                      See Log In / Log Off Guide <Icon name="arrow" size={13} />
                    </Button>
                    <Button variant="ghost" onClick={() => setMode("all")}>
                      View All Workspace Controls on One Page
                    </Button>
                  </div>
                )}

                {currentStep.id === "auth" && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {user ? (
                        <>
                          <Button
                            variant="primary"
                            onClick={() => {
                              onClose();
                              onOpenTeamModal();
                            }}
                          >
                            <Icon name="settings" size={14} /> Open Account & Team Settings ({user.name})
                          </Button>
                          <Button
                            variant="danger"
                            onClick={() => {
                              onClose();
                              onLogout();
                            }}
                          >
                            Log Off (Sign Out)
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="primary"
                            onClick={() => {
                              onClose();
                              onOpenAuth("login");
                            }}
                          >
                            Log In (Sign In)
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() => {
                              onClose();
                              onOpenAuth("register");
                            }}
                          >
                            Create New Account
                          </Button>
                        </>
                      )}
                    </div>
                    {allowPersonaSwitch && (
                      <div className="space-y-1.5 pt-1">
                        <span className="block text-[11px] text-muted">
                          Or click any Demo Persona below to switch accounts immediately:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {DEMO_USERS.map(u => {
                            const active = user?.email === u.email;
                            return (
                              <button
                                key={u.email}
                                type="button"
                                onClick={() => onSwitchPersona(u.email)}
                                className={`rounded-lg border px-2.5 py-1.5 text-left text-xs transition ${
                                  active
                                    ? "border-emerald-400/60 bg-emerald-500/20 text-ink font-medium"
                                    : "border-line/60 bg-well/70 text-muted hover:text-ink"
                                }`}
                              >
                                {u.label} {active ? "✓" : ""}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {currentStep.id === "navigation" && (
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={() => jumpToScreen("intro")}>
                      <Icon name="spark" size={13} /> 1. Home
                    </Button>
                    <Button variant="primary" onClick={() => jumpToScreen("review")}>
                      <Icon name="file" size={13} /> 2. Check content
                    </Button>
                    <Button variant="secondary" onClick={() => jumpToScreen("vault")}>
                      <Icon name="radar" size={13} /> 3. Approved facts
                    </Button>
                    <Button variant="secondary" onClick={() => jumpToScreen("queue")}>
                      <Icon name="review" size={13} /> 4. Approvals
                    </Button>
                    <Button variant="secondary" onClick={() => jumpToScreen("library")}>
                      <Icon name="book" size={13} /> 5. Brand rules
                    </Button>
                    <Button variant="secondary" onClick={() => jumpToScreen("insights")}>
                      <Icon name="chart" size={13} /> 6. Insights
                    </Button>
                  </div>
                )}

                {currentStep.id === "checking" && (
                  <div className="flex flex-wrap gap-2">
                    <Button variant="primary" onClick={() => jumpToScreen("review")}>
                      <Icon name="file" size={14} /> Open Check Content Studio
                    </Button>
                    <Button variant="secondary" onClick={() => jumpToScreen("vault")}>
                      <Icon name="radar" size={14} /> Inspect Evidence Vault
                    </Button>
                  </div>
                )}

                {currentStep.id === "fixes" && (
                  <div className="flex flex-wrap gap-2">
                    <Button variant="primary" onClick={() => jumpToScreen("review")}>
                      <Icon name="check" size={14} /> Try Accepting Fixes in Draft Review
                    </Button>
                  </div>
                )}

                {currentStep.id === "approvals" && (
                  <div className="flex flex-wrap gap-2">
                    <Button variant="primary" onClick={() => jumpToScreen("queue")}>
                      <Icon name="review" size={14} /> Open Approvals Queue
                    </Button>
                    {allowPersonaSwitch && (
                      <Button
                        variant="secondary"
                        onClick={() => {
                          onSwitchPersona("riley@lumina.demo");
                          jumpToScreen("queue");
                        }}
                      >
                        Switch to Riley (Reviewer) & Open Queue
                      </Button>
                    )}
                  </div>
                )}

                {currentStep.id === "utilities" && (
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={onToggleTheme}>
                      <Icon name={theme === "dark" ? "sun" : "moon"} size={14} />
                      Switch to {theme === "dark" ? "Daylight (Light)" : "Lustro Velvet (Dark)"} Theme
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        onClose();
                        onOpenPrivacy();
                      }}
                    >
                      <Icon name="shield" size={14} /> View AI Status ({privacy?.hosted ? "Live AI" : "Offline Verifier"})
                    </Button>
                    {allowReset && onOpenReset && (
                      <Button
                        variant="ghost"
                        onClick={() => {
                          onClose();
                          onOpenReset();
                        }}
                      >
                        <Icon name="refresh" size={14} /> Reset Demo Data
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Step Navigation Footer */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line/60 pt-4">
              <label className="flex items-center gap-2 text-xs text-muted cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={!hideOnStartup}
                  onChange={e => handleToggleHideOnStartup(!e.target.checked)}
                  className="rounded border-line"
                />
                <span>Show this tutorial automatically when opening the website</span>
              </label>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  disabled={stepIdx === 0}
                  onClick={() => setStepIdx(i => Math.max(0, i - 1))}
                >
                  ← Previous
                </Button>
                {stepIdx < TOUR_STEPS.length - 1 ? (
                  <Button
                    variant="primary"
                    onClick={() => setStepIdx(i => Math.min(TOUR_STEPS.length - 1, i + 1))}
                  >
                    Next Step ({stepIdx + 2}/{TOUR_STEPS.length}) <Icon name="arrow" size={13} />
                  </Button>
                ) : (
                  <Button variant="primary" onClick={onClose}>
                    <Icon name="check" size={14} /> Finish Tour & Start Exploring
                  </Button>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* ALL OPTIONS AT A GLANCE VIEW */
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Card 1: Log In / Log Off & Personas */}
              <div className="rounded-2xl border border-line/70 bg-surface/40 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-500/15 text-[var(--lv-accent)]">
                      <Icon name="users" size={17} />
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold text-ink">1. Log In, Log Off & Account Menu</h3>
                      <span className="text-[11px] text-muted">Location: Top-Right Header Button</span>
                    </div>
                  </div>
                  <Badge tone="accent">Account</Badge>
                </div>
                <ul className="space-y-1.5 text-xs text-muted leading-5">
                  <li>• <strong className="text-ink">Log In / Register:</strong> Click <code className="text-ink">Sign in</code> in the top-right corner to log in or create an account.</li>
                  <li>• <strong className="text-ink">Log Off (Sign Out):</strong> Click your name button (<code className="text-ink">{user?.name || "User"}</code>) in the top-right corner → click <strong className="text-rose-300">Sign out</strong> at the bottom-right of the popup.</li>
                  <li>• <strong className="text-ink">Switch Demo Persona:</strong> Inside the Sign-In or Account menu, switch between Creator, Reviewer, Senior Reviewer, and Brand Owner.</li>
                </ul>
                <div className="flex flex-wrap gap-2 pt-1">
                  {user ? (
                    <>
                      <Button variant="secondary" className="!py-1.5 !text-xs" onClick={() => { onClose(); onOpenTeamModal(); }}>
                        Open Account Menu
                      </Button>
                      <Button variant="danger" className="!py-1.5 !text-xs" onClick={() => { onClose(); onLogout(); }}>
                        Log Off Now
                      </Button>
                    </>
                  ) : (
                    <Button variant="primary" className="!py-1.5 !text-xs" onClick={() => { onClose(); onOpenAuth("login"); }}>
                      Log In Now
                    </Button>
                  )}
                </div>
              </div>

              {/* Card 2: The 6 Main Tabs */}
              <div className="rounded-2xl border border-line/70 bg-surface/40 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-500/15 text-[var(--lv-accent)]">
                      <Icon name="spark" size={17} />
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold text-ink">2. Main Workspace Navigation</h3>
                      <span className="text-[11px] text-muted">Location: Top Center Header Bar</span>
                    </div>
                  </div>
                  <Badge tone="neutral">6 Screens</Badge>
                </div>
                <ul className="space-y-1 text-xs text-muted leading-5">
                  <li>• <strong className="text-ink">Home:</strong> Overview, setup checklist, and pending tasks.</li>
                  <li>• <strong className="text-ink">Check content:</strong> Paste copy, run AI checks, inspect proof, accept fixes.</li>
                  <li>• <strong className="text-ink">Approved facts:</strong> Evidence Vault with source PDFs and expiry dates.</li>
                  <li>• <strong className="text-ink">Approvals:</strong> Human review queue & audit log.</li>
                  <li>• <strong className="text-ink">Brand rules:</strong> Upload PDF guidelines & activate rules.</li>
                  <li>• <strong className="text-ink">Insights:</strong> Guideline Health & 18-draft benchmark.</li>
                </ul>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {(["intro", "review", "vault", "queue", "library", "insights"] as TourScreen[]).map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => jumpToScreen(s)}
                      className="rounded-lg border border-line/60 bg-well px-2.5 py-1 text-[11px] text-ink hover:border-violet-400/50"
                    >
                      Go to {s === "intro" ? "Home" : s} →
                    </button>
                  ))}
                </div>
              </div>

              {/* Card 3: Draft Checking & Evidence Passports */}
              <div className="rounded-2xl border border-line/70 bg-surface/40 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-500/15 text-[var(--lv-accent)]">
                      <Icon name="file" size={17} />
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold text-ink">3. Content Checking & Proof</h3>
                      <span className="text-[11px] text-muted">Location: Check content Studio</span>
                    </div>
                  </div>
                  <Badge tone="success">Core Workflow</Badge>
                </div>
                <ul className="space-y-1.5 text-xs text-muted leading-5">
                  <li>• <strong className="text-ink">Run BrandLint Checks:</strong> Scans draft using fast-path rules + Google Gemini AI.</li>
                  <li>• <strong className="text-ink">Claim Evidence Coverage:</strong> Shows <code className="text-ink">supported / detected</code> claims and active Must-Fix blockers.</li>
                  <li>• <strong className="text-ink">Protected Rewrites:</strong> Side-by-side diffs requiring confirmation when numbers or product names change.</li>
                </ul>
              </div>

              {/* Card 4: Top Bar Utilities & Walkthrough */}
              <div className="rounded-2xl border border-line/70 bg-surface/40 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-500/15 text-[var(--lv-accent)]">
                      <Icon name="settings" size={17} />
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold text-ink">4. Walkthrough, AI Status & Theme</h3>
                      <span className="text-[11px] text-muted">Location: Header & Sub-Header</span>
                    </div>
                  </div>
                  <Badge tone="neutral">Utilities</Badge>
                </div>
                <ul className="space-y-1.5 text-xs text-muted leading-5">
                  <li>• <strong className="text-ink">60-Second Walkthrough Strip:</strong> Click steps <code className="text-ink">01</code> to <code className="text-ink">05</code> below the header for an automated guided demo.</li>
                  <li>• <strong className="text-ink">Live AI Badge:</strong> Shows active Gemini AI status and privacy guarantees.</li>
                  <li>• <strong className="text-ink">Sun / Moon Button:</strong> Toggle between Dark and Daylight themes.</li>
                  <li>• <strong className="text-ink">Reset Demo:</strong> Restores sample data to a fresh state anytime.</li>
                </ul>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line/60 pt-4">
              <Button variant="secondary" onClick={() => setMode("steps")}>
                ← Back to Step-by-Step Tour
              </Button>
              <Button variant="primary" onClick={onClose}>
                <Icon name="check" size={14} /> Close Guide & Start Using BrandLint
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
