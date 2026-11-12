import React from "react";
import { SpotlightTour, TourStep } from "./SpotlightTour";

export type TourScreen = "intro" | "review" | "vault" | "queue" | "insights" | "library";

interface WorkspaceTourProps {
  open: boolean;
  onClose: () => void;
  currentStepIndex?: number;
  onStepChange?: (index: number) => void;
  user?: any;
  companyName?: string;
  brandName?: string;
  role?: string;
  privacy?: any;
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

export const WorkspaceTour: React.FC<WorkspaceTourProps> = ({
  open,
  onClose,
  onNavigate,
  currentStepIndex = 0,
  onStepChange,
}) => {
  // Ensure the workspace is always on "intro" when tour is open
  React.useEffect(() => {
    if (open) {
      onNavigate("intro");
    }
  }, [open, onNavigate]);

  const steps: TourStep[] = [
    {
      id: "navbar",
      targetSelector: "#brandlint-header-nav",
      tag: "Floating Pill Navigation",
      title: "Quick-Jump Workspace Navigation",
      body: "Navigate instantly between Check Content, Approvals, Brand Rules, Approved Facts, and Insights with active status indicators.",
    },
    {
      id: "hero",
      targetSelector: "#hero-ad-card",
      tag: "Live Ad & Packaging Inspector",
      title: "Interactive Ad & Packaging Inspector",
      body: "Click any brand photo to instantly inspect packaging label OCR, detect print typos, and verify WCAG contrast.",
    },
    {
      id: "role-studio",
      targetSelector: "#role-studio-controls",
      tag: "Role-Based Employee Drafts",
      title: "Draft Studio for Every Employee",
      body: "Dedicated draft pipelines: Creators draft & auto-fix, Reviewers sign off standard routes, Senior Legal verifies escalated claims, and Brand Owners govern rules.",
    },
    {
      id: "scanner",
      targetSelector: "#ad-scanner-stage",
      tag: "Multimodal Computer Vision",
      title: "Ad Image, Copy & Placement Scanner",
      body: "Flexible with ANY image aspect ratio (16:9 banners, 9:16 stories/reels, 4:5 feeds, square, packaging shots). Detects safe-zone collisions and text crowding.",
    },
    {
      id: "vault",
      targetSelector: "#vault-metrics-grid",
      tag: "Governance & Recall Watch",
      title: "Evidence Vault Passports & Approvals",
      body: "Authors can never approve their own work. If an Evidence Passport expires, BrandLint automatically triggers a Recall Alert across published content.",
      actionText: "Open Text & Ad Checker",
      onAction: () => {
        onClose();
        onNavigate("review");
      },
    },
  ];

  return (
    <SpotlightTour
      open={open}
      onClose={onClose}
      steps={steps}
      currentStepIndex={currentStepIndex}
      onStepChange={index => {
        onNavigate("intro");
        onStepChange?.(index);
      }}
    />
  );
};
