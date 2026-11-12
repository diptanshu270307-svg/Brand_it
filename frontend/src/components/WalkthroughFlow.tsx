import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { SectionMockup, type SectionMockupVariant } from "./SectionMockup";

export type TourScreen = "intro" | "review" | "vault" | "queue" | "insights" | "library";

export interface WalkthroughStep {
  id: string;
  num: string;
  label: string;
  heading: string;
  description: string;
  mockup: SectionMockupVariant;
  actionLabel: string;
  screen: TourScreen;
}

export const WALKTHROUGH_STEPS: readonly WalkthroughStep[] = [
  {
    id: "scan",
    num: "01",
    label: "Scan",
    heading: "Scan Copy & Creative",
    description: "Check draft copy and visual claims against your brand rules in seconds.",
    mockup: "draft_review",
    actionLabel: "Open Draft Review",
    screen: "review",
  },
  {
    id: "evidence",
    num: "02",
    label: "Evidence",
    heading: "Attach Verified Evidence",
    description: "Bind approved lab excerpts to claims and catch expiring proof automatically.",
    mockup: "evidence_vault",
    actionLabel: "Open Evidence Vault",
    screen: "vault",
  },
  {
    id: "approval",
    num: "03",
    label: "Approval",
    heading: "Enforce Four-Eyes Approval",
    description: "Route flagged claims to independent reviewers so authors never approve own work.",
    mockup: "review_queue",
    actionLabel: "Open Review Queue",
    screen: "queue",
  },
  {
    id: "publish",
    num: "04",
    label: "Publish",
    heading: "Calibrate Rules & Publish",
    description: "Simulate rulebook updates in Sandbox before publishing verified campaigns live.",
    mockup: "guideline_health",
    actionLabel: "Open Guideline Health",
    screen: "insights",
  },
] as const;

export interface WalkthroughFlowProps {
  /** Render as a centered page section ("inline") or inside the modal dialog ("modal"). */
  mode?: "inline" | "modal";
  /** Controlled active step index (0..3). */
  stepIndex?: number;
  /** Initial step index when uncontrolled. */
  defaultStepIndex?: number;
  /** Called whenever the active step changes. */
  onStepChange?: (index: number) => void;
  /** Optional deep-link navigation to the step's workspace screen. */
  onNavigateScreen?: (screen: TourScreen) => void;
  /** Optional close callback used when running inside a modal. */
  onClose?: () => void;
  /** Attach document-level arrow/Escape listeners (used when modal is open). */
  captureGlobalKeys?: boolean;
  /** Optional deterministic heading id for modal aria-labelledby wiring. */
  titleId?: string;
  /** Optional deterministic description id for modal aria-describedby wiring. */
  descId?: string;
  /** Optional container classes. */
  className?: string;
}

/**
 * Reusable 4-step Walkthrough Guide (Scan -> Evidence -> Approval -> Publish).
 *
 * Uses a CSS Grid overlay stage (`grid-cols-1 grid-rows-1`) so every step locks
 * to the exact same rendered box height with zero vertical jumps on mobile, tablet, or desktop.
 */
export const WalkthroughFlow: React.FC<WalkthroughFlowProps> = ({
  mode = "inline",
  stepIndex: controlledStepIndex,
  defaultStepIndex = 0,
  onStepChange,
  onNavigateScreen,
  onClose,
  captureGlobalKeys = false,
  titleId,
  descId,
  className = "",
}) => {
  const autoId = useId();
  const baseId = `bl-walkthrough-${autoId.replace(/:/g, "")}`;
  const clamp = (n: number) => Math.max(0, Math.min(WALKTHROUGH_STEPS.length - 1, n));

  const isControlled = typeof controlledStepIndex === "number";
  const [internalIndex, setInternalIndex] = useState(() => clamp(defaultStepIndex));
  const stepIndex = isControlled ? clamp(controlledStepIndex) : internalIndex;

  const prevIndexRef = useRef<number>(stepIndex);
  const [direction, setDirection] = useState<"none" | "next" | "prev">("none");
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const tablistRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (prevIndexRef.current !== stepIndex) {
      setDirection(stepIndex > prevIndexRef.current ? "next" : "prev");
      prevIndexRef.current = stepIndex;
    }
  }, [stepIndex]);

  const goToStep = useCallback(
    (next: number, focusTab = false) => {
      const clamped = clamp(next);
      if (clamped === stepIndex) return;
      setDirection(clamped > stepIndex ? "next" : "prev");
      prevIndexRef.current = clamped;
      if (!isControlled) {
        setInternalIndex(clamped);
      }
      onStepChange?.(clamped);
      if (focusTab) {
        window.requestAnimationFrame(() => {
          tabRefs.current[clamped]?.focus();
        });
      }
    },
    [isControlled, onStepChange, stepIndex],
  );

  const handleKeyNavigation = useCallback(
    (key: string, fromTabList: boolean): boolean => {
      if (key === "ArrowRight") {
        if (stepIndex < WALKTHROUGH_STEPS.length - 1) {
          goToStep(stepIndex + 1, fromTabList);
        }
        return true;
      }
      if (key === "ArrowLeft") {
        if (stepIndex > 0) {
          goToStep(stepIndex - 1, fromTabList);
        }
        return true;
      }
      if (key === "Home") {
        goToStep(0, fromTabList);
        return true;
      }
      if (key === "End") {
        goToStep(WALKTHROUGH_STEPS.length - 1, fromTabList);
        return true;
      }
      return false;
    },
    [goToStep, stepIndex],
  );

  useEffect(() => {
    if (!captureGlobalKeys) return;
    const onWindowKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const insideTablist = Boolean(
        tablistRef.current && document.activeElement && tablistRef.current.contains(document.activeElement),
      );
      if (handleKeyNavigation(e.key, insideTablist)) {
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onWindowKeyDown);
    return () => window.removeEventListener("keydown", onWindowKeyDown);
  }, [captureGlobalKeys, handleKeyNavigation]);

  const onContainerKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (captureGlobalKeys || e.metaKey || e.ctrlKey || e.altKey) return;
    const target = e.target as HTMLElement | null;
    if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
    const insideTablist = Boolean(tablistRef.current && target && tablistRef.current.contains(target));
    if (handleKeyNavigation(e.key, insideTablist)) {
      e.preventDefault();
    }
  };

  const currentStep = useMemo(() => WALKTHROUGH_STEPS[stepIndex], [stepIndex]);
  const progressPct = ((stepIndex + 1) / WALKTHROUGH_STEPS.length) * 100;
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === WALKTHROUGH_STEPS.length - 1;
  const enterAnimClass =
    direction === "next" ? "bl-step-enter-next" : direction === "prev" ? "bl-step-enter-prev" : "";

  const HeadingTag = mode === "modal" ? "h2" : "h3";

  return (
    <div
      data-walkthrough-flow=""
      data-step-index={stepIndex}
      data-step-id={currentStep.id}
      onKeyDown={onContainerKeyDown}
      className={`overflow-hidden rounded-2xl border border-line bg-panel text-bone shadow-lustro-card ${className}`}
    >
      {/* Top Progress Header */}
      <div className="border-b border-line bg-raised px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-teal/40 bg-[#0A2540] font-mono text-xs font-bold text-[#14B8A6]">
              {currentStep.num}
            </span>
            <div>
              <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-iris">
                Walkthrough Guide · Step {stepIndex + 1} of {WALKTHROUGH_STEPS.length}
              </p>
              <p className="text-xs text-ash">Scan → Evidence → Approval → Publish</p>
            </div>
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close walkthrough guide"
              className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-full border border-line bg-panel px-4 py-1.5 font-mono text-xs font-semibold text-bone transition-colors hover:border-iris hover:text-iris"
            >
              <span>Close</span>
              <span aria-hidden="true">✕</span>
            </button>
          )}
        </div>

        {/* Continuous Progress Bar + 4 Equal-Size Step Cards */}
        <div className="mt-4 space-y-3">
          <div
            role="progressbar"
            aria-label="Walkthrough progress"
            aria-valuemin={1}
            aria-valuemax={WALKTHROUGH_STEPS.length}
            aria-valuenow={stepIndex + 1}
            className="h-1.5 w-full overflow-hidden rounded-full bg-line/70"
          >
            <div
              className="h-full rounded-full bg-teal transition-[width] duration-300 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          <div
            ref={tablistRef}
            role="tablist"
            aria-label="Walkthrough steps"
            className="grid grid-cols-2 items-stretch gap-2 sm:grid-cols-4 sm:gap-3"
          >
            {WALKTHROUGH_STEPS.map((item, idx) => {
              const isCurrent = idx === stepIndex;
              const isCompleted = idx < stepIndex;
              return (
                <button
                  key={item.id}
                  ref={el => {
                    tabRefs.current[idx] = el;
                  }}
                  id={`${baseId}-tab-${item.id}`}
                  type="button"
                  role="tab"
                  aria-selected={isCurrent}
                  aria-controls={`${baseId}-panel-${item.id}`}
                  tabIndex={isCurrent ? 0 : -1}
                  onClick={() => goToStep(idx)}
                  className={`flex h-full min-h-[44px] cursor-pointer items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left font-mono text-xs font-semibold transition-colors ${
                    isCurrent
                      ? "border-teal bg-teal/15 text-iris"
                      : isCompleted
                        ? "border-line bg-panel text-bone hover:border-teal/50"
                        : "border-line/70 bg-panel/60 text-ash hover:border-line hover:text-bone"
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="shrink-0 opacity-80">{item.num}</span>
                    <span className="truncate">{item.label}</span>
                  </span>
                  <span
                    aria-hidden="true"
                    className={`h-2 w-2 shrink-0 rounded-full transition-colors ${
                      isCurrent ? "bg-teal" : isCompleted ? "bg-teal/55" : "bg-line"
                    }`}
                  />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Zero-Jump CSS Grid Stage: all 4 steps occupy row 1 so stage height is identical across steps */}
      <div className="p-4 sm:p-6 md:p-8" data-walkthrough-stage="">
        <div className="grid grid-cols-1 grid-rows-1">
          {WALKTHROUGH_STEPS.map((step, idx) => {
            const isCurrent = idx === stepIndex;
            const resolvedTitleId = isCurrent ? titleId || `${baseId}-title` : undefined;
            const resolvedDescId = isCurrent ? descId || `${baseId}-desc` : undefined;

            return (
              <div
                key={step.id}
                role={isCurrent ? "tabpanel" : undefined}
                id={isCurrent ? `${baseId}-panel-${step.id}` : undefined}
                aria-labelledby={isCurrent ? `${baseId}-tab-${step.id}` : undefined}
                aria-hidden={!isCurrent || undefined}
                className={
                  isCurrent
                    ? `col-start-1 row-start-1 grid items-center gap-6 md:grid-cols-[1fr_1.15fr] md:gap-8 ${enterAnimClass}`
                    : "invisible pointer-events-none col-start-1 row-start-1 grid select-none items-center gap-6 md:grid-cols-[1fr_1.15fr] md:gap-8"
                }
              >
                {/* Left Column: strictly 1 short heading + 1 line of text + uniform optional screen link */}
                <div className="flex flex-col justify-center space-y-4">
                  <span className="inline-flex w-fit items-center gap-2 rounded-full border border-teal/30 bg-teal/10 px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-wider text-iris">
                    Step {step.num} · {step.label}
                  </span>

                  <HeadingTag
                    id={resolvedTitleId}
                    className="font-display text-2xl font-bold tracking-tight text-bone sm:text-3xl"
                  >
                    {step.heading}
                  </HeadingTag>

                  <p
                    id={resolvedDescId}
                    className="max-w-md text-sm leading-relaxed text-ash sm:text-base"
                  >
                    {step.description}
                  </p>

                  {onNavigateScreen && (
                    <div className="pt-2">
                      <button
                        type="button"
                        tabIndex={isCurrent ? 0 : -1}
                        onClick={() => {
                          onNavigateScreen(step.screen);
                          onClose?.();
                        }}
                        className="inline-flex min-h-[40px] cursor-pointer items-center gap-2 rounded-full border border-teal/40 bg-teal/10 px-4 py-2 font-sans text-xs font-bold text-iris transition-colors hover:bg-teal/20"
                      >
                        <span>{step.actionLabel}</span>
                        <span aria-hidden="true">→</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Right Column: consistent-style product mockup */}
                <div className="w-full min-w-0">
                  <SectionMockup variant={step.mockup} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer Navigation Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line bg-raised px-4 py-4 sm:px-6">
        <p className="font-mono text-[11px] text-ash">
          <span className="hidden sm:inline">Use ← / → arrow keys to switch steps · </span>
          <span>
            Step {stepIndex + 1} / {WALKTHROUGH_STEPS.length}
          </span>
        </p>

        <div className="flex items-center gap-3">
          <button
            type="button"
            data-walkthrough-back=""
            onClick={() => goToStep(stepIndex - 1)}
            disabled={isFirst}
            className="min-h-[40px] cursor-pointer rounded-full border border-line bg-panel px-4 py-2 font-sans text-xs font-semibold text-bone transition-colors hover:border-teal/50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ← Back
          </button>

          {onClose ? (
            <button
              type="button"
              data-walkthrough-next=""
              onClick={() => {
                if (isLast) {
                  onClose();
                } else {
                  goToStep(stepIndex + 1);
                }
              }}
              className="min-h-[40px] cursor-pointer rounded-full bg-iris px-5 py-2 font-sans text-xs font-bold text-carbon transition-opacity hover:opacity-90"
            >
              {isLast ? "Done" : "Next →"}
            </button>
          ) : (
            <button
              type="button"
              data-walkthrough-next=""
              onClick={() => goToStep(stepIndex + 1)}
              disabled={isLast}
              className="min-h-[40px] cursor-pointer rounded-full bg-iris px-5 py-2 font-sans text-xs font-bold text-carbon transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next →
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
