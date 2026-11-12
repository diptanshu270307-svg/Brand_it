import React, { useEffect, useRef } from "react";
import { WalkthroughFlow, type TourScreen } from "./WalkthroughFlow";

export type { TourScreen };

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
 * Modal presentation wrapper for the 4-step WalkthroughFlow.
 * Handles focus restoration, Tab focus trapping, backdrop click, and Escape close.
 */
export const WorkspaceTour: React.FC<WorkspaceTourProps> = ({
  open,
  onClose,
  onNavigate,
  currentStepIndex = 0,
  onStepChange,
}) => {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = document.activeElement as HTMLElement | null;

    const timer = window.setTimeout(() => {
      const dialog = dialogRef.current;
      if (!dialog) return;
      const firstFocusable = dialog.querySelector<HTMLElement>(
        'button:not([disabled]):not([tabindex="-1"]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
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

  useEffect(() => {
    if (!open) return;

    const handleModalKeys = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === "Tab" && dialogRef.current) {
        const focusables = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]):not([tabindex="-1"]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
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

    window.addEventListener("keydown", handleModalKeys);
    return () => window.removeEventListener("keydown", handleModalKeys);
  }, [onClose, open]);

  if (!open) return null;

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
        className="max-h-[calc(100dvh-2rem)] w-full max-w-[920px] overflow-y-auto rounded-2xl"
      >
        <WalkthroughFlow
          mode="modal"
          stepIndex={currentStepIndex}
          onStepChange={onStepChange}
          onNavigateScreen={onNavigate}
          onClose={onClose}
          captureGlobalKeys
          titleId="bl-walkthrough-title"
          descId="bl-walkthrough-desc"
        />
      </div>
    </div>
  );
};
