import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CompanyInfo, DEMO_USERS, PrivacyInfo, SystemModeInfo, UserInfo } from "../api";
import { BrandLintLogo, Icon } from "./ui";
import "./Navbar.css";

export type NavScreen = "intro" | "review" | "vault" | "queue" | "insights" | "library";
export type TopSection = "product" | "demo" | "contact";

interface MegaMenuItem {
  id: string;
  label: string;
  description: string;
  icon: string;
  active?: boolean;
  onSelect: () => void;
}

interface MegaMenuGroup {
  heading: "Workflow" | "Governance" | "Resources";
  items: MegaMenuItem[];
}

export interface NavbarProps {
  user: UserInfo | null;
  ready: boolean;
  brandName: string;
  companyName: string;
  activeScreen: NavScreen;
  activeRoleLabel: string;
  theme: string;
  companies: CompanyInfo[];
  activeCompanyId?: number | null;
  privacy: PrivacyInfo | null;
  systemMode: SystemModeInfo | null;
  switching: boolean;
  onSelectSection: (section: TopSection) => void;
  onNavigateWorkspace: (screen: NavScreen, anchorId?: string) => void;
  onPrimaryCta: () => void;
  onToggleTheme: () => void;
  onSwitchWorkspace: (companyId: number) => void;
  onSwitchPersona: (email: string) => void;
  onOpenTeamModal: () => void;
  onOpenTour: () => void;
  onOpenOrbit: () => void;
  onOpenPrivacy: () => void;
  onOpenReset: () => void;
  onOpenAuth: () => void;
  onLogout: () => void;
}

const TOP_ITEMS: { id: TopSection; label: string }[] = [
  { id: "product", label: "Product" },
  { id: "demo", label: "Demo" },
  { id: "contact", label: "Contact" },
];

export const Navbar: React.FC<NavbarProps> = memo(({
  user,
  ready,
  brandName,
  companyName,
  activeScreen,
  activeRoleLabel,
  theme,
  companies,
  activeCompanyId,
  privacy,
  systemMode,
  switching,
  onSelectSection,
  onNavigateWorkspace,
  onPrimaryCta,
  onToggleTheme,
  onSwitchWorkspace,
  onSwitchPersona,
  onOpenTeamModal,
  onOpenTour,
  onOpenOrbit,
  onOpenPrivacy,
  onOpenReset,
  onOpenAuth,
  onLogout,
}) => {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [scrollSection, setScrollSection] = useState<TopSection>("product");

  const rootRef = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const menuBtnRef = useRef<HTMLButtonElement | null>(null);
  const shouldRestoreFocusRef = useRef(true);
  const closeTimerRef = useRef<number | null>(null);

  const openMenu = useCallback(() => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    shouldRestoreFocusRef.current = true;
    setOpen(true);
    setMounted(true);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        setVisible(true);
      });
    });
  }, []);

  const closeMenu = useCallback((opts?: { restoreFocus?: boolean }) => {
    shouldRestoreFocusRef.current = opts?.restoreFocus !== false;
    setOpen(false);
    setVisible(false);
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(() => {
      setMounted(false);
      closeTimerRef.current = null;
      if (shouldRestoreFocusRef.current) {
        menuBtnRef.current?.focus();
      }
    }, 205);
  }, []);

  const toggleMenu = useCallback(() => {
    if (open) closeMenu({ restoreFocus: true });
    else openMenu();
  }, [open, openMenu, closeMenu]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    };
  }, []);

  // Scroll listener for subtle blur/elevated background & bottom contact highlight
  useEffect(() => {
    const updateScrollState = () => {
      const y = window.scrollY;
      setScrolled(y > 14);

      if (activeScreen !== "intro") return;
      const docHeight = document.documentElement.scrollHeight;
      if (y + window.innerHeight >= docHeight - 120) {
        setScrollSection("contact");
        return;
      }

      const demoEl =
        document.getElementById("ad-image-scanner") ||
        document.getElementById("try") ||
        document.getElementById("numbers");
      if (demoEl) {
        const rect = demoEl.getBoundingClientRect();
        if (rect.top <= window.innerHeight * 0.45 && rect.bottom > 100) {
          setScrollSection("demo");
          return;
        }
      }
      setScrollSection("product");
    };

    updateScrollState();
    window.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState, { passive: true });
    return () => {
      window.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [activeScreen, ready]);

  const activeSection: TopSection = useMemo(() => {
    if (activeScreen === "review" || activeScreen === "queue") return "demo";
    if (activeScreen === "library" || activeScreen === "vault" || activeScreen === "insights") {
      return "product";
    }
    return scrollSection;
  }, [activeScreen, scrollSection]);

  // Outside click & Escape handler + focus trap inside mega-menu panel
  useEffect(() => {
    if (!open) return;

    const getFocusables = () => {
      if (!panelRef.current) return [] as HTMLElement[];
      return Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter(el => el.offsetParent !== null);
    };

    const rafId = window.requestAnimationFrame(() => {
      const focusables = getFocusables();
      const firstNavItem = panelRef.current?.querySelector<HTMLElement>(".bl-mega-item");
      (firstNavItem || focusables[0])?.focus();
    });

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) {
        return;
      }
      closeMenu({ restoreFocus: true });
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeMenu({ restoreFocus: true });
        return;
      }

      const focusables = getFocusables();
      if (!focusables.length) return;

      if (e.key === "Tab") {
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement as HTMLElement | null;

        if (!panelRef.current?.contains(active)) {
          e.preventDefault();
          (e.shiftKey ? last : first).focus();
          return;
        }
        if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
        return;
      }

      if (["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft", "Home", "End"].includes(e.key)) {
        const navItems = Array.from(
          panelRef.current?.querySelectorAll<HTMLElement>(
            ".bl-mega-item, .bl-mega-mobile-pill, .bl-mega-chip-btn, .bl-mega-close"
          ) || []
        ).filter(el => el.offsetParent !== null);

        if (!navItems.length) return;
        const currentIdx = navItems.indexOf(document.activeElement as HTMLElement);
        if (currentIdx === -1 && e.key !== "Home" && e.key !== "End") return;

        e.preventDefault();
        if (e.key === "Home") {
          navItems[0].focus();
        } else if (e.key === "End") {
          navItems[navItems.length - 1].focus();
        } else if (e.key === "ArrowDown" || e.key === "ArrowRight") {
          navItems[(currentIdx + 1) % navItems.length].focus();
        } else {
          navItems[(currentIdx - 1 + navItems.length) % navItems.length].focus();
        }
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, closeMenu]);

  const handleSelectAction = useCallback(
    (action: () => void, restoreFocus = false) => {
      closeMenu({ restoreFocus });
      action();
    },
    [closeMenu]
  );

  const groups: MegaMenuGroup[] = useMemo(
    () => [
      {
        heading: "Workflow",
        items: [
          {
            id: "keynote",
            label: "Keynote",
            description: "Live workspace keynote, hero scanner & claim workflow.",
            icon: "spark",
            active: ready && activeScreen === "intro",
            onSelect: () => handleSelectAction(() => onNavigateWorkspace("intro", "hero-scanner-preview")),
          },
          {
            id: "draft-review",
            label: "Draft Review",
            description: "Lint ads and copy against rules & cite proof before publish.",
            icon: "file",
            active: ready && activeScreen === "review",
            onSelect: () => handleSelectAction(() => onNavigateWorkspace("review")),
          },
          {
            id: "review-queue",
            label: "Review Queue",
            description: "Four-eyes independent review & senior sign-off routing.",
            icon: "review",
            active: ready && activeScreen === "queue",
            onSelect: () => handleSelectAction(() => onNavigateWorkspace("queue")),
          },
          {
            id: "ad-scanner",
            label: "Ad Image Scanner",
            description: "Inspect contrast, safe zones & label copy across ad formats.",
            icon: "search",
            onSelect: () => handleSelectAction(() => onNavigateWorkspace("intro", "ad-image-scanner")),
          },
        ],
      },
      {
        heading: "Governance",
        items: [
          {
            id: "evidence-vault",
            label: "Evidence Vault & Recall",
            description: "Approved claims, citation passports & active recall alerts.",
            icon: "radar",
            active: ready && activeScreen === "vault",
            onSelect: () => handleSelectAction(() => onNavigateWorkspace("vault")),
          },
          {
            id: "brand-library",
            label: "Brand Library",
            description: "Deterministic rules, banned phrasing & required caveats.",
            icon: "book",
            active: ready && activeScreen === "library",
            onSelect: () => handleSelectAction(() => onNavigateWorkspace("library")),
          },
          {
            id: "guideline-health",
            label: "Guideline Health",
            description: "33-case evaluation benchmark & reviewer disagreement signals.",
            icon: "chart",
            active: ready && activeScreen === "insights",
            onSelect: () => handleSelectAction(() => onNavigateWorkspace("insights")),
          },
          {
            id: "audit-trail",
            label: "Audit Trail",
            description: "Immutable check receipts, reviewer notes & history log.",
            icon: "shield",
            onSelect: () => handleSelectAction(() => onNavigateWorkspace("queue", "audit-trail-section")),
          },
        ],
      },
      {
        heading: "Resources",
        items: [
          {
            id: "architecture-map",
            label: "Architecture Map",
            description: "Interactive 6-screen governance topology & data flow.",
            icon: "settings",
            onSelect: () => handleSelectAction(onOpenOrbit),
          },
          {
            id: "interactive-tour",
            label: "Walkthrough Guide",
            description: "Step-by-step flow: Scan, Evidence, Approval & Publish.",
            icon: "spark",
            onSelect: () => handleSelectAction(onOpenTour),
          },
          {
            id: "team-access",
            label: "Team & Access",
            description: "Workspace roles, invitations & member governance permissions.",
            icon: "users",
            onSelect: () =>
              handleSelectAction(() => {
                if (ready) onOpenTeamModal();
                else onSelectSection("demo");
              }),
          },
          {
            id: "privacy-status",
            label: "Privacy & AI Processing",
            description: privacy?.hosted
              ? `Live AI via ${privacy.provider} · Inspect privacy boundaries.`
              : "Offline deterministic verifier · Zero external claim upload.",
            icon: "lock",
            onSelect: () => handleSelectAction(onOpenPrivacy),
          },
        ],
      },
    ],
    [ready, activeScreen, privacy, handleSelectAction, onNavigateWorkspace, onOpenOrbit, onOpenTour, onOpenTeamModal, onSelectSection, onOpenPrivacy]
  );

  return (
    <header
      ref={rootRef}
      className={`bl-navbar-header ${scrolled ? "is-scrolled" : ""}`}
    >
      <div id="brandlint-header-nav" className="bl-navbar-bar">
        {/* Left: Logo */}
        <button
          type="button"
          onClick={() => onSelectSection("product")}
          className="bl-nav-logo"
          aria-label="BrandLint home"
        >
          <BrandLintLogo />
          <span className="bl-nav-wordmark">
            Brand<span className="bl-nav-wordmark-accent">Lint</span>
          </span>
        </button>

        {/* Center: Max 3 section links (Product, Demo, Contact) */}
        <nav aria-label="Primary navigation">
          <ul className="bl-nav-links">
            {TOP_ITEMS.map(item => {
              const isActive = activeSection === item.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onSelectSection(item.id)}
                    data-active={isActive ? "true" : "false"}
                    aria-current={isActive ? "location" : undefined}
                    className="bl-nav-link"
                  >
                    <span>{item.label}</span>
                    {isActive && <span className="bl-nav-link-dot" aria-hidden="true" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Right: Primary CTA + Menu trigger */}
        <div className="bl-nav-actions">
          <button
            type="button"
            onClick={onPrimaryCta}
            className="bl-nav-cta"
          >
            {user ? (
              <>
                <span>Check</span>
                <span className="hidden sm:inline">Content</span>
              </>
            ) : (
              <span>Try Demo</span>
            )}
            <span aria-hidden="true">→</span>
          </button>

          <button
            ref={menuBtnRef}
            type="button"
            onClick={toggleMenu}
            aria-haspopup="true"
            aria-expanded={open}
            aria-controls="bl-mega-menu"
            className="bl-nav-menu-btn"
          >
            <span>Menu</span>
            <Icon name="chevron" size={13} className="bl-nav-menu-chevron" />
          </button>
        </div>
      </div>

      {/* Backdrop + Grouped Mega-Menu (Desktop) / Full-Width Slide-Down Drawer (Mobile) */}
      {mounted && (
        <>
          <div
            aria-hidden="true"
            className={`bl-menu-backdrop ${visible ? "is-open" : ""}`}
            onClick={() => closeMenu({ restoreFocus: true })}
          />

          <div
            ref={panelRef}
            id="bl-mega-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Workspace and navigation menu"
            className={`bl-mega-panel ${visible ? "is-open" : ""}`}
          >
            <div className="bl-mega-top">
              <div className="flex items-center gap-2.5">
                <BrandLintLogo size={16} />
                <div className="text-left">
                  <div className="text-xs font-bold tracking-tight">
                    BrandLint · {ready ? brandName : companyName}
                  </div>
                  <div className="font-mono text-[10px] uppercase text-ash">
                    {user ? `${user.name} · ${activeRoleLabel}` : "Interactive Workspace Navigation"}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => closeMenu({ restoreFocus: true })}
                aria-label="Close menu"
                className="bl-mega-close"
              >
                <Icon name="close" size={14} />
                <span>Close</span>
              </button>
            </div>

            {/* Mobile top-section pills (Product, Demo, Contact) */}
            <div className="bl-mega-mobile-sections" role="group" aria-label="Page sections">
              {TOP_ITEMS.map(item => (
                <button
                  key={item.id}
                  type="button"
                  data-active={activeSection === item.id ? "true" : "false"}
                  onClick={() => handleSelectAction(() => onSelectSection(item.id))}
                  className="bl-mega-mobile-pill"
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* 3 Headings: Workflow, Governance, Resources */}
            <div className="bl-mega-groups">
              {groups.map(group => (
                <section key={group.heading} aria-labelledby={`mega-group-${group.heading}`}>
                  <h2 id={`mega-group-${group.heading}`} className="bl-mega-heading">
                    {group.heading}
                  </h2>
                  <ul className="bl-mega-list">
                    {group.items.map(item => (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={item.onSelect}
                          data-active={item.active ? "true" : "false"}
                          aria-current={item.active ? "page" : undefined}
                          className="bl-mega-item"
                        >
                          <span className="bl-mega-icon">
                            <Icon name={item.icon} size={17} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="bl-mega-item-title">
                              <span>{item.label}</span>
                              {item.active && (
                                <span className="rounded-full bg-teal/15 px-1.5 py-0.5 font-mono text-[9px] uppercase text-iris">
                                  Active
                                </span>
                              )}
                            </span>
                            <span className="bl-mega-item-desc">{item.description}</span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>

            {/* Utility Strip: Theme, Role Switcher, Workspace Selector & Auth */}
            <div className="bl-mega-footer">
              <div className="flex flex-wrap items-center gap-1.5">
                {user && systemMode?.allow_persona_switch !== false && (
                  <>
                    <span className="mr-1 font-mono text-[10px] uppercase text-ash">
                      Role:
                    </span>
                    {DEMO_USERS.map(persona => {
                      const isCurrent = persona.email === user.email;
                      return (
                        <button
                          key={persona.email}
                          type="button"
                          disabled={switching}
                          onClick={() => handleSelectAction(() => onSwitchPersona(persona.email))}
                          className={`bl-mega-chip-btn ${
                            isCurrent ? "border-teal/60 bg-teal/15 text-iris" : ""
                          }`}
                        >
                          {persona.role} · {persona.label.split(" ")[0]}
                        </button>
                      );
                    })}
                  </>
                )}

                {companies.length > 1 && (
                  <label className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase">
                    <span className="text-ash">Workspace:</span>
                    <select
                      value={activeCompanyId || ""}
                      onChange={e => handleSelectAction(() => onSwitchWorkspace(Number(e.target.value)))}
                      className="rounded-full border border-line bg-transparent px-2.5 py-1 text-[11px] font-semibold"
                    >
                      {companies.map(c => (
                        <option key={c.id} value={c.id} className="bg-carbon text-bone">
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={onToggleTheme}
                  className="bl-mega-chip-btn"
                  aria-label={`Switch to ${theme === "dark" ? "Light" : "Dark"} mode`}
                >
                  <Icon name={theme === "dark" ? "sun" : "moon"} size={13} />
                  <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
                </button>

                {user && systemMode?.allow_reset && (
                  <button
                    type="button"
                    onClick={() => handleSelectAction(onOpenReset)}
                    className="bl-mega-chip-btn"
                  >
                    Reset demo
                  </button>
                )}

                {user ? (
                  <button
                    type="button"
                    onClick={() => handleSelectAction(onLogout)}
                    className="bl-mega-chip-btn border-blocking/45 text-blocking"
                  >
                    Sign out
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSelectAction(onOpenAuth)}
                    className="bl-mega-chip-btn border-teal/50 bg-teal/15 text-iris"
                  >
                    Sign in →
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </header>
  );
});
