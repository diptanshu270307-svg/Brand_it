import React from "react";

export interface TourStep {
  id: string;
  targetSelector?: string;
  tag?: string;
  title: string;
  body: string;
  actionText?: string;
  onAction?: () => void;
}

interface SpotlightTourProps {
  open: boolean;
  onClose: () => void;
  steps?: TourStep[];
  currentStepIndex?: number;
  onStepChange?: (index: number) => void;
}

/**
 * Legacy compatibility shim: WorkspaceTour now renders the centered
 * step-by-step Walkthrough Guide directly without DOM spotlight lag.
 */
export const SpotlightTour: React.FC<SpotlightTourProps> = () => null;
