import React, { useState } from "react";
import { DEMO_USERS, PrivacyInfo, UserInfo } from "../api";
import { GovernanceOrbit } from "./GovernanceOrbit";
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

type HotspotId = "nav" | "auth" | "ai" | "theme" | "reset";

const HOTSPOTS: Record<
  HotspotId,
  {
    badge: string;
    title: string;
    caption: string;
    icon: string;
  }
> = {
  auth: {
    badge: "Top-Right Control · Account & Access",
    title: "Log In, Log Off & Switch Demo Personas",
    caption: "Click your profile pill to manage team settings or switch personas, or click 'Log off' / 'Log in' directly.",
    icon: "users",
  },
  nav: {
    badge: "Top-Center Control · 6 Workspaces",
    title: "Jump Between the 6 Core Screens",
    caption: "Click any tab below to open Home, Check content, Approved facts, Approvals, Brand rules, or Insights.",
    icon: "spark",
  },
  ai: {
    badge: "Top-Right Control · Engine Status",
    title: "Live Gemini AI & Privacy Status",
    caption: "Inspect active Google Gemini 3.5 Flash-Lite connection status and privacy guarantees.",
    icon: "shield",
  },
  theme: {
    badge: "Top-Right Control · Appearance",
    title: "Dark / Daylight Theme Toggle",
    caption: "Switch instantly between Lustro Velvet (Dark) and Daylight (Light) workspace themes.",
    icon: "sun",
  },
  reset: {
    badge: "Sub-Header Control · Demo State",
    title: "One-Click Demo Reset",
    caption: "Restore all sample drafts, evidence passports, and review history to their clean initial state.",
    icon: "refresh",
  },
};

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
  const [activeHotspot, setActiveHotspot] = useState<HotspotId>("auth");
  const [hideOnStartup, setHideOnStartup] = useState<boolean>(() => {
    try {
      return localStorage.getItem("brandlint_hide_tour_on_start") === "true";
    } catch {
      return false;
    }
  });

  if (!open) return null;

  const spot = HOTSPOTS[activeHotspot];

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
    <Modal title="Interactive Visual Workspace Guide" onClose={onClose} wide>
      <div className="space-y-6">
        {/* 1. Interactive Visual Header Map (Click any control to inspect & trigger) */}
        <div className="rounded-2xl border border-violet-400/35 bg-well/70 p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Badge tone="accent">
                <Icon name="radar" size={12} /> Interactive Control Map
              </Badge>
              <span className="text-xs text-muted">
                Click any highlighted zone on the bar below to see what it does or trigger it live:
              </span>
            </div>
            {user && (
              <span className="font-mono text-[11px] text-muted">
                Active: <strong className="text-ink">{user.name}</strong>
                {(companyName || brandName) ? ` · ${companyName || brandName}` : ""}
                {role ? ` (${role.replace(/_/g, " ")})` : ""}
              </span>
            )}
          </div>

          {/* Visual Mockup of the Top Header Bar */}
          <div className="rounded-2xl border border-line/80 bg-surface/80 p-3 shadow-inner">
            <div className="flex flex-wrap items-center justify-between gap-2">
              {/* Brand Logo + Navigation Tabs Zone */}
              <div
                onClick={() => setActiveHotspot("nav")}
                className={`flex flex-wrap items-center gap-1.5 rounded-xl border p-1.5 cursor-pointer transition ${
                  activeHotspot === "nav"
                    ? "border-violet-400 bg-violet-500/15 shadow-sm"
                    : "border-line/50 bg-well/50 hover:border-violet-400/40"
                }`}
              >
                <span className="inline-flex items-center gap-1.5 px-2 py-1 font-display text-xs font-semibold text-ink">
                  <Icon name="shield" size={14} className="text-[var(--lv-accent)]" />
                  BrandLint
                </span>
                {(
                  [
                    { id: "intro", label: "Home", icon: "spark" },
                    { id: "review", label: "Check content", icon: "file" },
                    { id: "vault", label: "Approved facts", icon: "radar" },
                    { id: "queue", label: "Approvals", icon: "review" },
                    { id: "library", label: "Brand rules", icon: "book" },
                    { id: "insights", label: "Insights", icon: "chart" },
                  ] as { id: TourScreen; label: string; icon: string }[]
                ).map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      setActiveHotspot("nav");
                      jumpToScreen(t.id);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-line/60 bg-well/80 px-2.5 py-1 text-[11px] text-ink hover:border-violet-400/60 hover:bg-violet-500/20 transition"
                    title={`Open ${t.label}`}
                  >
                    <Icon name={t.icon} size={11} />
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>

              {/* Right Utility & Account Controls Zone */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Live AI Badge Hotspot */}
                <button
                  type="button"
                  onClick={() => setActiveHotspot("ai")}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs transition ${
                    activeHotspot === "ai"
                      ? "border-emerald-400 bg-emerald-500/20 text-ink"
                      : "border-line/60 bg-well/60 text-muted hover:text-ink"
                  }`}
                >
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  <span>{privacy?.hosted ? "Live AI" : "Verifier"}</span>
                </button>

                {/* Theme Toggle Hotspot */}
                <button
                  type="button"
                  onClick={() => setActiveHotspot("theme")}
                  className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs transition ${
                    activeHotspot === "theme"
                      ? "border-violet-400 bg-violet-500/20 text-ink"
                      : "border-line/60 bg-well/60 text-muted hover:text-ink"
                  }`}
                >
                  <Icon name={theme === "dark" ? "sun" : "moon"} size={14} />
                  <span className="hidden sm:inline">Theme</span>
                </button>

                {/* Reset Hotspot */}
                {allowReset && (
                  <button
                    type="button"
                    onClick={() => setActiveHotspot("reset")}
                    className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs transition ${
                      activeHotspot === "reset"
                        ? "border-violet-400 bg-violet-500/20 text-ink"
                        : "border-line/60 bg-well/60 text-muted hover:text-ink"
                    }`}
                  >
                    <Icon name="refresh" size={13} />
                    <span className="hidden sm:inline">Reset</span>
                  </button>
                )}

                {/* Log In / Log Off & Persona Hotspot */}
                <button
                  type="button"
                  onClick={() => setActiveHotspot("auth")}
                  className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
                    activeHotspot === "auth"
                      ? "border-violet-400 bg-violet-500/25 text-ink ring-2 ring-violet-400/30"
                      : "border-line/70 bg-well text-ink hover:border-violet-400/50"
                  }`}
                >
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  <span>{user ? user.name : "Log in"}</span>
                  <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] text-rose-300 border border-rose-500/30">
                    {user ? "Log off" : "Sign in"}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Active Hotspot Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line/60 bg-surface/50 p-3.5">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-violet-400/30 bg-violet-500/15 text-[var(--lv-accent)]">
                <Icon name={spot.icon} size={18} />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--lv-accent)]">
                    {spot.badge}
                  </span>
                </div>
                <h4 className="text-sm font-semibold text-ink">{spot.title}</h4>
                <p className="text-xs text-muted mt-0.5">{spot.caption}</p>
              </div>
            </div>

            {/* Direct Live Actions for Selected Hotspot */}
            <div className="flex flex-wrap items-center gap-2">
              {activeHotspot === "auth" && (
                <>
                  {user ? (
                    <>
                      <Button
                        variant="secondary"
                        className="!min-h-8 !px-3 !py-1 !text-xs"
                        onClick={() => {
                          onClose();
                          onOpenTeamModal();
                        }}
                      >
                        <Icon name="settings" size={13} /> Account & Team
                      </Button>
                      <Button
                        variant="danger"
                        className="!min-h-8 !px-3 !py-1 !text-xs"
                        onClick={() => {
                          onClose();
                          onLogout();
                        }}
                      >
                        Log Off Now
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="primary"
                        className="!min-h-8 !px-3 !py-1 !text-xs"
                        onClick={() => {
                          onClose();
                          onOpenAuth("login");
                        }}
                      >
                        Log In
                      </Button>
                      <Button
                        variant="secondary"
                        className="!min-h-8 !px-3 !py-1 !text-xs"
                        onClick={() => {
                          onClose();
                          onOpenAuth("register");
                        }}
                      >
                        Create Account
                      </Button>
                    </>
                  )}
                  {allowPersonaSwitch && (
                    <div className="flex flex-wrap items-center gap-1 border-l border-line/60 pl-2">
                      {DEMO_USERS.map(u => {
                        const isCurrent = user?.email === u.email;
                        return (
                          <button
                            key={u.email}
                            type="button"
                            onClick={() => onSwitchPersona(u.email)}
                            className={`rounded-lg border px-2 py-1 text-[11px] transition ${
                              isCurrent
                                ? "border-emerald-400/60 bg-emerald-500/20 text-ink font-semibold"
                                : "border-line/60 bg-well text-muted hover:text-ink"
                            }`}
                            title={`Switch to ${u.label}`}
                          >
                            {u.label.split(" ")[0]}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              )}

              {activeHotspot === "ai" && (
                <Button
                  variant="primary"
                  className="!min-h-8 !px-3 !py-1 !text-xs"
                  onClick={() => {
                    onClose();
                    onOpenPrivacy();
                  }}
                >
                  Open AI & Privacy Details
                </Button>
              )}

              {activeHotspot === "theme" && (
                <Button
                  variant="primary"
                  className="!min-h-8 !px-3 !py-1 !text-xs"
                  onClick={onToggleTheme}
                >
                  <Icon name={theme === "dark" ? "sun" : "moon"} size={13} />
                  Switch to {theme === "dark" ? "Daylight" : "Dark"} Mode
                </Button>
              )}

              {activeHotspot === "reset" && allowReset && onOpenReset && (
                <Button
                  variant="danger"
                  className="!min-h-8 !px-3 !py-1 !text-xs"
                  onClick={() => {
                    onClose();
                    onOpenReset();
                  }}
                >
                  <Icon name="refresh" size={13} /> Reset Demo Workspace
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* 2. Interactive 3D Orbital Visual Guide */}
        <GovernanceOrbit
          mode="full"
          activeScreen="intro"
          onNavigate={target => {
            onNavigate(target);
            onClose();
          }}
        />

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line/60 pt-3">
          <label className="flex items-center gap-2 text-xs text-muted cursor-pointer select-none">
            <input
              type="checkbox"
              checked={!hideOnStartup}
              onChange={e => handleToggleHideOnStartup(!e.target.checked)}
              className="rounded border-line"
            />
            <span>Pop up this visual guide automatically when opening the website</span>
          </label>

          <Button variant="primary" onClick={onClose}>
            <Icon name="check" size={14} /> Start Exploring Workspace
          </Button>
        </div>
      </div>
    </Modal>
  );
};
