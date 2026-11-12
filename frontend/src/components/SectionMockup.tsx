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
    <svg viewBox="0 0 360 148" className="w-full h-auto" aria-hidden="true">
      <defs>
        <linearGradient id="bl-k-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#a39cff" stopOpacity="0.85" />
          <stop offset="50%" stopColor="#38bdf8" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#34d399" stopOpacity="0.85" />
        </linearGradient>
      </defs>
      {/* Background guide grid */}
      <g stroke="rgba(255,255,255,0.06)" strokeWidth="1">
        <line x1="16" y1="36" x2="344" y2="36" strokeDasharray="3 4" />
        <line x1="16" y1="74" x2="344" y2="74" strokeDasharray="3 4" />
        <line x1="16" y1="112" x2="344" y2="112" strokeDasharray="3 4" />
      </g>
      {/* Connecting vectors */}
      <path d="M 96 48 L 136 74" stroke="#a39cff" strokeOpacity="0.55" strokeWidth="1.5" fill="none" />
      <path d="M 96 102 L 136 74" stroke="#38bdf8" strokeOpacity="0.55" strokeWidth="1.5" fill="none" />
      <path d="M 224 74 L 262 74" stroke="url(#bl-k-grad)" strokeWidth="2" fill="none" />
      <circle cx="243" cy="74" r="3" fill="#34d399" />

      {/* Left Source Nodes */}
      <g className="lv-mockup-node">
        <rect x="14" y="28" width="84" height="36" rx="8" fill="#17171f" stroke="rgba(163,156,255,0.45)" />
        <circle cx="28" cy="46" r="5" fill="rgba(163,156,255,0.2)" stroke="#a39cff" strokeWidth="1.3" />
        <text x="40" y="44" fill="#f4f3ef" fontSize="9" fontWeight="700" fontFamily="monospace">RULES</text>
        <text x="40" y="55" fill="#9a98a6" fontSize="7.5" fontFamily="monospace">Page-cited</text>
      </g>
      <g className="lv-mockup-node">
        <rect x="14" y="84" width="84" height="36" rx="8" fill="#17171f" stroke="rgba(56,189,248,0.45)" />
        <circle cx="28" cy="102" r="5" fill="rgba(56,189,248,0.2)" stroke="#38bdf8" strokeWidth="1.3" />
        <text x="40" y="100" fill="#f4f3ef" fontSize="9" fontWeight="700" fontFamily="monospace">FACTS</text>
        <text x="40" y="111" fill="#9a98a6" fontSize="7.5" fontFamily="monospace">Passports</text>
      </g>

      {/* Center Core Engine */}
      <g className="lv-mockup-node">
        <rect x="136" y="42" width="88" height="64" rx="10" fill="#1c1c28" stroke="url(#bl-k-grad)" strokeWidth="1.4" />
        <rect x="146" y="52" width="68" height="10" rx="3" fill="rgba(163,156,255,0.16)" />
        <text x="180" y="60" textAnchor="middle" fill="#a39cff" fontSize="7.5" fontWeight="700" fontFamily="monospace">OCR + CLAIM</text>
        <rect x="146" y="69" width="68" height="9" rx="3" fill="rgba(255,255,255,0.06)" />
        <rect x="146" y="69" width="52" height="9" rx="3" fill="#38bdf8" fillOpacity="0.6" />
        <rect x="146" y="84" width="68" height="12" rx="4" fill="rgba(52,211,153,0.14)" stroke="rgba(52,211,153,0.4)" />
        <text x="180" y="93" textAnchor="middle" fill="#34d399" fontSize="7.5" fontWeight="700" fontFamily="monospace">5D VERIFY</text>
      </g>

      {/* Right Sign-off Gate */}
      <g className="lv-mockup-node">
        <rect x="262" y="48" width="84" height="52" rx="10" fill="#13221d" stroke="rgba(52,211,153,0.55)" />
        <path d="M 277 65 L 281 69 L 288 61" stroke="#34d399" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <text x="295" y="67" fill="#f4f3ef" fontSize="9" fontWeight="700" fontFamily="monospace">GATE PASS</text>
        <text x="275" y="83" fill="#9a98a6" fontSize="7.5" fontFamily="monospace">Four-Eyes Ready</text>
        <rect x="275" y="88" width="58" height="3" rx="1.5" fill="#34d399" />
      </g>
    </svg>
  );
}

function DraftReviewIllustration() {
  return (
    <svg viewBox="0 0 360 148" className="w-full h-auto" aria-hidden="true">
      {/* Left: Annotated draft canvas */}
      <g className="lv-mockup-node">
        <rect x="12" y="14" width="194" height="120" rx="10" fill="#15151d" stroke="rgba(255,255,255,0.12)" />
        <rect x="24" y="26" width="84" height="6" rx="3" fill="rgba(255,255,255,0.22)" />
        {/* Flagged claim line */}
        <rect x="24" y="44" width="166" height="8" rx="3" fill="rgba(255,255,255,0.08)" />
        <rect x="24" y="44" width="96" height="8" rx="3" fill="rgba(255,107,107,0.25)" />
        <line x1="24" y1="54" x2="120" y2="54" stroke="#ff6b6b" strokeWidth="1.6" strokeDasharray="2 2" />
        {/* Clean sentence */}
        <rect x="24" y="66" width="150" height="7" rx="3" fill="rgba(255,255,255,0.09)" />
        {/* Verified proof line */}
        <rect x="24" y="84" width="164" height="8" rx="3" fill="rgba(52,211,153,0.18)" />
        <line x1="24" y1="94" x2="132" y2="94" stroke="#34d399" strokeWidth="1.6" />
        {/* Bottom badges */}
        <rect x="24" y="108" width="66" height="16" rx="4" fill="rgba(255,107,107,0.16)" stroke="rgba(255,107,107,0.45)" />
        <text x="57" y="119" textAnchor="middle" fill="#ff8f8f" fontSize="7.5" fontWeight="700" fontFamily="monospace">1 BLOCKING</text>
        <rect x="96" y="108" width="66" height="16" rx="4" fill="rgba(52,211,153,0.14)" stroke="rgba(52,211,153,0.45)" />
        <text x="129" y="119" textAnchor="middle" fill="#34d399" fontSize="7.5" fontWeight="700" fontFamily="monospace">2 VERIFIED</text>
      </g>

      {/* Connector */}
      <path d="M 206 74 L 224 74" stroke="#a39cff" strokeWidth="1.5" strokeDasharray="3 2" />

      {/* Right: 5D Proof Matrix */}
      <g className="lv-mockup-node">
        <rect x="224" y="14" width="124" height="120" rx="10" fill="#181824" stroke="rgba(163,156,255,0.38)" />
        <text x="236" y="31" fill="#a39cff" fontSize="8" fontWeight="700" fontFamily="monospace">5D PROOF ALIGN</text>
        {[
          { label: "Claim", w: 62, c: "#34d399", y: 44 },
          { label: "Source", w: 62, c: "#34d399", y: 61 },
          { label: "Expiry", w: 62, c: "#34d399", y: 78 },
          { label: "Channel", w: 34, c: "#f5b841", y: 95 },
          { label: "Scope", w: 22, c: "#ff6b6b", y: 112 },
        ].map(row => (
          <g key={row.label}>
            <text x="236" y={row.y + 6} fill="#9a98a6" fontSize="7.5" fontFamily="monospace">{row.label}</text>
            <rect x="274" y={row.y} width="62" height="7" rx="3.5" fill="rgba(255,255,255,0.06)" />
            <rect x="274" y={row.y} width={row.w} height="7" rx="3.5" fill={row.c} fillOpacity="0.8" />
          </g>
        ))}
      </g>
    </svg>
  );
}

function EvidenceVaultIllustration() {
  return (
    <svg viewBox="0 0 360 148" className="w-full h-auto" aria-hidden="true">
      {/* Left: Passport document stack */}
      <g className="lv-mockup-node">
        <rect x="14" y="20" width="150" height="108" rx="10" fill="#15151d" stroke="rgba(56,189,248,0.4)" />
        <rect x="26" y="33" width="60" height="14" rx="4" fill="rgba(56,189,248,0.16)" stroke="rgba(56,189,248,0.4)" />
        <text x="56" y="43" textAnchor="middle" fill="#38bdf8" fontSize="7.5" fontWeight="700" fontFamily="monospace">LAB p.14</text>
        <text x="94" y="43" fill="#f4f3ef" fontSize="8" fontWeight="700" fontFamily="monospace">PASS-08</text>
        <rect x="26" y="57" width="124" height="6" rx="3" fill="rgba(255,255,255,0.16)" />
        <rect x="26" y="70" width="102" height="6" rx="3" fill="rgba(255,255,255,0.09)" />
        {/* Validity Timeline bar */}
        <text x="26" y="96" fill="#9a98a6" fontSize="7" fontFamily="monospace">VALIDITY WINDOW</text>
        <rect x="26" y="103" width="124" height="7" rx="3.5" fill="rgba(255,255,255,0.08)" />
        <rect x="26" y="103" width="88" height="7" rx="3.5" fill="#34d399" />
        <rect x="114" y="103" width="22" height="7" rx="3.5" fill="#f5b841" />
      </g>

      {/* Signal link */}
      <path d="M 164 74 L 194 74" stroke="#f5b841" strokeWidth="1.6" strokeDasharray="3 3" />

      {/* Right: Radar recall monitor */}
      <g className="lv-mockup-node">
        <rect x="194" y="20" width="152" height="108" rx="10" fill="#19161c" stroke="rgba(255,107,107,0.42)" />
        <circle cx="242" cy="74" r="34" fill="none" stroke="rgba(255,107,107,0.22)" strokeWidth="1" />
        <circle cx="242" cy="74" r="22" fill="none" stroke="rgba(255,107,107,0.32)" strokeWidth="1" />
        <circle cx="242" cy="74" r="10" fill="rgba(255,107,107,0.22)" stroke="#ff6b6b" strokeWidth="1.2" />
        <line x1="242" y1="74" x2="265" y2="50" stroke="#ff6b6b" strokeWidth="1.6" />
        <circle cx="265" cy="50" r="3.5" fill="#ff6b6b" />
        <text x="288" y="60" fill="#ff8f8f" fontSize="8.5" fontWeight="700" fontFamily="monospace">RECALL</text>
        <text x="288" y="73" fill="#f4f3ef" fontSize="8" fontFamily="monospace">1 Flagged</text>
        <rect x="288" y="83" width="46" height="14" rx="4" fill="rgba(255,107,107,0.16)" stroke="rgba(255,107,107,0.45)" />
        <text x="311" y="93" textAnchor="middle" fill="#ff8f8f" fontSize="7" fontWeight="700" fontFamily="monospace">PAUSE</text>
      </g>
    </svg>
  );
}

function ReviewQueueIllustration() {
  const nodes = [
    { x: 14, label: "WRITER", sub: "Locked", c: "#ff6b6b" },
    { x: 102, label: "REVIEWER", sub: "Tier 1", c: "#a39cff" },
    { x: 190, label: "SENIOR", sub: "Legal/Med", c: "#f5b841" },
    { x: 278, label: "PUBLISH", sub: "Signed", c: "#34d399" },
  ];
  return (
    <svg viewBox="0 0 360 148" className="w-full h-auto" aria-hidden="true">
      {/* Rail line */}
      <line x1="50" y1="62" x2="314" y2="62" stroke="rgba(255,255,255,0.14)" strokeWidth="2" />
      <line x1="138" y1="62" x2="314" y2="62" stroke="#34d399" strokeOpacity="0.45" strokeWidth="2" />
      {nodes.map((n, i) => (
        <g key={n.label} className="lv-mockup-node">
          <rect
            x={n.x}
            y="30"
            width="68"
            height="64"
            rx="10"
            fill="#16161f"
            stroke={n.c}
            strokeOpacity={i === 0 ? 0.45 : 0.65}
          />
          <circle cx={n.x + 34} cy="48" r="8" fill={n.c} fillOpacity="0.18" stroke={n.c} strokeWidth="1.3" />
          <text x={n.x + 34} y="51" textAnchor="middle" fill={n.c} fontSize="8" fontWeight="700" fontFamily="monospace">
            {i + 1}
          </text>
          <text x={n.x + 34} y="70" textAnchor="middle" fill="#f4f3ef" fontSize="8" fontWeight="700" fontFamily="monospace">
            {n.label}
          </text>
          <text x={n.x + 34} y="82" textAnchor="middle" fill="#9a98a6" fontSize="7" fontFamily="monospace">
            {n.sub}
          </text>
        </g>
      ))}
      {/* Bottom SoD Lock Strip */}
      <rect x="14" y="108" width="332" height="24" rx="7" fill="rgba(52,211,153,0.08)" stroke="rgba(52,211,153,0.3)" />
      <text x="180" y="123" textAnchor="middle" fill="#34d399" fontSize="8" fontWeight="700" fontFamily="monospace">
        SELF-APPROVAL BLOCKED · REVISION HASH PRESERVED
      </text>
    </svg>
  );
}

function GuidelineHealthIllustration() {
  const dots = [
    { cx: 52, cy: 92, r: 4, c: "#ff6b6b" },
    { cx: 88, cy: 76, r: 4, c: "#f5b841" },
    { cx: 124, cy: 52, r: 4.5, c: "#a39cff" },
    { cx: 162, cy: 38, r: 5, c: "#34d399" },
  ];
  return (
    <svg viewBox="0 0 360 148" className="w-full h-auto" aria-hidden="true">
      {/* Left: Calibration trend chart */}
      <g className="lv-mockup-node">
        <rect x="12" y="14" width="184" height="120" rx="10" fill="#15151d" stroke="rgba(163,156,255,0.36)" />
        <text x="24" y="30" fill="#9a98a6" fontSize="7.5" fontWeight="700" fontFamily="monospace">AGREEMENT CURVE</text>
        <line x1="28" y1="108" x2="180" y2="108" stroke="rgba(255,255,255,0.12)" />
        <line x1="28" y1="42" x2="28" y2="108" stroke="rgba(255,255,255,0.12)" />
        <polyline
          points="52,92 88,76 124,52 162,38"
          fill="none"
          stroke="#a39cff"
          strokeWidth="2"
        />
        {dots.map((d, idx) => (
          <circle key={idx} cx={d.cx} cy={d.cy} r={d.r} fill={d.c} stroke="#0f0f14" strokeWidth="1.5" />
        ))}
        <text x="162" y="29" textAnchor="end" fill="#34d399" fontSize="8" fontWeight="700" fontFamily="monospace">96% AGREE</text>
      </g>

      {/* Right: Sandbox Simulation Card */}
      <g className="lv-mockup-node">
        <rect x="208" y="14" width="140" height="120" rx="10" fill="#181824" stroke="rgba(52,211,153,0.4)" />
        <text x="220" y="31" fill="#34d399" fontSize="8" fontWeight="700" fontFamily="monospace">SANDBOX vNext</text>
        <rect x="220" y="44" width="116" height="22" rx="5" fill="rgba(255,255,255,0.04)" />
        <text x="228" y="58" fill="#9a98a6" fontSize="7.5" fontFamily="monospace">Dismissals</text>
        <text x="328" y="58" textAnchor="end" fill="#34d399" fontSize="8" fontWeight="700" fontFamily="monospace">-34%</text>
        <rect x="220" y="72" width="116" height="22" rx="5" fill="rgba(255,255,255,0.04)" />
        <text x="228" y="86" fill="#9a98a6" fontSize="7.5" fontFamily="monospace">Channels</text>
        <text x="328" y="86" textAnchor="end" fill="#a39cff" fontSize="8" fontWeight="700" fontFamily="monospace">+WEB</text>
        <rect x="220" y="102" width="116" height="20" rx="5" fill="rgba(52,211,153,0.16)" stroke="rgba(52,211,153,0.45)" />
        <text x="278" y="115" textAnchor="middle" fill="#34d399" fontSize="7.5" fontWeight="700" fontFamily="monospace">SAFE TO PUBLISH</text>
      </g>
    </svg>
  );
}

function BrandLibraryIllustration() {
  return (
    <svg viewBox="0 0 360 148" className="w-full h-auto" aria-hidden="true">
      {/* Left: PDF Policy Input */}
      <g className="lv-mockup-node">
        <rect x="12" y="24" width="84" height="100" rx="9" fill="#15151d" stroke="rgba(255,255,255,0.18)" />
        <rect x="22" y="36" width="38" height="12" rx="3" fill="rgba(163,156,255,0.2)" />
        <text x="41" y="45" textAnchor="middle" fill="#a39cff" fontSize="7" fontWeight="700" fontFamily="monospace">PDF v4</text>
        <rect x="22" y="58" width="64" height="5" rx="2.5" fill="rgba(255,255,255,0.16)" />
        <rect x="22" y="69" width="52" height="5" rx="2.5" fill="rgba(255,255,255,0.1)" />
        <rect x="22" y="80" width="58" height="5" rx="2.5" fill="rgba(255,255,255,0.1)" />
        <rect x="22" y="96" width="64" height="16" rx="4" fill="rgba(245,184,65,0.14)" stroke="rgba(245,184,65,0.45)" />
        <text x="54" y="107" textAnchor="middle" fill="#f5b841" fontSize="7" fontWeight="700" fontFamily="monospace">SANITIZED</text>
      </g>

      <path d="M 96 74 L 122 74" stroke="#a39cff" strokeWidth="1.6" />

      {/* Center: Guard Shield */}
      <g className="lv-mockup-node">
        <rect x="122" y="34" width="96" height="80" rx="10" fill="#191926" stroke="rgba(163,156,255,0.45)" />
        <text x="170" y="54" textAnchor="middle" fill="#a39cff" fontSize="8" fontWeight="700" fontFamily="monospace">UNTRUSTED GUARD</text>
        <rect x="134" y="64" width="72" height="16" rx="4" fill="rgba(56,189,248,0.14)" />
        <text x="170" y="75" textAnchor="middle" fill="#38bdf8" fontSize="7" fontWeight="700" fontFamily="monospace">STRIP INJECTION</text>
        <rect x="134" y="86" width="72" height="16" rx="4" fill="rgba(255,255,255,0.06)" />
        <text x="170" y="97" textAnchor="middle" fill="#f4f3ef" fontSize="7" fontWeight="700" fontFamily="monospace">EXTRACT CLAUSES</text>
      </g>

      <path d="M 218 74 L 244 74" stroke="#34d399" strokeWidth="1.6" />

      {/* Right: Rulebook cards */}
      <g className="lv-mockup-node">
        <rect x="244" y="24" width="104" height="100" rx="9" fill="#13201b" stroke="rgba(52,211,153,0.48)" />
        <text x="256" y="42" fill="#34d399" fontSize="8" fontWeight="700" fontFamily="monospace">ACTIVE RULES</text>
        {[
          { label: "Disclaimer", tag: "p.12", y: 52 },
          { label: "No Cure Claim", tag: "p.04", y: 74 },
          { label: "Tone: Warm", tag: "p.09", y: 96 },
        ].map(r => (
          <g key={r.label}>
            <rect x="254" y={r.y} width="84" height="16" rx="4" fill="rgba(255,255,255,0.05)" />
            <text x="260" y={r.y + 11} fill="#f4f3ef" fontSize="7" fontFamily="monospace">{r.label}</text>
            <text x="332" y={r.y + 11} textAnchor="end" fill="#34d399" fontSize="7" fontFamily="monospace">{r.tag}</text>
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
 * Consistent dark-carbon product mockup card used once per primary section.
 * Features vector diagrams (no stock photos) and subtle entrance + hover motion.
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
      {/* Window top bar */}
      <div className="flex items-center justify-between gap-2 border-b border-line/80 bg-white/[0.02] px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1" aria-hidden="true">
            <span className="size-2 rounded-full bg-coral/70" />
            <span className="size-2 rounded-full bg-amber/70" />
            <span className="size-2 rounded-full bg-mint/70" />
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

      {/* Vector product diagram */}
      <div className="px-3 py-3">
        <div className="mb-2 flex items-center justify-between px-1">
          <span className="font-display text-sm font-bold uppercase tracking-tight text-bone">
            {meta.title}
          </span>
          <span className="font-mono text-[10px] text-ash">interactive preview</span>
        </div>
        <Illustration />
      </div>

      {/* Compact status footer */}
      <div className="flex items-center justify-between gap-2 border-t border-line/70 bg-carbon/60 px-4 py-2 font-mono text-[10px] text-ash">
        <span>{meta.footerLeft}</span>
        <span className="text-bone/80">{meta.footerRight}</span>
      </div>
    </div>
  );
});
