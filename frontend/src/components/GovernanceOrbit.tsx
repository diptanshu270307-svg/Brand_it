import React, { useEffect, useRef, useState } from "react";
import { Badge, Button, Icon } from "./ui";

export type OrbitScreen = "intro" | "review" | "vault" | "queue" | "insights" | "library";

interface StageItem {
  name: string;
  stat: string;
  note: string;
  detail: string;
  hue: number;
  glyph: string;
}

interface ModuleSpec {
  id: OrbitScreen;
  label: string;
  kicker: string;
  headline: string;
  ctaLabel: string;
  target: Exclude<OrbitScreen, "intro">;
  items: StageItem[];
}

const GLYPHS: Record<string, React.ReactNode> = {
  scan: (
    <>
      <path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2" />
      <path d="M7 12h10" />
    </>
  ),
  passport: (
    <>
      <path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  diff: (
    <>
      <path d="M12 4v16" />
      <path d="M4 8h5M15 8h5M4 13h5M15 16h5" />
    </>
  ),
  gate: (
    <>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  ledger: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M9 8h6M9 12h6M9 16h4" />
    </>
  ),
  spark: (
    <>
      <path d="m12 3 2.4 5.6L20 11l-5.6 2.4L12 19l-2.4-5.6L4 11l5.6-2.4L12 3Z" />
    </>
  ),
  quote: (
    <>
      <path d="M6 15h4l1-5V6H6v5h3l-1 4Zm8 0h4l1-5V6h-5v5h3l-1 4Z" />
    </>
  ),
  radar: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4.5" />
      <path d="m12 12 6.3-6.3" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  branch: (
    <>
      <circle cx="6" cy="6" r="2" />
      <circle cx="6" cy="18" r="2" />
      <circle cx="18" cy="9" r="2" />
      <path d="M6 8v8M18 11c0 4-6 3-12 5" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="9" r="3" />
      <path d="M3 19c0-3 2.8-5 6-5s6 2 6 5" />
      <circle cx="17" cy="8" r="2.2" />
      <path d="M17 14c2.2 0 4 1.5 4 4" />
    </>
  ),
  pulse: <path d="M3 12h4l2.2-6 4.4 12 2.2-6H21" />,
  file: (
    <>
      <path d="M7 3h7l4 4v14H7z" />
      <path d="M14 3v4h4M10 12h5M10 16h4" />
    </>
  ),
  shieldAlert: (
    <>
      <path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z" />
      <path d="M12 8v4M12 15h.01" />
    </>
  ),
  chart: <path d="M5 19V11M12 19V5M19 19v-8" />,
};

function OrbitGlyph({ name, size = 20 }: { name: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {GLYPHS[name] || GLYPHS.spark}
    </svg>
  );
}

const MODULES: ModuleSpec[] = [
  {
    id: "intro",
    label: "Overview",
    kicker: "END-TO-END GOVERNANCE ARCHITECTURE",
    headline: "Five checkpoints between a first draft and public sign-off.",
    ctaLabel: "Check content",
    target: "review",
    items: [
      {
        name: "Deterministic Rule Pass",
        stat: "Zero-latency scan",
        note: "Catches banned phrasing, product naming, and legal wording before any model call executes.",
        detail: "Active rules · exact character offsets",
        hue: 232,
        glyph: "scan",
      },
      {
        name: "Evidence Passports",
        stat: "Source + page",
        note: "The approved source behind this claim. Connects promotional claims to a versioned source document, page number, owner, and expiry date.",
        detail: "Approved facts · verbatim proof",
        hue: 168,
        glyph: "passport",
      },
      {
        name: "Protected Fact Guardrails",
        stat: "Explicit confirm",
        note: "Flags rewrites that alter numbers, legal phrases, or calls to action so intent never shifts silently.",
        detail: "Revision diff · author confirmation",
        hue: 34,
        glyph: "diff",
      },
      {
        name: "Role-Gated Sign-Off",
        stat: "Server enforced",
        note: "Routes sensitive drafts to senior reviewers and blocks self-approval or unresolved blockers on the backend.",
        detail: "Independent reviewer · fresh recheck",
        hue: 268,
        glyph: "gate",
      },
      {
        name: "Append-Only Audit Trail",
        stat: "Immutable log",
        note: "Preserves every revision, override reason, review comment, and sign-off timestamp in sequence.",
        detail: "Full traceability · human accountable",
        hue: 326,
        glyph: "ledger",
      },
    ],
  },
  {
    id: "review",
    label: "Check content",
    kicker: "01 / CHECK CONTENT DESK",
    headline: "Inspect inline findings, source pages, and protected edits in one desk.",
    ctaLabel: "Check content",
    target: "review",
    items: [
      {
        name: "Unfamiliar Claim Tester",
        stat: "Live input",
        note: "Create a standalone draft from any fresh claim sentence and run the active checker immediately.",
        detail: "Hosted AI or offline verifier",
        hue: 258,
        glyph: "spark",
      },
      {
        name: "Inline Span Highlights",
        stat: "Exact spans",
        note: "Click any highlighted phrase in the draft canvas to focus its rule citation or evidence passport.",
        detail: "Claims · terminology · tone",
        hue: 194,
        glyph: "scan",
      },
      {
        name: "Side-by-Side Fix Preview",
        stat: "Verification pending",
        note: "Compares current vs. proposed wording and withholds updated coverage until applied and rechecked.",
        detail: "Creates a new numbered revision",
        hue: 328,
        glyph: "diff",
      },
      {
        name: "Citation Page Inspector",
        stat: "Pinned excerpt",
        note: "Opens the cited guideline or evidence document directly at the referenced page with highlighted text.",
        detail: "Source proof modal · keyboard accessible",
        hue: 222,
        glyph: "quote",
      },
      {
        name: "API Evidence Coverage",
        stat: "Measured ratio",
        note: "Reports supported claims with current passports divided by detected claims on the checked revision.",
        detail: "Discloses denominator & scope",
        hue: 160,
        glyph: "chart",
      },
    ],
  },
  {
    id: "vault",
    label: "Approved facts",
    kicker: "02 / APPROVED FACTS & SOURCES",
    headline: "Track what backs every claim—and what breaks when proof changes.",
    ctaLabel: "View approved facts",
    target: "vault",
    items: [
      {
        name: "Registered Claim Passports",
        stat: "Owner + window",
        note: "Stores each approved claim statement alongside its source version, page, owner, and validity dates.",
        detail: "Current · pending · revoked · expired",
        hue: 168,
        glyph: "passport",
      },
      {
        name: "Verbatim Excerpt Check",
        stat: "Server verified",
        note: "Confirms the supporting quote exists word-for-word on the selected source page when registering proof.",
        detail: "Blocks fabricated citations",
        hue: 224,
        glyph: "quote",
      },
      {
        name: "Claim Recall Radar",
        stat: "Dependency scan",
        note: "Scans visible approved drafts to flag packets whose linked passports were revoked or expired.",
        detail: "1-click reopen as draft author",
        hue: 342,
        glyph: "radar",
      },
      {
        name: "Validity Horizon Guard",
        stat: "Date enforced",
        note: "Prevents expired evidence windows from passing as current proof even if previously approved.",
        detail: "Shelf-life aware governance",
        hue: 32,
        glyph: "clock",
      },
      {
        name: "Brand Owner Approval",
        stat: "Controlled state",
        note: "New evidence starts pending until a Brand Owner approves—or revokes—the passport.",
        detail: "Role-gated evidence lifecycle",
        hue: 272,
        glyph: "gate",
      },
    ],
  },
  {
    id: "queue",
    label: "Approvals",
    kicker: "03 / HUMAN SIGN-OFF DESK",
    headline: "Risk-aware routing with independent human accountability.",
    ctaLabel: "View approvals",
    target: "queue",
    items: [
      {
        name: "Standard Review Packets",
        stat: "Reviewer tier",
        note: "Routine checked drafts enter the standard queue for an independent reviewer to inspect and sign off.",
        detail: "Requires a written decision note",
        hue: 216,
        glyph: "users",
      },
      {
        name: "Senior Risk Escalation",
        stat: "Senior tier",
        note: "Drafts with promotional claims or sensitive rules automatically require Senior Reviewer approval.",
        detail: "Computed & persisted route",
        hue: 28,
        glyph: "branch",
      },
      {
        name: "Self-Approval Prevention",
        stat: "Independent eye",
        note: "Blocks authors from approving their own revisions and offers a 1-click switch to an eligible reviewer.",
        detail: "Enforced in UI and backend API",
        hue: 334,
        glyph: "gate",
      },
      {
        name: "Gate Recheck on Sign-Off",
        stat: "Fresh analysis",
        note: "Re-verifies the submitted revision at approval time so stale checks or new blockers cannot slip by.",
        detail: "Returns structured gate blockers",
        hue: 266,
        glyph: "scan",
      },
      {
        name: "Comments & Event Trail",
        stat: "Audit record",
        note: "Pairs human review conversation with raw server audit events for complete compliance history.",
        detail: "Inspectable JSON event payloads",
        hue: 156,
        glyph: "ledger",
      },
    ],
  },
  {
    id: "insights",
    label: "Insights",
    kicker: "04 / GUIDELINE HEALTH",
    headline: "Rules your team finds unclear.",
    ctaLabel: "View insights",
    target: "insights",
    items: [
      {
        name: "Override Rate Telemetry",
        stat: "Live vs sample",
        note: "Rules your team finds unclear. Highlights rules frequently overridden by reviewers while keeping seeded history clearly separated.",
        detail: "Minimum sample thresholds",
        hue: 30,
        glyph: "pulse",
      },
      {
        name: "Reviewer Disagreement Trail",
        stat: "Real excerpts",
        note: "Groups override rationales alongside the exact draft quotes that triggered friction during review.",
        detail: "Evidence for rule refinement",
        hue: 326,
        glyph: "quote",
      },
      {
        name: "Wording Proposal Studio",
        stat: "Draft v + 1",
        note: "Drafts clearer rule wording and channel guidance notes side-by-side with the active version.",
        detail: "Never auto-modifies active rules",
        hue: 176,
        glyph: "diff",
      },
      {
        name: "Owner-Approved Versioning",
        stat: "Controlled publish",
        note: "Publishes reviewed wording as the next numbered rule version only when a Brand Owner approves.",
        detail: "Preserves rule key lineage",
        hue: 264,
        glyph: "ledger",
      },
      {
        name: "Measured Benchmark Suite",
        stat: "On-demand run",
        note: "Executes labelled evaluation cases against the configured provider to measure citations, recall, and latency.",
        detail: "Inspectable case-by-case output",
        hue: 152,
        glyph: "chart",
      },
    ],
  },
  {
    id: "library",
    label: "Brand rules",
    kicker: "05 / BRAND RULES & GUARDRAILS",
    headline: "Ingest guidelines as untrusted data, never executable instructions.",
    ctaLabel: "View brand rules",
    target: "library",
    items: [
      {
        name: "Versioned Source Ingestion",
        stat: "PDF & .txt",
        note: "Uploads multi-page guideline manuals or evidence documents with automatic version tracking.",
        detail: "Up to 10 MB per document",
        hue: 220,
        glyph: "file",
      },
      {
        name: "Prompt-Injection Quarantine",
        stat: "Untrusted data",
        note: "Detects hostile instruction-like text inside uploaded files and surfaces warnings before activation.",
        detail: "Includes built-in injection test sample",
        hue: 22,
        glyph: "shieldAlert",
      },
      {
        name: "Cited Rule Proposals",
        stat: "Inactive by default",
        note: "Extracts candidate rules with severity, banned terms, and pinned page excerpts for human review.",
        detail: "Zero automatic rule activation",
        hue: 274,
        glyph: "spark",
      },
      {
        name: "Brand Owner Activation",
        stat: "Human gate",
        note: "Only a Brand Owner can approve or reject proposed rules into the active checking engine.",
        detail: "Enforced by backend role checks",
        hue: 158,
        glyph: "gate",
      },
      {
        name: "Searchable Provenance",
        stat: "Source linked",
        note: "Filter rules by category, status, or keyword and open the exact source page behind each policy.",
        detail: "Rulebook + source archive",
        hue: 322,
        glyph: "quote",
      },
    ],
  },
];

interface GovernanceOrbitProps {
  mode?: "hero" | "full" | "compact";
  activeScreen?: OrbitScreen;
  onNavigate?: (screen: Exclude<OrbitScreen, "intro">) => void;
  onClose?: () => void;
}

export const GovernanceOrbit: React.FC<GovernanceOrbitProps> = ({
  mode = "full",
  activeScreen = "intro",
  onNavigate,
  onClose,
}) => {
  const [moduleId, setModuleId] = useState<OrbitScreen>(activeScreen);
  const [index, setIndex] = useState(0);
  const [autoPlay, setAutoPlay] = useState(mode !== "compact");
  const [hovered, setHovered] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setModuleId(activeScreen);
    setIndex(0);
  }, [activeScreen]);

  const currentModule = MODULES.find((m) => m.id === moduleId) || MODULES[0];
  const items = currentModule.items;
  const total = items.length;
  const activeItem = items[index] || items[0];

  const stepTo = (next: number) => {
    setIndex(((next % total) + total) % total);
  };

  useEffect(() => {
    if (!autoPlay || hovered) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    const id = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % total);
    }, 3800);
    return () => window.clearInterval(id);
  }, [autoPlay, hovered, total, moduleId]);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = stageRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width - 0.5).toFixed(3);
    const py = ((e.clientY - rect.top) / rect.height - 0.5).toFixed(3);
    el.style.setProperty("--orbit-px", px);
    el.style.setProperty("--orbit-py", py);
  };

  const handlePointerLeave = () => {
    setHovered(false);
    const el = stageRef.current;
    if (el) {
      el.style.setProperty("--orbit-px", "0");
      el.style.setProperty("--orbit-py", "0");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      stepTo(index + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      stepTo(index - 1);
    }
  };

  return (
    <section
      aria-label={`${currentModule.label} interactive architecture explorer`}
      className="lv-orbit-wrap"
      style={{ ["--orbit-hue" as string]: activeItem.hue }}
    >
      {/* Header & Module Switcher */}
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line/60 px-5 py-4 sm:px-6">
        <div className="min-w-0">
          <div className="lv-eyebrow mb-1.5 flex items-center gap-2">
            <span className="lv-orbit-live-dot" aria-hidden="true" />
            <span>{currentModule.kicker}</span>
          </div>
          <h2 className={`font-display font-medium tracking-tight ${mode === "hero" ? "text-lg sm:text-xl" : "text-xl sm:text-2xl"}`}>
            {currentModule.headline}
          </h2>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setAutoPlay((v) => !v)}
            aria-pressed={autoPlay}
            className="lv-orbit-ctrl-pill"
            title={autoPlay ? "Pause automatic cycling" : "Resume automatic cycling"}
          >
            <span>{autoPlay ? "❚❚ Auto" : "▶ Orbit"}</span>
          </button>
          <button
            type="button"
            onClick={() => stepTo(index - 1)}
            aria-label="Previous stage"
            className="lv-orbit-icon-btn"
          >
            ←
          </button>
          <span className="font-mono text-[11px] text-muted px-1">
            {String(index + 1).padStart(2, "0")}/{String(total).padStart(2, "0")}
          </span>
          <button
            type="button"
            onClick={() => stepTo(index + 1)}
            aria-label="Next stage"
            className="lv-orbit-icon-btn"
          >
            →
          </button>
          {onClose && (
            <Button variant="ghost" className="!min-h-8 !px-2.5" onClick={onClose} aria-label="Collapse visual guide">
              <Icon name="close" size={15} />
            </Button>
          )}
        </div>
      </div>

      {/* Module Selector Strip (Shown in Hero and Full Modes) */}
      {(mode === "full" || mode === "hero") && (
        <div
          role="tablist"
          aria-label="Workspace architecture modules"
          className="lv-studio-scroll flex items-center gap-1.5 overflow-x-auto border-b border-line/50 px-5 py-2.5 sm:px-6"
        >
          {MODULES.map((mod) => {
            const selected = mod.id === moduleId;
            return (
              <button
                key={mod.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => {
                  setModuleId(mod.id);
                  setIndex(0);
                }}
                className={`lv-orbit-tab ${selected ? "is-active" : ""}`}
              >
                {mod.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Interactive Orbital Stage */}
      <div
        ref={stageRef}
        tabIndex={0}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={handlePointerLeave}
        onFocusCapture={() => setHovered(true)}
        onBlurCapture={() => setHovered(false)}
        onPointerMove={handlePointerMove}
        onKeyDown={handleKeyDown}
        className={`lv-orbit-stage ${mode === "compact" ? "is-compact" : ""} ${mode === "hero" ? "is-hero" : ""}`}
      >
        {/* Dynamic Hue Aura + Perspective Grid Horizon */}
        <div className="lv-orbit-aura" aria-hidden="true" />
        <div className="lv-orbit-horizon" aria-hidden="true" />
        <div className="lv-orbit-arc" aria-hidden="true" />

        {/* Top Step Icon Dock */}
        <div className="lv-orbit-dock" role="group" aria-label="Select capability node">
          {items.map((item, idx) => (
            <button
              key={item.name}
              type="button"
              aria-label={`${idx + 1}. ${item.name}`}
              aria-current={idx === index ? "step" : undefined}
              onClick={() => stepTo(idx)}
              title={item.name}
              className={`lv-orbit-dock-btn ${idx === index ? "is-current" : ""}`}
            >
              <OrbitGlyph name={item.glyph} size={14} />
            </button>
          ))}
        </div>

        {/* Flanking Orbital Glass Satellites + Center Prism Lens */}
        <div className="lv-orbit-ring">
          {items.map((item, idx) => {
            let d = idx - index;
            if (d > total / 2) d -= total;
            if (d < -total / 2) d += total;
            const ad = Math.abs(d);
            const isCenter = d === 0;

            return (
              <button
                key={item.name}
                type="button"
                tabIndex={isCenter ? -1 : 0}
                aria-hidden={isCenter}
                onClick={() => stepTo(idx)}
                style={
                  {
                    ["--d" as string]: d,
                    ["--ad" as string]: ad,
                    ["--sat-hue" as string]: item.hue,
                  } as React.CSSProperties
                }
                className={`lv-orbit-satellite ${isCenter ? "is-center" : ""}`}
              >
                <span className="lv-orbit-sat-num">0{idx + 1}</span>
                <span className="lv-orbit-sat-icon">
                  <OrbitGlyph name={item.glyph} size={22} />
                </span>
                <span className="lv-orbit-sat-label">{item.name}</span>
                <span className="lv-orbit-sat-stat">{item.stat}</span>
              </button>
            );
          })}

          {/* Center Focal Prism Card */}
          <div key={`${moduleId}-${index}`} className="lv-prism-card">
            <div className="lv-prism-aurora" aria-hidden="true">
              <i />
              <i />
              <i />
            </div>

            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="flex w-full items-center justify-between gap-2 text-[10px] font-mono uppercase tracking-widest text-muted">
                <span>NODE 0{index + 1}</span>
                <Badge tone="accent" className="!py-0.5">
                  {activeItem.stat}
                </Badge>
              </div>

              <div className="lv-prism-emblem mt-4">
                <OrbitGlyph name={activeItem.glyph} size={26} />
              </div>

              <h3 className="mt-4 font-display text-xl font-semibold tracking-tight sm:text-[22px]">
                {activeItem.name}
              </h3>

              <p className="lv-muted mt-2.5 text-xs leading-6 sm:text-[13px]" aria-live="polite">
                {activeItem.note}
              </p>

              <div className="lv-prism-detail mt-4">
                <span className="lv-dot" aria-hidden="true" />
                <span>{activeItem.detail}</span>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => stepTo(index + 1)}
                  className="lv-prism-next-chip"
                >
                  <span>Next node</span>
                  <Icon name="arrow" size={13} />
                </button>
                {onNavigate && (
                  <Button
                    variant="primary"
                    className="!min-h-9 !px-4 !py-1.5 !text-xs"
                    onClick={() => onNavigate(currentModule.target)}
                  >
                    {currentModule.ctaLabel}
                    <Icon name="arrow" size={13} />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
