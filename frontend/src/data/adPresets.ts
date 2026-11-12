export interface BoundingRegion {
  id: string;
  code: string;
  label: string;
  status: "pass" | "warning" | "blocking";
  box: { top: number; left: number; width: number; height: number };
  detail: string;
  fix?: string;
}

export interface PresetAd {
  id: string;
  name: string;
  shortLabel: string;
  channel: string;
  dimensions: { width: number; height: number };
  eyebrow: string;
  headline: string[];
  subline: string;
  cta: string;
  footnote: string;
  extractedText: string;
  contrastRatio: number;
  textCoveragePct: number;
  topZoneBusy: boolean;
  bottomZoneBusy: boolean;
  focalBalancePct: number;
  gradient: string;
  accent: string;
  customImageUrl?: string;
  fallbackImageUrl?: string;
  showTextOverlay?: boolean;
  gridWeights: number[];
  regions: BoundingRegion[];
}

export const AURA_GLOW_ADS: PresetAd[] = [
  {
    id: "aura-guarantee-banner",
    name: "01 · Aura Glow 'This or That' Guarantee Ad",
    shortLabel: "Guarantee Banner",
    channel: "Landing Page",
    dimensions: { width: 1024, height: 571 },
    eyebrow: "AURA GLOW · DIRECT RESPONSE BANNER",
    headline: ["VISIBLE RESULTS...", "OR YOUR MONEY BACK!", "GUARANTEED"],
    subline:
      "THIS: Glowing Skin & Visible Results! THAT: 100% of Your Money Back! Try Aura Glow Serum risk-free for 30 days!",
    cta: "SHOP RISK-FREE TODAY at auraglow.com",
    footnote: "CUSTOMER SUPPORT 1-800-GLOW-NOW · 30 Days Guarantee",
    extractedText:
      "VISIBLE RESULTS... OR YOUR MONEY BACK! GUARANTEED. THIS: GLOWING SKIN & VISIBLE RESULTS! THAT: 100% OF YOUR MONEY BACK! OUR THIS OR THAT GUARANTEE. Love your skin's transformation, or get a full refund. No questions asked. Try Aura Glow Serum risk-free for 30 days! SHOP RISK-FREE TODAY at auraglow.com",
    contrastRatio: 9.2,
    textCoveragePct: 33.8,
    topZoneBusy: true,
    bottomZoneBusy: true,
    focalBalancePct: 72,
    gradient: "from-[#0f172a] via-[#1e293b] to-[#090a0f]",
    accent: "#38bdf8",
    customImageUrl: "/ads/aura-glow-guarantee-ad.webp",
    fallbackImageUrl: "/ads/aura-glow-guarantee-ad.jpg",
    showTextOverlay: false,
    gridWeights: [36, 42, 34, 30, 48, 38, 32, 44, 35],
    regions: [
      {
        id: "ag-top-guarantee",
        code: "CLAIM-01 · BLOCKING",
        label: "Unqualified 'VISIBLE RESULTS... GUARANTEED' Headline",
        status: "blocking",
        box: { top: 2, left: 3, width: 94, height: 21 },
        detail:
          "Absolute “GUARANTEED” headline in top 20% banner violates CLAIM-01. Must qualify visible results with clinical test timeframe & sample size (EV-1) and link refund conditions.",
        fix: "“92% reported visibly brighter skin after 30 days (EV-1, n=124) — backed by our 30-day satisfaction policy.”",
      },
      {
        id: "ag-this-that",
        code: "DENSITY · 33.8% CROWDED",
        label: "Split 'THIS vs THAT' Copy Block (>20% Ad Text Limit)",
        status: "warning",
        box: { top: 28, left: 31, width: 38, height: 36 },
        detail:
          "Text covers 33.8% of the total image canvas (exceeding Meta/LinkedIn's 20% optimal thumb-stop threshold). Consider simplifying the center columns.",
        fix: "Reduce center bullet text by 30% to give the model portrait and serum bottle more breathing room.",
      },
      {
        id: "ag-bottle-label",
        code: "PRINT-01 · LABEL TYPO",
        label: "Bottle Label Duplicate Print ('FACIAL SERUM' ×2)",
        status: "warning",
        box: { top: 43, left: 4, width: 14, height: 32 },
        detail:
          "High-res OCR detected “FACIAL SERUM” printed twice on the handheld bottle label. Retouch packaging layer before paid media launch.",
        fix: "Replace second line on bottle label with “VITAMIN C + BOTANICAL COMPLEX”.",
      },
      {
        id: "ag-risk-free-footer",
        code: "TERM-02 · BLOCKING",
        label: "'No Questions Asked' & 'Shop Risk-Free' Footer Bar",
        status: "blocking",
        box: { top: 67, left: 16, width: 68, height: 31 },
        detail:
          "“No questions asked” and “risk-free” are prohibited absolute financial/efficacy promises unless accompanied by the verbatim return policy footnote.",
        fix: "“Try Aura Glow Facial Serum for 30 days — full refund within 30 days of purchase (see auraglow.com/returns).”",
      },
    ],
  },
  {
    id: "aura-product-lineup",
    name: "02 · Aura Glow 3-Product Lineup Studio Shot",
    shortLabel: "Product Lineup",
    channel: "Instagram Feed",
    dimensions: { width: 1024, height: 764 },
    eyebrow: "AURA GLOW · COMPLETE SKINCARE SYSTEM",
    headline: ["Cleanse, Treat", "& Hydrate for", "Radiant Skin*"],
    subline: "Gentle Foaming Facewash (150ml) · Facial Serum (30ml) · Daily Hydrating Lotion (100ml).",
    cta: "Explore the 3-Step Routine →",
    footnote: "*Backed by our 30-Day Satisfaction Policy · EV-1 Clinical Study (p.2)",
    extractedText:
      "AURA GLOW Gentle Foaming Facewash Cleanses & Brightens 150ml. AURA GLOW Facial Serum 30ml. AURA GLOW Daily Hydrating Lotion Moisturizes & Glows 100ml. 30 Days Guarantee.",
    contrastRatio: 8.8,
    textCoveragePct: 14.6,
    topZoneBusy: false,
    bottomZoneBusy: false,
    focalBalancePct: 94,
    gradient: "from-[#432818] via-[#1f1712] to-[#0c0a09]",
    accent: "#f59e0b",
    customImageUrl: "/ads/aura-glow-lineup.webp",
    fallbackImageUrl: "/ads/aura-glow-lineup.jpg",
    showTextOverlay: false,
    gridWeights: [12, 24, 14, 28, 38, 30, 16, 26, 15],
    regions: [
      {
        id: "lineup-facewash",
        code: "PACKAGING · VERIFIED",
        label: "Gentle Foaming Facewash (150ml / 5 fl. oz.)",
        status: "pass",
        box: { top: 18, left: 24, width: 24, height: 68 },
        detail:
          "Typography hierarchy, “Cleanses & Brightens” structure claim, and net-weight declaration (150ml / 5 fl. oz.) pass cosmetic labeling rules.",
      },
      {
        id: "lineup-serum-typo",
        code: "PRINT-01 · BLOCKING",
        label: "Serum Bottle Label Duplicate ('FACIAL SERUM' ×2)",
        status: "blocking",
        box: { top: 64, left: 50, width: 14, height: 25 },
        detail:
          "OCR packaging check flagged duplicate line: “FACIAL SERUM / FACIAL SERUM” printed twice on the 30ml amber dropper bottle.",
        fix: "Correct front label artwork to read “FACIAL SERUM / BOTANICAL GLOW DROPS” before print/ad run.",
      },
      {
        id: "lineup-seals",
        code: "BADGE-02 · REVIEW",
        label: "Three '30 Days Guarantee' Seals on Packaging",
        status: "warning",
        box: { top: 23, left: 32, width: 44, height: 34 },
        detail:
          "Repeating the “30 DAYS GUARANTEE” seal across all three SKUs requires a visible return-policy qualifier in the ad caption or landing page footer.",
        fix: "Include “*30-day money-back satisfaction policy; terms at auraglow.com” in post caption.",
      },
      {
        id: "lineup-lotion",
        code: "PLACEMENT · 94% FIT",
        label: "Daily Hydrating Lotion & Botanical Staging",
        status: "pass",
        box: { top: 22, left: 65, width: 16, height: 64 },
        detail:
          "Rule-of-thirds product grouping (94% balance) and warm natural lighting create high thumb-stop appeal for Instagram & e-commerce hero placements.",
      },
    ],
  },
  {
    id: "aura-mirror-routine",
    name: "03 · Aura Glow Mirror Routine Lifestyle Ad",
    shortLabel: "Mirror Routine",
    channel: "LinkedIn",
    dimensions: { width: 1024, height: 764 },
    eyebrow: "AURA GLOW · DAILY RITUAL",
    headline: ["18% brighter", "skin tone in", "90 days*"],
    subline: "Precision botanical dropper formulated for daily morning & evening routines.",
    cta: "Shop Aura Glow Serum →",
    footnote: "*EV-1 · Consumer Perception & Hydration Study 2025 (n=124, p.2)",
    extractedText:
      "AURA GLOW Facial Serum 30ml / 1 fl. oz. Precision botanical dropper formulated for daily skincare routines. Teams and consumers reported 18% higher task throughput and hydration after 90 days (EV-1, p.2).",
    contrastRatio: 8.6,
    textCoveragePct: 11.4,
    topZoneBusy: false,
    bottomZoneBusy: false,
    focalBalancePct: 92,
    gradient: "from-[#1e1b4b] via-[#0f172a] to-[#090a0f]",
    accent: "#10b981",
    customImageUrl: "/ads/aura-glow-mirror.webp",
    fallbackImageUrl: "/ads/aura-glow-mirror.jpg",
    showTextOverlay: false,
    gridWeights: [10, 14, 24, 14, 34, 28, 16, 22, 26],
    regions: [
      {
        id: "mirror-safezone",
        code: "SAFE ZONE · 96% CLEAR",
        label: "Upper-Left Mirror Negative Space (Optimal Copy Zone)",
        status: "pass",
        box: { top: 6, left: 10, width: 34, height: 42 },
        detail:
          "Clean, low-frequency mirror reflection in the upper-left quadrant provides an ideal high-contrast zone for ad headline overlays without obscuring the product.",
      },
      {
        id: "mirror-dropper",
        code: "FOCAL · OPTIMAL",
        label: "Dropper Action at Center Intersection",
        status: "pass",
        box: { top: 26, left: 43, width: 14, height: 22 },
        detail:
          "Pipette dropper sits directly on the central vertical axis (92% focal balance), naturally drawing viewer eye movement down to the brand mark.",
      },
      {
        id: "mirror-bottle",
        code: "PRINT-01 · WARNING",
        label: "Handheld Bottle Label ('FACIAL SERUM' ×2)",
        status: "warning",
        box: { top: 47, left: 45, width: 10, height: 24 },
        detail:
          "Amber bottle label is sharp and legible, but displays the duplicate “FACIAL SERUM / FACIAL SERUM” line at 200% zoom.",
        fix: "Retouch duplicate sub-label line on 30ml bottle.",
      },
    ],
  },
  {
    id: "aura-portrait-apply",
    name: "04 · Aura Glow Serum Application Portrait",
    shortLabel: "Portrait Application",
    channel: "Instagram",
    dimensions: { width: 1024, height: 764 },
    eyebrow: "AURA GLOW · DERMATOLOGIST TESTED",
    headline: ["Glow that", "speaks for", "itself."],
    subline: "Lightweight botanical serum that absorbs in seconds.",
    cta: "Try the 30-Day Routine →",
    footnote: "*EV-1 · Verified Consumer Study 2025 (p.2)",
    extractedText:
      "AURA GLOW Facial Serum. Lightweight botanical serum that absorbs in seconds. Reported 18% higher hydration and throughput after 90 days (EV-1, p.2).",
    contrastRatio: 9.1,
    textCoveragePct: 9.8,
    topZoneBusy: false,
    bottomZoneBusy: false,
    focalBalancePct: 96,
    gradient: "from-[#1e1b4b] via-[#0f172a] to-[#090a0f]",
    accent: "#8b5cf6",
    customImageUrl: "/ads/aura-glow-apply.webp",
    fallbackImageUrl: "/ads/aura-glow-apply.jpg",
    showTextOverlay: false,
    gridWeights: [12, 28, 12, 20, 36, 26, 18, 24, 22],
    regions: [
      {
        id: "apply-face-focal",
        code: "ATTENTION · 96% SCORE",
        label: "Eye-Line & Dropper Application Focal Point",
        status: "pass",
        box: { top: 12, left: 32, width: 38, height: 44 },
        detail:
          "Human gaze + pipette application creates the highest thumb-stop attention score (96/100) across Instagram Feed and LinkedIn Sponsored placements.",
      },
      {
        id: "apply-bottle-hold",
        code: "BRAND MARK · CLEAR",
        label: "Frosted Bottle Brand Lockup",
        status: "pass",
        box: { top: 43, left: 64, width: 13, height: 27 },
        detail:
          "“AURA GLOW” wordmark on the frosted bottle is unobstructed by fingers and sits cleanly inside the 14%–80% vertical safe zone.",
      },
    ],
  },
  {
    id: "aura-macro-dropper",
    name: "05 · Aura Glow Botanical Serum Macro Shot",
    shortLabel: "Macro Texture",
    channel: "Landing Page",
    dimensions: { width: 1024, height: 764 },
    eyebrow: "AURA GLOW · PURE BOTANICAL FORMULATION",
    headline: ["Every drop", "clinically", "verified."],
    subline: "Cold-pressed botanical extracts on natural marble.",
    cta: "Read Clinical Study (EV-1) →",
    footnote: "*EV-1 · Laboratory & Consumer Study 2025 (p.2)",
    extractedText:
      "Every drop clinically verified. Teams and customers using Lumina Flow & Aura Glow reported 18% higher throughput after 90 days (EV-1, p.2).",
    contrastRatio: 4.1,
    textCoveragePct: 8.2,
    topZoneBusy: false,
    bottomZoneBusy: false,
    focalBalancePct: 93,
    gradient: "from-[#1e1b4b] via-[#0f172a] to-[#090a0f]",
    accent: "#10b981",
    customImageUrl: "/ads/aura-glow-dropper.webp",
    fallbackImageUrl: "/ads/aura-glow-dropper.jpg",
    showTextOverlay: true,
    gridWeights: [18, 14, 12, 22, 35, 16, 20, 18, 14],
    regions: [
      {
        id: "macro-pipette",
        code: "TEXTURE · 93% BALANCE",
        label: "Macro Glass Pipette & Serum Droplet",
        status: "pass",
        box: { top: 4, left: 6, width: 58, height: 58 },
        detail:
          "Leading diagonal line from top-left pipette to center serum droplet guides the eye directly to the center of the canvas.",
      },
      {
        id: "macro-contrast",
        code: "CONTRAST · 4.1:1 NOTE",
        label: "Bright Marble Background Luminance",
        status: "warning",
        box: { top: 42, left: 42, width: 52, height: 48 },
        detail:
          "Warm ivory marble surface has high luminance (0.82). White overlay typography measures 4.1:1 — use dark Charcoal (#0f172a) text or a 45% gradient scrim for WCAG AAA legibility.",
        fix: "Apply dark gradient scrim or switch overlay typography to Slate-950 (#09090b) for 11.2:1 contrast.",
      },
    ],
  },
];
