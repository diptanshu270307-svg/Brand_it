import React from "react";
import { Badge, Icon, type Tone } from "./ui";

export type SectionMockupVariant =
  | "keynote"
  | "draft_review"
  | "evidence_vault"
  | "review_queue"
  | "guideline_health"
  | "brand_library";

interface VariantMeta {
  eyebrow: string;
  title: string;
  badge: string;
  tone: Tone;
  icon: string;
  footerLeft: string;
  footerRight: string;
}

const META: Record<SectionMockupVariant, VariantMeta> = {
  keynote: {
    eyebrow: "BRANDLINT ARCHITECTURE",
    title: "Governance Pipeline",
    badge: "3-Stage Engine",
    tone: "accent",
    icon: "spark",
    footerLeft: "Rules + Facts + Vision",
    footerRight: "Zero unverified claims",
  },
  draft_review: {
    eyebrow: "DRAFT INSPECTOR",
    title: "5D Claim & Ad Check",
    badge: "Live Linter",
    tone: "warning",
    icon: "search",
    footerLeft: "Sentence + Image OCR",
    footerRight: "5/5 proof dimensions",
  },
  evidence_vault: {
    eyebrow: "PROOF PASSPORT & WATCH",
    title: "Expiry & Recall Radar",
    badge: "Active Watch",
    tone: "danger",
    icon: "radar",
    footerLeft: "Page-pinned certificates",
    footerRight: "Auto recall scan",
  },
  review_queue: {
    eyebrow: "FOUR-EYES GATE",
    title: "Approval Circuit",
    badge: "SoD Enforced",
    tone: "success",
    icon: "shield",
    footerLeft: "Author lock active",
    footerRight: "Immutable audit trail",
  },
  guideline_health: {
    eyebrow: "RULE CALIBRATION",
    title: "vNext Sandbox Delta",
    badge: "96% Agreement",
    tone: "accent",
    icon: "chart",
    footerLeft: "Dismissals tracked",
    footerRight: "Test before publish",
  },
  brand_library: {
    eyebrow: "RULEBOOK INGESTION",
    title: "Policy Extraction Map",
    badge: "Guard Active",
    tone: "success",
    icon: "book",
    footerLeft: "Prompt-injection shield",
    footerRight: "Page-cited rules",
  },
};

function KeynoteIllustration() {
  return (
    <svg viewBox="0 0 360 148" className="h-auto w-full" aria-hidden="true">
      <g stroke="var(--color-line)" strokeOpacity="0.45" strokeWidth="1">
        <line x1="16" y1="36" x2="344" y2="36" strokeDasharray="3 4" />
        <line x1="16" y1="74" x2="344" y2="74" strokeDasharray="3 4" />
        <line x1="16" y1="112" x2="344" y2="112" strokeDasharray="3 4" />
      </g>
      <path d="M 96 48 L 136 74" stroke="var(--brand-teal)" strokeOpacity="0.65" strokeWidth="1.5" fill="none" />
      <path d="M 96 102 L 136 74" stroke="var(--brand-teal)" strokeOpacity="0.65" strokeWidth="1.5" fill="none" />
      <path d="M 224 74 L 262 74" stroke="var(--status-ok, #16a34a)" strokeOpacity="0.8" strokeWidth="2" fill="none" />
      <circle cx="243" cy="74" r="3" fill="var(--status-ok, #16a34a)" />

      <g className="lv-mockup-node">
        <rect x="14" y="28" width="84" height="36" rx="8" fill="var(--color-raised)" stroke="var(--color-line)" />
        <circle cx="28" cy="46" r="5" fill="rgba(20,184,166,0.16)" stroke="var(--brand-teal)" strokeWidth="1.3" />
        <text x="40" y="44" fill="var(--color-bone)" fontSize="9" fontWeight="700" fontFamily="monospace">RULES</text>
        <text x="40" y="55" fill="var(--color-ash)" fontSize="7.5" fontFamily="monospace">Page-cited</text>
      </g>
      <g className="lv-mockup-node">
        <rect x="14" y="84" width="84" height="36" rx="8" fill="var(--color-raised)" stroke="var(--color-line)" />
        <circle cx="28" cy="102" r="5" fill="rgba(20,184,166,0.16)" stroke="var(--brand-teal)" strokeWidth="1.3" />
        <text x="40" y="100" fill="var(--color-bone)" fontSize="9" fontWeight="700" fontFamily="monospace">FACTS</text>
        <text x="40" y="111" fill="var(--color-ash)" fontSize="7.5" fontFamily="monospace">Passports</text>
      </g>

      <g className="lv-mockup-node">
        <rect x="136" y="42" width="88" height="64" rx="10" fill="#0a2540" stroke="var(--brand-teal)" strokeWidth="1.3" />
        <rect x="146" y="52" width="68" height="10" rx="3" fill="rgba(20,184,166,0.18)" />
        <text x="180" y="60" textAnchor="middle" fill="#5eead4" fontSize="7.5" fontWeight="700" fontFamily="monospace">OCR + CLAIM</text>
        <rect x="146" y="69" width="68" height="9" rx="3" fill="rgba(255,255,255,0.1)" />
        <rect x="146" y="69" width="52" height="9" rx="3" fill="#14b8a6" fillOpacity="0.85" />
        <rect x="146" y="84" width="68" height="12" rx="4" fill="rgba(22,163,74,0.22)" stroke="rgba(74,222,128,0.55)" />
        <text x="180" y="93" textAnchor="middle" fill="#86efac" fontSize="7.5" fontWeight="700" fontFamily="monospace">5D VERIFY</text>
      </g>

      <g className="lv-mockup-node">
        <rect x="262" y="48" width="84" height="52" rx="10" fill="var(--color-raised)" stroke="var(--status-ok, #16a34a)" strokeOpacity="0.55" />
        <path d="M 277 65 L 281 69 L 288 61" stroke="var(--status-ok, #16a34a)" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <text x="295" y="67" fill="var(--color-bone)" fontSize="9" fontWeight="700" fontFamily="monospace">GATE PASS</text>
        <text x="275" y="83" fill="var(--color-ash)" fontSize="7.5" fontFamily="monospace">Four-Eyes Ready</text>
        <rect x="275" y="88" width="58" height="3" rx="1.5" fill="var(--status-ok, #16a34a)" />
      </g>
    </svg>
  );
}

function DraftReviewIllustration() {
  return (
    <svg viewBox="0 0 360 148" className="h-auto w-full" aria-hidden="true">
      <g className="lv-mockup-node">
        <rect x="12" y="14" width="194" height="120" rx="10" fill="var(--color-raised)" stroke="var(--color-line)" />
        <rect x="24" y="26" width="84" height="6" rx="3" fill="var(--color-ash)" fillOpacity="0.3" />
        <rect x="24" y="44" width="166" height="8" rx="3" fill="var(--color-line)" fillOpacity="0.4" />
        <rect x="24" y="44" width="96" height="8" rx="3" fill="rgba(220,38,38,0.22)" />
        <line x1="24" y1="54" x2="120" y2="54" stroke="var(--status-danger, #dc2626)" strokeWidth="1.6" strokeDasharray="2 2" />
        <rect x="24" y="66" width="150" height="7" rx="3" fill="var(--color-line)" fillOpacity="0.55" />
        <rect x="24" y="84" width="164" height="8" rx="3" fill="rgba(22,163,74,0.18)" />
        <line x1="24" y1="94" x2="132" y2="94" stroke="var(--status-ok, #16a34a)" strokeWidth="1.6" />
        <rect x="24" y="108" width="66" height="16" rx="4" fill="rgba(220,38,38,0.14)" stroke="rgba(220,38,38,0.45)" />
        <text x="57" y="119" textAnchor="middle" fill="var(--status-danger, #dc2626)" fontSize="7.5" fontWeight="700" fontFamily="monospace">1 BLOCKING</text>
        <rect x="96" y="108" width="66" height="16" rx="4" fill="rgba(22,163,74,0.14)" stroke="rgba(22,163,74,0.45)" />
        <text x="129" y="119" textAnchor="middle" fill="var(--status-ok, #16a34a)" fontSize="7.5" fontWeight="700" fontFamily="monospace">2 VERIFIED</text>
      </g>

      <path d="M 206 74 L 224 74" stroke="var(--brand-teal)" strokeWidth="1.5" strokeDasharray="3 2" />

      <g className="lv-mockup-node">
        <rect x="224" y="14" width="124" height="120" rx="10" fill="var(--color-raised)" stroke="var(--brand-teal)" strokeOpacity="0.45" />
        <text x="236" y="31" fill="var(--brand-teal-ink, #14b8a6)" fontSize="8" fontWeight="700" fontFamily="monospace">5D PROOF ALIGN</text>
        {[
          { label: "Claim", w: 62, c: "var(--status-ok, #16a34a)", y: 44 },
          { label: "Source", w: 62, c: "var(--status-ok, #16a34a)", y: 61 },
          { label: "Expiry", w: 62, c: "var(--status-ok, #16a34a)", y: 78 },
          { label: "Channel", w: 34, c: "var(--status-warn, #d97706)", y: 95 },
          { label: "Scope", w: 22, c: "var(--status-danger, #dc2626)", y: 112 },
        ].map(row => (
          <g key={row.label}>
            <text x="236" y={row.y + 6} fill="var(--color-ash)" fontSize="7.5" fontFamily="monospace">{row.label}</text>
            <rect x="274" y={row.y} width="62" height="7" rx="3.5" fill="var(--color-line)" fillOpacity="0.45" />
            <rect x="274" y={row.y} width={row.w} height="7" rx="3.5" fill={row.c} fillOpacity="0.88" />
          </g>
        ))}
      </g>
    </svg>
  );
}

function EvidenceVaultIllustration() {
  return (
    <svg viewBox="0 0 360 148" className="h-auto w-full" aria-hidden="true">
      <g className="lv-mockup-node">
        <rect x="14" y="20" width="150" height="108" rx="10" fill="var(--color-raised)" stroke="var(--brand-teal)" strokeOpacity="0.45" />
        <rect x="26" y="33" width="60" height="14" rx="4" fill="rgba(20,184,166,0.16)" stroke="rgba(20,184,166,0.45)" />
        <text x="56" y="43" textAnchor="middle" fill="var(--brand-teal-ink, #14b8a6)" fontSize="7.5" fontWeight="700" fontFamily="monospace">LAB p.14</text>
        <text x="94" y="43" fill="var(--color-bone)" fontSize="8" fontWeight="700" fontFamily="monospace">PASS-08</text>
        <rect x="26" y="57" width="124" height="6" rx="3" fill="var(--color-ash)" fillOpacity="0.28" />
        <rect x="26" y="70" width="102" height="6" rx="3" fill="var(--color-ash)" fillOpacity="0.18" />
        <text x="26" y="96" fill="var(--color-ash)" fontSize="7" fontFamily="monospace">VALIDITY WINDOW</text>
        <rect x="26" y="103" width="124" height="7" rx="3.5" fill="var(--color-line)" fillOpacity="0.45" />
        <rect x="26" y="103" width="88" height="7" rx="3.5" fill="var(--status-ok, #16a34a)" />
        <rect x="114" y="103" width="22" height="7" rx="3.5" fill="var(--status-warn, #d97706)" />
      </g>

      <path d="M 164 74 L 194 74" stroke="var(--status-warn, #d97706)" strokeWidth="1.6" strokeDasharray="3 3" />

      <g className="lv-mockup-node">
        <rect x="194" y="20" width="152" height="108" rx="10" fill="var(--color-raised)" stroke="var(--status-danger, #dc2626)" strokeOpacity="0.45" />
        <circle cx="242" cy="74" r="34" fill="none" stroke="rgba(220,38,38,0.22)" strokeWidth="1" />
        <circle cx="242" cy="74" r="22" fill="none" stroke="rgba(220,38,38,0.34)" strokeWidth="1" />
        <circle cx="242" cy="74" r="10" fill="rgba(220,38,38,0.18)" stroke="var(--status-danger, #dc2626)" strokeWidth="1.2" />
        <line x1="242" y1="74" x2="265" y2="50" stroke="var(--status-danger, #dc2626)" strokeWidth="1.6" />
        <circle cx="265" cy="50" r="3.5" fill="var(--status-danger, #dc2626)" />
        <text x="288" y="60" fill="var(--status-danger, #dc2626)" fontSize="8.5" fontWeight="700" fontFamily="monospace">RECALL</text>
        <text x="288" y="73" fill="var(--color-bone)" fontSize="8" fontFamily="monospace">1 Flagged</text>
        <rect x="288" y="83" width="46" height="14" rx="4" fill="rgba(220,38,38,0.14)" stroke="rgba(220,38,38,0.45)" />
        <text x="311" y="93" textAnchor="middle" fill="var(--status-danger, #dc2626)" fontSize="7" fontWeight="700" fontFamily="monospace">PAUSE</text>
      </g>
    </svg>
  );
}

function ReviewQueueIllustration() {
  const nodes = [
    { x: 14, label: "WRITER", sub: "Locked", c: "var(--status-danger, #dc2626)" },
    { x: 102, label: "REVIEWER", sub: "Tier 1", c: "var(--brand-teal-ink, #14b8a6)" },
    { x: 190, label: "SENIOR", sub: "Legal/Med", c: "var(--status-warn, #d97706)" },
    { x: 278, label: "PUBLISH", sub: "Signed", c: "var(--status-ok, #16a34a)" },
  ];
  return (
    <svg viewBox="0 0 360 148" className="h-auto w-full" aria-hidden="true">
      <line x1="50" y1="62" x2="314" y2="62" stroke="var(--color-line)" strokeWidth="2" />
      <line x1="138" y1="62" x2="314" y2="62" stroke="var(--status-ok, #16a34a)" strokeOpacity="0.55" strokeWidth="2" />
      {nodes.map((n, i) => (
        <g key={n.label} className="lv-mockup-node">
          <rect
            x={n.x}
            y="30"
            width="68"
            height="64"
            rx="10"
            fill="var(--color-raised)"
            stroke={n.c}
            strokeOpacity={i === 0 ? 0.45 : 0.7}
          />
          <circle cx={n.x + 34} cy="48" r="8" fill={n.c} fillOpacity="0.14" stroke={n.c} strokeWidth="1.3" />
          <text x={n.x + 34} y="51" textAnchor="middle" fill={n.c} fontSize="8" fontWeight="700" fontFamily="monospace">
            {i + 1}
          </text>
          <text x={n.x + 34} y="70" textAnchor="middle" fill="var(--color-bone)" fontSize="8" fontWeight="700" fontFamily="monospace">
            {n.label}
          </text>
          <text x={n.x + 34} y="82" textAnchor="middle" fill="var(--color-ash)" fontSize="7" fontFamily="monospace">
            {n.sub}
          </text>
        </g>
      ))}
      <rect x="14" y="108" width="332" height="24" rx="7" fill="rgba(22,163,74,0.1)" stroke="rgba(22,163,74,0.35)" />
      <text x="180" y="123" textAnchor="middle" fill="var(--status-ok, #16a34a)" fontSize="8" fontWeight="700" fontFamily="monospace">
        SELF-APPROVAL BLOCKED · REVISION HASH PRESERVED
      </text>
    </svg>
  );
}

function GuidelineHealthIllustration() {
  const dots = [
    { cx: 52, cy: 92, r: 4, c: "var(--status-danger, #dc2626)" },
    { cx: 88, cy: 76, r: 4, c: "var(--status-warn, #d97706)" },
    { cx: 124, cy: 52, r: 4.5, c: "var(--brand-teal)" },
    { cx: 162, cy: 38, r: 5, c: "var(--status-ok, #16a34a)" },
  ];
  return (
    <svg viewBox="0 0 360 148" className="h-auto w-full" aria-hidden="true">
      <g className="lv-mockup-node">
        <rect x="12" y="14" width="184" height="120" rx="10" fill="var(--color-raised)" stroke="var(--color-line)" />
        <text x="24" y="30" fill="var(--color-ash)" fontSize="7.5" fontWeight="700" fontFamily="monospace">AGREEMENT CURVE</text>
        <line x1="28" y1="108" x2="180" y2="108" stroke="var(--color-line)" />
        <line x1="28" y1="42" x2="28" y2="108" stroke="var(--color-line)" />
        <polyline
          points="52,92 88,76 124,52 162,38"
          fill="none"
          stroke="var(--brand-teal)"
          strokeWidth="2"
        />
        {dots.map((d, idx) => (
          <circle key={idx} cx={d.cx} cy={d.cy} r={d.r} fill={d.c} stroke="var(--color-panel)" strokeWidth="1.5" />
        ))}
        <text x="162" y="29" textAnchor="end" fill="var(--status-ok, #16a34a)" fontSize="8" fontWeight="700" fontFamily="monospace">96% AGREE</text>
      </g>

      <g className="lv-mockup-node">
        <rect x="208" y="14" width="140" height="120" rx="10" fill="var(--color-raised)" stroke="var(--status-ok, #16a34a)" strokeOpacity="0.45" />
        <text x="220" y="31" fill="var(--status-ok, #16a34a)" fontSize="8" fontWeight="700" fontFamily="monospace">SANDBOX vNext</text>
        <rect x="220" y="44" width="116" height="22" rx="5" fill="var(--color-panel)" stroke="var(--color-line)" strokeOpacity="0.4" />
        <text x="228" y="58" fill="var(--color-ash)" fontSize="7.5" fontFamily="monospace">Dismissals</text>
        <text x="328" y="58" textAnchor="end" fill="var(--status-ok, #16a34a)" fontSize="8" fontWeight="700" fontFamily="monospace">-34%</text>
        <rect x="220" y="72" width="116" height="22" rx="5" fill="var(--color-panel)" stroke="var(--color-line)" strokeOpacity="0.4" />
        <text x="228" y="86" fill="var(--color-ash)" fontSize="7.5" fontFamily="monospace">Channels</text>
        <text x="328" y="86" textAnchor="end" fill="var(--brand-teal-ink, #14b8a6)" fontSize="8" fontWeight="700" fontFamily="monospace">+WEB</text>
        <rect x="220" y="102" width="116" height="20" rx="5" fill="rgba(22,163,74,0.14)" stroke="rgba(22,163,74,0.45)" />
        <text x="278" y="115" textAnchor="middle" fill="var(--status-ok, #16a34a)" fontSize="7.5" fontWeight="700" fontFamily="monospace">SAFE TO PUBLISH</text>
      </g>
    </svg>
  );
}

function BrandLibraryIllustration() {
  return (
    <svg viewBox="0 0 360 148" className="h-auto w-full" aria-hidden="true">
      <g className="lv-mockup-node">
        <rect x="12" y="24" width="84" height="100" rx="9" fill="var(--color-raised)" stroke="var(--color-line)" />
        <rect x="22" y="36" width="38" height="12" rx="3" fill="rgba(20,184,166,0.16)" />
        <text x="41" y="45" textAnchor="middle" fill="var(--brand-teal-ink, #14b8a6)" fontSize="7" fontWeight="700" fontFamily="monospace">PDF v4</text>
        <rect x="22" y="58" width="64" height="5" rx="2.5" fill="var(--color-ash)" fillOpacity="0.28" />
        <rect x="22" y="69" width="52" height="5" rx="2.5" fill="var(--color-ash)" fillOpacity="0.18" />
        <rect x="22" y="80" width="58" height="5" rx="2.5" fill="var(--color-ash)" fillOpacity="0.18" />
        <rect x="22" y="96" width="64" height="16" rx="4" fill="rgba(217,119,6,0.14)" stroke="rgba(217,119,6,0.45)" />
        <text x="54" y="107" textAnchor="middle" fill="var(--status-warn, #d97706)" fontSize="7" fontWeight="700" fontFamily="monospace">SANITIZED</text>
      </g>

      <path d="M 96 74 L 122 74" stroke="var(--brand-teal)" strokeWidth="1.6" />

      <g className="lv-mockup-node">
        <rect x="122" y="34" width="96" height="80" rx="10" fill="#0a2540" stroke="var(--brand-teal)" strokeOpacity="0.65" />
        <text x="170" y="54" textAnchor="middle" fill="#5eead4" fontSize="8" fontWeight="700" fontFamily="monospace">UNTRUSTED GUARD</text>
        <rect x="134" y="64" width="72" height="16" rx="4" fill="rgba(20,184,166,0.18)" />
        <text x="170" y="75" textAnchor="middle" fill="#f8fafc" fontSize="7" fontWeight="700" fontFamily="monospace">STRIP INJECTION</text>
        <rect x="134" y="86" width="72" height="16" rx="4" fill="rgba(255,255,255,0.08)" />
        <text x="170" y="97" textAnchor="middle" fill="#e2e8f0" fontSize="7" fontWeight="700" fontFamily="monospace">EXTRACT CLAUSES</text>
      </g>

      <path d="M 218 74 L 244 74" stroke="var(--status-ok, #16a34a)" strokeWidth="1.6" />

      <g className="lv-mockup-node">
        <rect x="244" y="24" width="104" height="100" rx="9" fill="var(--color-raised)" stroke="var(--status-ok, #16a34a)" strokeOpacity="0.5" />
        <text x="256" y="42" fill="var(--status-ok, #16a34a)" fontSize="8" fontWeight="700" fontFamily="monospace">ACTIVE RULES</text>
        {[
          { label: "Disclaimer", tag: "p.12", y: 52 },
          { label: "No Cure Claim", tag: "p.04", y: 74 },
          { label: "Tone: Warm", tag: "p.09", y: 96 },
        ].map(r => (
          <g key={r.label}>
            <rect x="254" y={r.y} width="84" height="16" rx="4" fill="var(--color-panel)" />
            <text x="260" y={r.y + 11} fill="var(--color-bone)" fontSize="7" fontFamily="monospace">{r.label}</text>
            <text x="332" y={r.y + 11} textAnchor="end" fill="var(--status-ok, #16a34a)" fontSize="7" fontFamily="monospace">{r.tag}</text>
          </g>
        ))}
      </g>
    </svg>
  );
}

const ILLUSTRATIONS: Record<SectionMockupVariant, () => React.ReactNode> = {
  keynote: KeynoteIllustration,
  draft_review: DraftReviewIllustration,
  evidence_vault: EvidenceVaultIllustration,
  review_queue: ReviewQueueIllustration,
  guideline_health: GuidelineHealthIllustration,
  brand_library: BrandLibraryIllustration,
};

/**
 * Consistent corporate product mockup card used across sections and Walkthrough steps.
 * Features clean vector diagrams (no stock photos) and gentle GPU entrance/hover lift.
 */
export const SectionMockup = React.memo(function SectionMockup({
  variant,
  className = "",
}: {
  variant: SectionMockupVariant;
  className?: string;
}) {
  const meta = META[variant];
  const Illustration = ILLUSTRATIONS[variant];

  return (
    <div className={`lv-mockup-card ${className}`}>
      <div className="flex items-center justify-between gap-2 border-b border-line bg-raised/70 px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1" aria-hidden="true">
            <span className="size-2 rounded-full bg-blocking/70" />
            <span className="size-2 rounded-full bg-major/70" />
            <span className="size-2 rounded-full bg-ok/70" />
          </div>
          <span className="font-label text-[10px] font-semibold uppercase tracking-wider text-ash">
            {meta.eyebrow}
          </span>
        </div>
        <Badge tone={meta.tone}>
          <Icon name={meta.icon} size={11} />
          {meta.badge}
        </Badge>
      </div>

      <div className="px-3 py-3">
        <div className="mb-2 flex items-center justify-between px-1">
          <span className="font-display text-sm font-bold uppercase tracking-tight text-bone">
            {meta.title}
          </span>
          <span className="font-mono text-[10px] text-ash">preview</span>
        </div>
        <Illustration />
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-line bg-raised/50 px-4 py-2 font-mono text-[10px] text-ash">
        <span>{meta.footerLeft}</span>
        <span className="text-bone/80">{meta.footerRight}</span>
      </div>
    </div>
  );
});
