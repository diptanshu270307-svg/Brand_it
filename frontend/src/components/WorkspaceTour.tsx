import React, { useEffect, useMemo, useRef, useState } from "react";
import { SectionMockup, type SectionMockupVariant } from "./SectionMockup";
import { Icon } from "./ui";

export type TourScreen = "intro" | "review" | "vault" | "queue" | "insights" | "library";

interface WalkthroughStep {
  id: string;
  phase: string;
  heading: string;
  description: string;
  mockup: SectionMockupVariant;
  metrics: { label: string; value: string }[];
  actionLabel: string;
  screen: TourScreen;
}

const WALKTHROUGH_STEPS: WalkthroughStep[] = [
  {
    id: "scan",
    phase: "01 · Scan",
    heading: "Scan Copy & Creative",
    description: "Check every headline and image claim against your rules in one click.",
    mockup: "draft_review",
    metrics: [
      { label: "Coverage", value: "Copy + OCR" },
      { label: "Latency", value: "Live Audit" },
      { label: "Citations", value: "Page-Cited" },
    ],
    actionLabel: "Open Draft Review",
    screen: "review",
  },
  {
    id: "evidence",
    phase: "02 · Evidence",
    heading: "Bind Proof Passports",
    description: "Attach verified lab excerpts and monitor certificate expiry across live campaigns.",
    mockup: "evidence_vault",
    metrics: [
      { label: "Proof", value: "Vault Passports" },
      { label: "Monitor", value: "Expiry Watch" },
      { label: "Recalls", value: "Auto-Flagged" },
    ],
    actionLabel: "Open Evidence Vault",
    screen: "vault",
  },
  {
    id: "approval",
    phase: "03 · Approval",
    heading: "Four-Eyes Review Gate",
    description: "Enforce independent sign-off so writers can never approve their own drafts.",
    mockup: "review_queue",
    metrics: [
      { label: "Control", value: "SoD Enforced" },
      { label: "Escalation", value: "Senior Legal" },
      { label: "Trail", value: "Immutable Log" },
    ],
    actionLabel: "Open Review Queue",
    screen: "queue",
  },
  {
    id: "publish",
    phase: "04 · Publish",
    heading: "Calibrate & Ship Safely",
    description: "Simulate rulebook updates in Sandbox before publishing with full team visibility.",
    mockup: "guideline_health",
    metrics: [
      { label: "Sandbox", value: "vNext Diff" },
      { label: "Agreement", value: "96% Signal" },
      { label: "Output", value: "Audit Ready" },
    ],
    actionLabel: "Open Guideline Health",
    screen: "insights",
  },
  {
    id: "sections",
    phase: "05 · Modules",
    heading: "Explore All Workspace Sections",
    description: "Jump straight into Keynote, Draft Review, Evidence Vault, Queue, Health, or Library.",
    mockup: "brand_library",
    metrics: [
      { label: "Ingestion", value: "PDF Guard" },
      { label: "Activation", value: "Owner Sign-off" },
      { label: "Access", value: "Tenant Scoped" },
    ],
    actionLabel: "Open Brand Library",
    screen: "library",
  },
];

const SECTION_SHORTCUTS: { label: string; screen: TourScreen; icon: string }[] = [
  { label: "Keynote", screen: "intro", icon: "spark" },
  { label: "Draft Review", screen: "review", icon: "file" },
  { label: "Evidence Vault", screen: "vault", icon: "archive" },
  { label: "Review Queue", screen: "queue", icon: "shield" },
  { label: "Guideline Health", screen: "insights", icon: "chart" },
  { label: "Brand Library", screen: "library", icon: "book" },
];

export interface WorkspaceTourProps {
  open: boolean;
  onClose: () => void;
  currentStepIndex?: number;
  onStepChange?: (index: number) => void;
  user?: unknown;
  companyName?: string;
  brandName?: string;
  role?: string;
  privacy?: unknown;
  theme?: string;
  onToggleTheme?: () => void;
  onNavigate: (screen: TourScreen) => void;
  onOpenAuth?: (view: "login" | "register") => void;
  onOpenTeamModal?: () => void;
  onLogout?: () => void;
  onSwitchPersona?: (email: string) => void;
  onOpenPrivacy?: () => void;
  onOpenReset?: () => void;
  allowPersonaSwitch?: boolean;
  allowReset?: boolean;
}

/**
 * Centered, responsive step-by-step Walkthrough Guide (Scan -> Evidence -> Approval -> Publish -> Modules).
 * Fixed-height visual stage prevents layout jumps; keyboard arrow keys, Escape, and focus trap are built in.
 */
export const WorkspaceTour: React.FC<WorkspaceTourProps> = ({
  open,
  onClose,
  onNavigate,
  currentStepIndex = 0,
  onStepChange,
}) => {
  const [internalIndex, setInternalIndex] = useState(currentStepIndex);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setInternalIndex(Math.max(0, Math.min(WALKTHROUGH_STEPS.length - 1, currentStepIndex)));
  }, [currentStepIndex]);

  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = document.activeElement as HTMLElement | null;

    const timer = window.setTimeout(() => {
      const dialog = dialogRef.current;
      if (!dialog) return;
      const firstFocusable = dialog.querySelector<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      firstFocusable?.focus();
    }, 20);

    return () => {
      window.clearTimeout(timer);
      if (restoreFocusRef.current && document.body.contains(restoreFocusRef.current)) {
        restoreFocusRef.current.focus();
      }
    };
  }, [open]);

  const stepIndex = Math.max(0, Math.min(WALKTHROUGH_STEPS.length - 1, internalIndex));
  const step = useMemo(() => WALKTHROUGH_STEPS[stepIndex], [stepIndex]);

  const goToStep = (next: number) => {
    const clamped = Math.max(0, Math.min(WALKTHROUGH_STEPS.length - 1, next));
    setInternalIndex(clamped);
    onStepChange?.(clamped);
  };

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        if (stepIndex < WALKTHROUGH_STEPS.length - 1) goToStep(stepIndex + 1);
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (stepIndex > 0) goToStep(stepIndex - 1);
        return;
      }
      if (e.key === "Home") {
        e.preventDefault();
        goToStep(0);
        return;
      }
      if (e.key === "End") {
        e.preventDefault();
        goToStep(WALKTHROUGH_STEPS.length - 1);
        return;
      }

      if (e.key === "Tab" && dialogRef.current) {
        const focusables = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        ).filter(el => el.offsetParent !== null);

        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  if (!open) return null;

  const progressPct = ((stepIndex + 1) / WALKTHROUGH_STEPS.length) * 100;
  const isLast = stepIndex === WALKTHROUGH_STEPS.length - 1;

  return (
    <div
      className="fixed inset-0 z-[1250] flex items-center justify-center bg-[#0b1220]/75 p-4 backdrop-blur-sm sm:p-6"
      role="presentation"
      onMouseDown={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bl-walkthrough-title"
        aria-describedby="bl-walkthrough-desc"
        className="max-h-[calc(100dvh-2rem)] w-full max-w-[880px] overflow-y-auto rounded-2xl border border-line bg-panel text-bone shadow-lustro-card"
      >
        {/* Top Progress Header */}
        <div className="border-b border-line bg-raised px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-teal/30 bg-[#0a2540] font-mono text-xs font-bold text-[#14b8a6]">
                0{stepIndex + 1}
              </span>
              <div>
                <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-iris">
                  Walkthrough Guide · Step {stepIndex + 1} of {WALKTHROUGH_STEPS.length}
                </p>
                <p className="text-xs text-ash">{step.phase}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close walkthrough guide"
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-line bg-panel px-4 py-1.5 font-mono text-xs font-semibold text-bone transition-colors hover:border-iris hover:text-iris"
            >
              <span>Close</span>
              <span aria-hidden="true">✕</span>
            </button>
          </div>

          {/* Stepper Bar */}
          <div className="mt-4 space-y-2">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-line/60">
              <div
                className="h-full rounded-full bg-teal transition-all duration-300 ease-out"
                style={{ width: `${progressPct}%` }}
              />
            </div>

            <div className="grid grid-cols-5 gap-2">
              {WALKTHROUGH_STEPS.map((item, idx) => {
                const active = idx === stepIndex;
                const completed = idx < stepIndex;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-current={active ? "step" : undefined}
                    onClick={() => goToStep(idx)}
                    className={`truncate rounded-lg border px-2 py-1.5 text-center font-mono text-[11px] font-semibold transition-colors ${
                      active
                        ? "border-teal bg-teal/15 text-iris"
                        : completed
                          ? "border-line bg-panel text-bone hover:border-teal/50"
                          : "border-transparent bg-transparent text-ash hover:bg-panel/60 hover:text-bone"
                    }`}
                  >
                    {item.phase}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Fixed-Height Responsive Stage (zero layout jumps) */}
        <div className="p-4 sm:p-6 md:p-8">
          <div
            key={step.id}
            className="lv-enter grid min-h-[340px] items-center gap-6 md:min-h-[300px] md:grid-cols-[1fr_1.15fr] md:gap-8"
          >
            {/* Left Copy Column */}
            <div className="flex flex-col justify-between gap-6">
              <div className="space-y-3">
                <h2
                  id="bl-walkthrough-title"
                  className="font-display text-2xl font-bold tracking-tight text-bone sm:text-3xl"
                >
                  {step.heading}
                </h2>
                <p id="bl-walkthrough-desc" className="text-sm leading-relaxed text-ash sm:text-base">
                  {step.description}
                </p>
              </div>

              {/* 3 Compact Spec Cells */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {step.metrics.map(metric => (
                  <div
                    key={metric.label}
                    className="rounded-xl border border-line bg-raised/70 p-2.5 sm:p-3"
                  >
                    <p className="font-mono text-[10px] uppercase tracking-wider text-ash">
                      {metric.label}
                    </p>
                    <p className="mt-1 truncate font-sans text-xs font-bold text-bone">
                      {metric.value}
                    </p>
                  </div>
                ))}
              </div>

              {/* Direct Navigation Pills / Primary Module Link */}
              {step.id === "sections" ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {SECTION_SHORTCUTS.map(sec => (
                    <button
                      key={sec.screen}
                      type="button"
                      onClick={() => {
                        onNavigate(sec.screen);
                        onClose();
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-raised px-3 py-2 text-left font-sans text-xs font-semibold text-bone transition-colors hover:border-teal hover:text-iris"
                    >
                      <Icon name={sec.icon} size={13} />
                      <span className="truncate">{sec.label}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      onNavigate(step.screen);
                      onClose();
                    }}
                    className="inline-flex items-center gap-2 rounded-full border border-teal/40 bg-teal/10 px-4 py-2 font-sans text-xs font-bold text-iris transition-colors hover:bg-teal/20"
                  >
                    <span>{step.actionLabel}</span>
                    <span aria-hidden="true">→</span>
                  </button>
                </div>
              )}
            </div>

            {/* Right Equal-Sized Mockup Visual Column */}
            <div className="w-full">
              <SectionMockup variant={step.mockup} />
            </div>
          </div>
        </div>

        {/* Footer Controls */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line bg-raised px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2 font-mono text-[11px] text-ash">
            <span className="hidden sm:inline">Use ← / → keys to navigate steps</span>
            <span className="sm:hidden">Step {stepIndex + 1} / {WALKTHROUGH_STEPS.length}</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => goToStep(stepIndex - 1)}
              disabled={stepIndex === 0}
              className="min-h-[40px] rounded-full border border-line bg-panel px-4 py-2 font-sans text-xs font-semibold text-bone transition-colors hover:border-bone/40 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ← Back
            </button>

            <button
              type="button"
              onClick={() => {
                if (isLast) {
                  onClose();
                } else {
                  goToStep(stepIndex + 1);
                }
              }}
              className="min-h-[40px] rounded-full bg-iris px-5 py-2 font-sans text-xs font-bold text-carbon transition-colors hover:opacity-90"
            >
              {isLast ? "Finish Walkthrough" : "Next →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
