import React, { useEffect, useState, useRef, useCallback } from "react";
import { Icon } from "./ui";

export interface TourStep {
  id: string;
  targetSelector: string;
  title: string;
  tag: string;
  body: string;
  actionText?: string;
  onAction?: () => void;
  preferredPosition?: "top" | "bottom" | "left" | "right";
}

interface SpotlightTourProps {
  open: boolean;
  onClose: () => void;
  steps: TourStep[];
  currentStepIndex?: number;
  onStepChange?: (index: number) => void;
}

export const SpotlightTour: React.FC<SpotlightTourProps> = ({
  open,
  onClose,
  steps,
  currentStepIndex = 0,
  onStepChange,
}) => {
  const [stepIdx, setStepIdx] = useState(currentStepIndex);
  const [targetRect, setTargetRect] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);

  const [popoverPos, setPopoverPos] = useState<{
    top: number;
    left: number;
    placement: "top" | "bottom";
  }>({
    top: 100,
    left: 100,
    placement: "bottom",
  });

  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window !== "undefined") return window.innerWidth < 768;
    return false;
  });

  // Controls soft bloom & animation emergence once gliding settles
  const [isReady, setIsReady] = useState<boolean>(false);

  const rafRef = useRef<number | null>(null);
  const scrollRafRef = useRef<number | null>(null);

  useEffect(() => {
    setStepIdx(currentStepIndex);
  }, [currentStepIndex]);

  const activeStep = steps[stepIdx] || steps[0];

  // Responsive mobile detector (adapts dynamically to window resizing & device orientation changes)
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener("resize", handleResize, { passive: true });
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Measure target geometry with safe-area viewport clamping across all aspect ratios
  const measureTarget = useCallback(() => {
    if (!open || !activeStep) return;
    const el = document.querySelector(activeStep.targetSelector);
    if (!el) {
      setTargetRect(null);
      return;
    }

    const r = el.getBoundingClientRect();

    // Safe-area viewport clamped bounds: guarantees zero overflow on narrow iPhones & Androids
    const minLeft = 8;
    const maxRight = window.innerWidth - 8;
    const left = Math.max(minLeft, r.left);
    const right = Math.min(maxRight, r.right);
    const width = Math.max(30, right - left);

    const minTop = 8;
    const maxBottom = window.innerHeight - 8;
    const top = Math.max(minTop, r.top);
    const bottom = Math.min(maxBottom, r.bottom);
    const height = Math.max(24, bottom - top);

    setTargetRect({ top, left, width, height });

    // Desktop / Tablet Popover Calculation
    const popoverWidth = Math.min(440, window.innerWidth - 32);
    const popoverHeight = 220;

    let popTop = bottom + 18;
    let placement: "top" | "bottom" = "bottom";

    // If bottom placement overflows, smartly place above target
    if (popTop + popoverHeight > window.innerHeight - 16 && top > popoverHeight + 28) {
      popTop = Math.max(16, top - popoverHeight - 16);
      placement = "top";
    } else if (popTop + popoverHeight > window.innerHeight - 16) {
      popTop = Math.max(16, window.innerHeight - popoverHeight - 16);
    }

    let popLeft = left + width / 2 - popoverWidth / 2;
    popLeft = Math.max(16, Math.min(window.innerWidth - popoverWidth - 16, popLeft));

    setPopoverPos({ top: popTop, left: popLeft, placement });
  }, [open, activeStep]);

  // Programmatic SLOW AND STEADY gliding scroll with custom easeInOutCubic easing
  // "make it slow and steady with lots of animation around it"
  const smoothGlidingScroll = useCallback((targetY: number, duration = 880, onComplete?: () => void) => {
    if (typeof window === "undefined") {
      onComplete?.();
      return;
    }

    const startY = window.scrollY;
    const distance = targetY - startY;

    if (Math.abs(distance) < 8) {
      window.scrollTo(0, targetY);
      onComplete?.();
      return;
    }

    const startTime = performance.now();

    // Luxury easeInOutCubic: slow gentle launch, steady glide, soft cushioned arrival
    const easeInOutCubic = (t: number) => {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    };

    const step = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(1, elapsed / duration);
      const easedProgress = easeInOutCubic(progress);

      window.scrollTo(0, startY + distance * easedProgress);

      if (progress < 1) {
        scrollRafRef.current = requestAnimationFrame(step);
      } else {
        window.scrollTo(0, targetY);
        onComplete?.();
      }
    };

    if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);
    scrollRafRef.current = requestAnimationFrame(step);
  }, []);

  // Soft and steady step navigation handler
  useEffect(() => {
    if (!open || !activeStep) return;

    // Gently soften current spotlight during glide
    setIsReady(false);

    const initTimer = window.setTimeout(() => {
      const el = document.querySelector(activeStep.targetSelector);
      if (el) {
        const r = el.getBoundingClientRect();
        const mobile = window.innerWidth < 768;

        // Mobile (iPhone / Android): scroll target to upper third (y ~ 68px)
        // Desktop / Laptop: scroll target to comfortable upper-middle
        const targetOffset = mobile ? 68 : Math.max(90, window.innerHeight * 0.22);
        const desiredScrollTop = Math.max(0, window.scrollY + r.top - targetOffset);

        smoothGlidingScroll(desiredScrollTop, 880, () => {
          measureTarget();
          setIsReady(true);
        });
      } else {
        // Fallback retry in case element is rendering
        const retryTimer = window.setTimeout(() => {
          const retryEl = document.querySelector(activeStep.targetSelector);
          if (retryEl) {
            const r = retryEl.getBoundingClientRect();
            const mobile = window.innerWidth < 768;
            const targetOffset = mobile ? 68 : Math.max(90, window.innerHeight * 0.22);
            const desiredScrollTop = Math.max(0, window.scrollY + r.top - targetOffset);

            smoothGlidingScroll(desiredScrollTop, 880, () => {
              measureTarget();
              setIsReady(true);
            });
          }
        }, 120);
        return () => window.clearTimeout(retryTimer);
      }
    }, 40);

    return () => {
      window.clearTimeout(initTimer);
      if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);
    };
  }, [open, stepIdx, activeStep, smoothGlidingScroll, measureTarget]);

  // Passive tracking during user resize or manual scroll
  useEffect(() => {
    if (!open || !isReady) return;

    let ticking = false;
    const onScrollOrResize = () => {
      if (!ticking) {
        rafRef.current = requestAnimationFrame(() => {
          measureTarget();
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("resize", onScrollOrResize, { passive: true });
    window.addEventListener("scroll", onScrollOrResize, { passive: true });

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize);
    };
  }, [open, isReady, measureTarget]);

  // Keyboard navigation (Esc to exit, Arrow keys to navigate)
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowRight") {
        handleNext();
      } else if (e.key === "ArrowLeft") {
        handlePrev();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, stepIdx, steps.length]);

  if (!open || !activeStep) return null;

  const handleNext = () => {
    if (stepIdx < steps.length - 1) {
      const next = stepIdx + 1;
      setStepIdx(next);
      onStepChange?.(next);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (stepIdx > 0) {
      const prev = stepIdx - 1;
      setStepIdx(prev);
      onStepChange?.(prev);
    }
  };

  const pad = isMobile ? 6 : 10;
  const rx = isMobile ? 14 : 18;

  return (
    <div
      className="fixed inset-0 z-[1200] overflow-hidden pointer-events-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Workspace Guided Tour"
    >
      {/* 1. Dark Backdrop with Slow, Steady SVG Cutout Mask */}
      <svg
        className="absolute inset-0 h-full w-full pointer-events-none"
        aria-hidden="true"
      >
        <defs>
          <mask id="spotlight-mask">
            {/* White background: dark shaded canvas */}
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {/* Black rectangle: illuminated window over target element */}
            {targetRect && isReady && (
              <rect
                x={targetRect.left - pad}
                y={targetRect.top - pad}
                width={targetRect.width + pad * 2}
                height={targetRect.height + pad * 2}
                rx={rx}
                ry={rx}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(5, 5, 9, 0.84)"
          mask="url(#spotlight-mask)"
        />
      </svg>

      {/* 2. Slow & Steady Animated Spotlight Target Frame with LOTS OF ANIMATION around it */}
      {targetRect && (
        <div
          style={{
            top: targetRect.top - pad,
            left: targetRect.left - pad,
            width: targetRect.width + pad * 2,
            height: targetRect.height + pad * 2,
            borderRadius: rx + 2,
            opacity: isReady ? 1 : 0,
            transform: isReady ? "scale(1)" : "scale(0.97)",
          }}
          className="tour-target-ring rounded-2xl"
          aria-hidden="true"
        >
          {/* A. Rotating Ambient Orbit Glow Halo */}
          <div className="tour-orbit-halo" />

          {/* B. Concentric Triple Radar Ping Waves (continuous living ripples) */}
          <div className="tour-radar-ping ping-1" />
          <div className="tour-radar-ping ping-2" />
          <div className="tour-radar-ping ping-3" />

          {/* C. Luminous Dual-Sweep Laser Scanline Beam with Bright Spark */}
          <div className="tour-laser-beam">
            <span className="tour-laser-spark" />
          </div>

          {/* D. Precision Neon Corner Reticle Markers */}
          <span className="tour-corner-marker -top-1.5 -left-1.5 border-t-2 border-l-2 rounded-tl-sm" />
          <span className="tour-corner-marker -top-1.5 -right-1.5 border-t-2 border-r-2 rounded-tr-sm" />
          <span className="tour-corner-marker -bottom-1.5 -left-1.5 border-b-2 border-l-2 rounded-bl-sm" />
          <span className="tour-corner-marker -bottom-1.5 -right-1.5 border-b-2 border-r-2 rounded-br-sm" />

          {/* E. Floating HUD Live Focus Tag (Desktop & Tablet) */}
          {!isMobile && (
            <div className="tour-hud-badge">
              <span className="size-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="font-semibold">
                FOCUS · 0{stepIdx + 1}/0{steps.length} · {activeStep.tag}
              </span>
              <span className="text-[9px] text-sky-400/80 border-l border-white/20 pl-1.5 font-mono">
                STEADY · 60FPS
              </span>
            </div>
          )}
        </div>
      )}

      {/* 3. Floating Popover Card — Adapts to Every Window Aspect Ratio (Mobile, Tablet, Desktop) */}
      <div
        style={{
          top: isMobile ? undefined : popoverPos.top,
          left: isMobile ? undefined : popoverPos.left,
          maxWidth: isMobile ? "calc(100vw - 20px)" : 440,
          opacity: isReady ? 1 : 0,
          transform: isReady ? "scale(1) translateY(0)" : "scale(0.96) translateY(8px)",
          pointerEvents: isReady ? "auto" : "none",
        }}
        className={`tour-popover-card ${
          isMobile ? "mobile-docked" : "tour-popover-enter"
        } w-full overflow-hidden text-white`}
      >
        {/* Step Progress Gradient Bar at top of card */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-white/[0.08]">
          <div
            className="h-full bg-gradient-to-r from-sky-400 via-indigo-500 to-emerald-400 transition-all duration-700 ease-out"
            style={{ width: `${((stepIdx + 1) / steps.length) * 100}%` }}
          />
        </div>

        {/* Mobile Swipe / Grab Handle */}
        {isMobile && (
          <div className="mx-auto mt-1 mb-2 h-1 w-10 rounded-full bg-white/25" />
        )}

        {/* Pointer Arrow on Desktop & Tablets */}
        {!isMobile && (
          <div
            className={`pointer-events-none absolute left-1/2 -translate-x-1/2 size-3 rotate-45 border border-indigo-400/40 bg-[#0e101c] ${
              popoverPos.placement === "bottom"
                ? "-top-1.5 border-b-0 border-r-0"
                : "-bottom-1.5 border-t-0 border-l-0"
            }`}
          />
        )}

        {/* Card Header: Step Indicator & Close Button */}
        <div className="flex items-center justify-between border-b border-white/10 pb-2.5 pt-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/40 bg-sky-500/15 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-sky-300">
              <span className="size-1.5 rounded-full bg-sky-400 animate-pulse" />
              Step {stepIdx + 1} of {steps.length}
            </span>
            <span className="hidden sm:inline font-mono text-[10px] uppercase text-slate-400">
              {activeStep.tag}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-full p-1 text-slate-400 transition hover:bg-white/10 hover:text-white"
            aria-label="Close Tour"
            title="Close Tour (Esc)"
          >
            <Icon name="close" size={14} />
          </button>
        </div>

        {/* Card Content */}
        <div className="py-2.5 sm:py-3 space-y-1.5 sm:space-y-2">
          <h3 className="font-sans text-sm sm:text-base md:text-lg font-bold text-white tracking-tight">
            {activeStep.title}
          </h3>
          <p className="text-xs leading-relaxed text-slate-300 sm:text-[13px]">
            {activeStep.body}
          </p>
          {activeStep.actionText && activeStep.onAction && (
            <button
              type="button"
              onClick={activeStep.onAction}
              className="mt-1 cursor-pointer inline-flex items-center gap-1.5 font-mono text-xs font-semibold uppercase text-sky-400 hover:text-sky-300 hover:underline"
            >
              <span>{activeStep.actionText}</span>
              <span>→</span>
            </button>
          )}
        </div>

        {/* Card Footer: Step Dots & Navigation Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-2.5 sm:pt-3">
          {/* Step Dots */}
          <div className="flex items-center gap-1.5">
            {steps.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setStepIdx(i);
                  onStepChange?.(i);
                }}
                aria-label={`Jump to step ${i + 1}`}
                className={`cursor-pointer rounded-full border-0 p-0 transition-all duration-300 ${
                  i === stepIdx
                    ? "h-2 w-5 bg-gradient-to-r from-sky-400 to-indigo-500 shadow-[0_0_8px_rgba(56,189,248,0.5)]"
                    : "size-2 bg-white/20 hover:bg-white/40"
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {stepIdx > 0 && (
              <button
                type="button"
                onClick={handlePrev}
                className="cursor-pointer rounded-full border border-white/15 bg-white/[0.05] px-3 py-1 font-sans text-xs font-semibold text-slate-200 transition hover:bg-white/[0.1] hover:text-white"
              >
                ← Back
              </button>
            )}
            <button
              type="button"
              onClick={handleNext}
              className="cursor-pointer rounded-full bg-gradient-to-r from-indigo-600 via-indigo-500 to-sky-500 px-3.5 sm:px-4 py-1.5 font-sans text-xs font-bold text-white shadow-md transition-transform duration-200 hover:scale-[1.03]"
            >
              {stepIdx === steps.length - 1 ? "Finish Tour ✓" : "Next Step →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
