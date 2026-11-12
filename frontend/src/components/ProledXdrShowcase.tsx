import React, { useState } from "react";
import { Badge, Button, Icon } from "./ui";

interface Props {
  onTryChecker?: () => void;
  onOpenVault?: () => void;
}

interface StackLayer {
  id: number;
  code: string;
  name: string;
  subtitle: string;
  metric: string;
  metricLabel: string;
  color: string;
  borderGlow: string;
  bgTint: string;
  description: string;
  specs: string[];
}

const TANDEM_LAYERS: StackLayer[] = [
  {
    id: 1,
    code: "LAYER 01 · NANO-TEXTURE SHIELD",
    name: "Anti-Injection Sanitizer Glass",
    subtitle: "Scatters untrusted instructions & prompt glare at ingestion",
    metric: "0.0%",
    metricLabel: "Prompt injection bleed",
    color: "#a5b4fc",
    borderGlow: "rgba(165, 180, 252, 0.65)",
    bgTint: "linear-gradient(135deg, rgba(129,140,248,0.22) 0%, rgba(20,22,37,0.82) 100%)",
    description:
      "Like nano-texture glass etched at the nanometer scale to scatter ambient glare, BrandLint's outermost ingestion layer strips embedded system prompts and adversarial instructions from uploaded PDFs and drafts before analysis begins.",
    specs: ["Untrusted PDF isolation", "Instruction flag quarantine", "UTF-8 character offset map"],
  },
  {
    id: 2,
    code: "LAYER 02 · ON-CELL TOUCH",
    name: "Multi-Touch Claim & Metric Sensor",
    subtitle: "Sub-pixel detection of numbers, superlatives, and guarantees",
    metric: "100%",
    metricLabel: "Verbatim span accuracy",
    color: "#38bdf8",
    borderGlow: "rgba(56, 189, 248, 0.65)",
    bgTint: "linear-gradient(135deg, rgba(56,189,248,0.20) 0%, rgba(20,22,37,0.85) 100%)",
    description:
      "Integrated directly into the draft surface, the claim sensor locates every percentage, timeframe, guarantee, and product name—pinning exact start/end character coordinates so you can click any underlined span to inspect it.",
    specs: ["Exact [start, end] offsets", "Protected CTA & number lock", "Zero paraphrased quotes"],
  },
  {
    id: 3,
    code: "LAYER 03 · TANDEM EMISSIVE CORE",
    name: "Dual-Stack Rules + Evidence Engine",
    subtitle: "Two verification layers firing in tandem for extreme precision",
    metric: "2×",
    metricLabel: "Tandem verification planes",
    color: "#6366f1",
    borderGlow: "rgba(99, 102, 241, 0.85)",
    bgTint: "linear-gradient(135deg, rgba(99,102,241,0.34) 0%, rgba(168,85,247,0.18) 55%, rgba(15,17,28,0.9) 100%)",
    description:
      "Inspired by PROLED XDR tandem display architecture, two self-illuminating verification planes operate in parallel: Plane A enforces versioned Brand Rules while Plane B cross-examines every claim against Approved Evidence Passports.",
    specs: ["Plane A: Versioned Rulebook", "Plane B: Evidence Passports (EV-1..4)", "Pinned PDF page & expiry window"],
  },
  {
    id: 4,
    code: "LAYER 04 · LOCAL DIMMING MATRIX",
    name: "5-Dimensional Alignment Array",
    subtitle: "Pixel-level verification across all 5 factual dimensions",
    metric: "5 / 5",
    metricLabel: "Required alignment axes",
    color: "#4ade80",
    borderGlow: "rgba(74, 222, 128, 0.65)",
    bgTint: "linear-gradient(135deg, rgba(74,222,128,0.20) 0%, rgba(20,22,37,0.86) 100%)",
    description:
      "A matching number is never enough—'40% lower cost' does not prove '40% lower downtime.' Every claim is independently dimmed and checked across Product, Metric, Population, Timeframe, and Qualifiers.",
    specs: ["Product & Metric match", "Population & Timeframe lock", "Protected term confirmation"],
  },
  {
    id: 5,
    code: "LAYER 05 · OXIDE BACKPLANE",
    name: "Immutable Audit & Four-Eyes Gate",
    subtitle: "Hardware-grade sign-off separation and recall circuit",
    metric: "4-Eyes",
    metricLabel: "Independent human sign-off",
    color: "#fbbf24",
    borderGlow: "rgba(251, 191, 36, 0.65)",
    bgTint: "linear-gradient(135deg, rgba(251,191,36,0.20) 0%, rgba(20,22,37,0.90) 100%)",
    description:
      "The structural backplane locks every check, override rationale, and approval to a cryptographic revision history. Authors cannot approve their own drafts, and expired evidence automatically triggers a revalidation recall.",
    specs: ["Self-approval hardware block", "Senior Reviewer escalation route", "Automated expiry recall"],
  },
];

const REFERENCE_MODES = [
  {
    id: "launch",
    name: "Launch Email · Standard Route",
    gamut: "Intent-Preserving Diffs · Strict Claim Proof",
    refresh: "Real-time check",
    sampleCopy:
      "Introducing LuminaFlow, built for operations teams. Our platform guarantees 40% higher productivity. Start your free trial today!",
    rewrittenCopy:
      "Introducing Lumina Flow, built for operations teams. Teams using Lumina Flow reported 18% higher task throughput after 90 days (EV-1, p.2). Start your free trial today!",
    channelVerdict: "2 Must-Fix Blockers · Expired EV-4 Passport & Prohibited Guarantee",
    dimensions: [
      { name: "Product", draft: "LuminaFlow (unspaced)", source: "Lumina Flow (TERM-01@1)", status: "mismatch" },
      { name: "Metric", draft: "40% higher productivity", source: "18% higher task throughput (EV-1)", status: "mismatch" },
      { name: "Population", draft: "Operations teams", source: "Enterprise operations teams (n=42)", status: "supported" },
      { name: "Timeframe", draft: "Unstated (expired 2023 pilot)", source: "After 90 days (2025 Study)", status: "mismatch" },
      { name: "Qualifiers", draft: "“guarantees” (prohibited)", source: "“reported” · CTA preserved", status: "mismatch" },
    ],
  },
  {
    id: "social",
    name: "Instagram · Channel Condition",
    gamut: "Casual Greeting Exempt · Claim Proof Enforced",
    refresh: "TONE-01@2 Active",
    sampleCopy:
      "Hey builders! Lumina Flow cuts deployment downtime by 40% overnight with 100% risk-free setup.",
    rewrittenCopy:
      "Hey builders! Lumina Flow reduces data-pipeline downtime by 40% across Q4 enterprise deployments (EV-2, p.4).",
    channelVerdict: "2 Claim Blockers · Casual greeting allowed on Instagram via TONE-01@2",
    dimensions: [
      { name: "Product", draft: "Lumina Flow", source: "Lumina Flow", status: "supported" },
      { name: "Metric", draft: "40% lower downtime", source: "40% lower pipeline downtime (EV-2)", status: "supported" },
      { name: "Population", draft: "General builders", source: "Q4 enterprise cohort", status: "mismatch" },
      { name: "Timeframe", draft: "Overnight", source: "90-day rollout window", status: "mismatch" },
      { name: "Qualifiers", draft: "100% risk-free (banned)", source: "Verified SLA configuration", status: "mismatch" },
    ],
  },
  {
    id: "investor",
    name: "Investor Update · Senior Route",
    gamut: "Formal Voice · Senior Reviewer Sign-Off",
    refresh: "Senior escalation",
    sampleCopy:
      "Lumina Flow is certified for use in every country and reduces cloud spend by 40% for every customer.",
    rewrittenCopy:
      "Lumina Flow is SOC 2 Type II certified (EV-3, p.1) and reduces pipeline downtime by 40% for enterprise customers.",
    channelVerdict: "2 Senior Escalations · Compliance & Metric Misalignment",
    dimensions: [
      { name: "Product", draft: "Lumina Flow", source: "Lumina Flow", status: "supported" },
      { name: "Metric", draft: "40% lower cloud spend", source: "40% lower downtime (not spend)", status: "mismatch" },
      { name: "Population", draft: "Every customer / every country", source: "SOC 2 Type II scope (EV-3)", status: "mismatch" },
      { name: "Timeframe", draft: "Current", source: "Valid through 2027", status: "supported" },
      { name: "Qualifiers", draft: "Universal certification", source: "SOC 2 Type II audited", status: "mismatch" },
    ],
  },
];

export const ProledXdrShowcase: React.FC<Props> = ({ onTryChecker, onOpenVault }) => {
  const [activeTab, setActiveTab] = useState<"tandem" | "curtain" | "touch">("tandem");
  const [selectedLayerId, setSelectedLayerId] = useState<number>(3);
  const [explosionPct, setExplosionPct] = useState<number>(78);
  const [curtainPos, setCurtainPos] = useState<number>(50);
  const [islandExpanded, setIslandExpanded] = useState<boolean>(false);
  const [activeModeIdx, setActiveModeIdx] = useState<number>(0);
  const [touchApplied, setTouchApplied] = useState<boolean>(false);

  const activeLayer = TANDEM_LAYERS.find(l => l.id === selectedLayerId) || TANDEM_LAYERS[2];
  const activeMode = REFERENCE_MODES[activeModeIdx] || REFERENCE_MODES[0];

  return (
    <section
      aria-labelledby="brandlint-xdr-heading"
      className="relative overflow-hidden rounded-2xl border border-line bg-[#06070c] p-6 sm:p-10 text-bone shadow-2xl"
    >
      {/* Subtle Apple XDR radial backlight aura */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 75% 45% at 50% 12%, rgba(99, 102, 241, 0.18), rgba(56, 189, 248, 0.06) 45%, transparent 75%)",
        }}
      />

      <div className="relative">
        {/* Section Header — Apple ProLED XDR Display architecture tailored to BrandLint */}
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-iris/30 bg-iris/10 px-3.5 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-iris">
            <span className="size-1.5 rounded-full bg-iris animate-pulse" />
            BrandLint XDR · Tandem Verification Architecture
          </div>
          <h2
            id="brandlint-xdr-heading"
            className="mt-4 font-display text-3xl font-bold tracking-tight text-bone sm:text-5xl"
          >
            Extreme Dynamic Range.{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage: "linear-gradient(95deg, #ffffff 0%, #a5b4fc 48%, #38bdf8 100%)",
              }}
            >
              For every claim your team ships.
            </span>
          </h2>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <Badge tone="accent"><Icon name="book" size={12} /> Versioned Brand Rules</Badge>
            <Icon name="plus" size={12} className="text-ash" />
            <Badge tone="success"><Icon name="shield" size={12} /> Pinned Evidence Passports</Badge>
            <Icon name="arrow" size={12} className="text-ash" />
            <Badge tone="neutral"><Icon name="lock" size={12} /> Zero Unbacked Claims</Badge>
          </div>

          {/* Interactive Mode Switcher Pill Bar */}
          <div
            role="tablist"
            aria-label="BrandLint XDR architecture views"
            className="mt-6 inline-flex flex-wrap items-center justify-center gap-1 rounded-full border border-white/15 bg-[#10121d]/90 p-1.5 backdrop-blur-xl shadow-xl"
          >
            {[
              { id: "tandem" as const, label: "01 · Tandem 5-Layer Stack", tag: "3D Exploded" },
              { id: "curtain" as const, label: "02 · Raw Draft vs. Verified XDR", tag: "Compare Slider" },
              { id: "touch" as const, label: "03 · Multi-Touch 5D Inspector", tag: "Channel Modes" },
            ].map(t => {
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveTab(t.id)}
                  className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium transition-all ${
                    active
                      ? "bg-bone text-carbon font-semibold shadow-[0_0_25px_rgba(129,140,248,0.45)]"
                      : "text-ash hover:text-bone"
                  }`}
                >
                  <span>{t.label}</span>
                  <span
                    className={`hidden sm:inline-block rounded-full px-2 py-0.5 font-mono text-[10px] ${
                      active ? "bg-carbon/15 text-carbon" : "bg-white/5 text-ash"
                    }`}
                  >
                    {t.tag}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ProLED XDR Display Hardware Frame */}
        <div className="mt-8">
          <div className="relative mx-auto overflow-hidden rounded-[22px] border border-white/15 bg-[#070810] shadow-[0_25px_80px_-20px_rgba(0,0,0,0.9),0_0_50px_-15px_rgba(99,102,241,0.25)]">
            {/* Top Bezel with Interactive Dynamic Island */}
            <div className="relative flex items-center justify-between border-b border-white/10 bg-[#05060b] px-5 py-3">
              <div className="flex items-center gap-2 font-mono text-[11px] text-ash">
                <span className="size-2.5 rounded-full bg-blocking/80" />
                <span className="size-2.5 rounded-full bg-major/80" />
                <span className="size-2.5 rounded-full bg-ok/80" />
                <span className="ml-2 hidden sm:inline text-ash/80">
                  BRANDLINT STUDIO · TANDEM VERIFICATION ENGINE
                </span>
              </div>

              {/* Dynamic Island Live Activity Pill */}
              <button
                type="button"
                onClick={() => setIslandExpanded(v => !v)}
                aria-expanded={islandExpanded}
                title="Click to expand Live Verification Island"
                className={`group relative flex items-center gap-3 rounded-full border border-white/15 bg-black px-4 py-1.5 text-xs transition-all duration-300 hover:border-iris/60 ${
                  islandExpanded ? "px-6 py-2 shadow-[0_0_30px_rgba(99,102,241,0.45)]" : ""
                }`}
              >
                <span className="relative flex size-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-ok" />
                </span>
                <span className="font-mono text-[11px] font-medium text-bone">
                  {activeTab === "tandem"
                    ? `Tandem Stack · ${explosionPct}% Exploded`
                    : activeTab === "curtain"
                    ? `XDR Split View · ${curtainPos}%`
                    : `Channel Mode · ${activeMode.name.split("·")[0].trim()}`}
                </span>
                {islandExpanded && (
                  <span className="hidden md:inline-flex items-center gap-2 border-l border-white/15 pl-3 font-mono text-[10px] text-iris">
                    <span>100% Verbatim Citations</span>
                    <span>·</span>
                    <span>Four-Eyes Gate Active</span>
                  </span>
                )}
              </button>

              <div className="flex items-center gap-3 font-mono text-[11px] text-ash">
                <span className="hidden md:inline text-ok">● Evidence Lock</span>
                <span className="rounded border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-bone">
                  120Hz
                </span>
              </div>
            </div>

            {/* =====================================================================
                TAB 1: 3D EXPLODED TANDEM 5-LAYER STACK
               ===================================================================== */}
            {activeTab === "tandem" && (
              <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-12 lg:items-center guides-dark">
                {/* Left 7 Cols: Interactive 3D Isometric Stack */}
                <div className="lg:col-span-7">
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
                    <div>
                      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-iris">
                        Interactive 3D Stack · Click any layer
                      </span>
                      <h3 className="font-display text-xl font-semibold text-bone">
                        5-Layer Tandem Verification Pipeline
                      </h3>
                    </div>
                    <div className="flex flex-wrap items-center gap-2.5 rounded-full border border-white/15 bg-[#0c0e18] px-3.5 py-1.5 shadow-inner">
                      <label
                        htmlFor="explosion-slider"
                        className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-ash"
                      >
                        Explode layers
                      </label>
                      <div className="hidden sm:flex items-center gap-1 border-r border-white/10 pr-2">
                        {[
                          { label: "Stack", val: 20 },
                          { label: "Iso", val: 65 },
                          { label: "Max", val: 100 },
                        ].map(preset => (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => setExplosionPct(preset.val)}
                            className={`rounded-full px-2 py-0.5 font-mono text-[10px] transition ${
                              Math.abs(explosionPct - preset.val) <= 8
                                ? "bg-iris/25 text-iris border border-iris/50"
                                : "text-ash hover:text-bone"
                            }`}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                      <div className="relative flex w-28 items-center">
                        <input
                          id="explosion-slider"
                          type="range"
                          min={15}
                          max={100}
                          value={explosionPct}
                          onChange={e => setExplosionPct(Number(e.target.value))}
                          style={{
                            background: `linear-gradient(90deg, #4b3fd1 0%, #a39cff ${
                              ((explosionPct - 15) / 85) * 100
                            }%, rgba(255,255,255,0.12) ${((explosionPct - 15) / 85) * 100}%)`,
                          }}
                          className="xdr-range-slider"
                        />
                      </div>
                      <span className="min-w-[42px] rounded-md border border-iris/30 bg-iris/10 px-1.5 py-0.5 text-center font-mono text-[11px] font-semibold text-bone">
                        {explosionPct}%
                      </span>
                    </div>
                  </div>

                  {/* Isometric 3D Stage */}
                  <div className="relative my-5 flex min-h-[410px] flex-col items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-[#05060b]/90 px-4 py-8">
                    {/* Vertical Laser Axis passing through all 5 layers */}
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute top-4 bottom-4 left-1/2 z-20 w-px -translate-x-1/2"
                      style={{
                        background:
                          "linear-gradient(to bottom, transparent, rgba(129,140,248,0.9) 20%, rgba(56,189,248,0.9) 50%, rgba(74,222,128,0.9) 80%, transparent)",
                        boxShadow: "0 0 16px rgba(99, 102, 241, 0.8)",
                      }}
                    />

                    <div className="relative w-full max-w-lg space-y-2">
                      {TANDEM_LAYERS.map((layer, index) => {
                        const isSelected = layer.id === selectedLayerId;
                        const gapPx = Math.round((explosionPct / 100) * 16);
                        return (
                          <button
                            key={layer.id}
                            type="button"
                            onClick={() => setSelectedLayerId(layer.id)}
                            style={{
                              marginTop: index === 0 ? 0 : `${gapPx}px`,
                              background: layer.bgTint,
                              borderColor: isSelected ? layer.color : "rgba(255,255,255,0.14)",
                              boxShadow: isSelected
                                ? `0 14px 38px -8px ${layer.borderGlow}, inset 0 1px 0 rgba(255,255,255,0.35)`
                                : "0 8px 20px -6px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.1)",
                              transform: isSelected
                                ? "perspective(900px) rotateX(14deg) scale(1.03) translateY(-2px)"
                                : "perspective(900px) rotateX(14deg) scale(0.98)",
                            }}
                            className="group relative flex w-full items-center justify-between rounded-xl border px-5 py-3.5 text-left backdrop-blur-md transition-all duration-300"
                          >
                            <div className="flex items-center gap-3.5 min-w-0">
                              <span
                                style={{ backgroundColor: layer.color }}
                                className="flex size-7 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-bold text-carbon shadow"
                              >
                                0{layer.id}
                              </span>
                              <div className="min-w-0">
                                <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-bone/75">
                                  {layer.code}
                                </div>
                                <div className="truncate font-display text-sm font-semibold text-bone sm:text-base">
                                  {layer.name}
                                </div>
                              </div>
                            </div>
                            <div className="ml-4 shrink-0 text-right">
                              <div
                                style={{ color: layer.color }}
                                className="font-display text-lg font-bold leading-none sm:text-xl"
                              >
                                {layer.metric}
                              </div>
                              <div className="mt-0.5 font-mono text-[10px] text-ash">
                                {layer.metricLabel}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Quick Layer Selector Pills */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px] text-ash">
                      <Icon name="spark" size={12} className="text-iris" />
                      <span>Draft</span>
                      <Icon name="arrow" size={11} className="opacity-60" />
                      <span>L01–L05</span>
                      <Icon name="arrow" size={11} className="opacity-60" />
                      <span className="text-ok">Gate Sign-off</span>
                    </div>
                    <div className="flex gap-1.5">
                      {TANDEM_LAYERS.map(l => (
                        <button
                          key={l.id}
                          type="button"
                          onClick={() => setSelectedLayerId(l.id)}
                          className={`rounded-lg px-2.5 py-1 font-mono text-xs transition ${
                            selectedLayerId === l.id
                              ? "bg-iris text-bone font-semibold"
                              : "bg-panel text-ash hover:text-bone border border-line"
                          }`}
                        >
                          L0{l.id}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right 5 Cols: Active Layer Engineering Readout */}
                <div className="lg:col-span-5">
                  <div className="rounded-2xl border border-white/15 bg-panel/95 p-6 sm:p-7 shadow-2xl">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        style={{ color: activeLayer.color }}
                        className="font-mono text-xs font-semibold uppercase tracking-[0.16em]"
                      >
                        {activeLayer.code}
                      </span>
                      <Badge tone="neutral">Layer {activeLayer.id} of 5</Badge>
                    </div>

                    <h4 className="mt-3 font-display text-2xl font-bold tracking-tight text-bone">
                      {activeLayer.name}
                    </h4>
                    <p className="mt-1.5 text-xs text-iris">{activeLayer.subtitle}</p>

                    <div className="my-5 flex items-baseline gap-4 border-y border-line py-4">
                      <div
                        style={{ color: activeLayer.color }}
                        className="font-display text-4xl font-extrabold leading-none"
                      >
                        {activeLayer.metric}
                      </div>
                      <div className="font-mono text-xs text-ash">
                        {activeLayer.metricLabel}
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5 rounded-xl border border-line bg-carbon/60 px-3.5 py-2.5 text-xs text-bone/90">
                      <Icon name="shield" size={15} className="mt-0.5 shrink-0 text-iris" />
                      <span className="line-clamp-2">{activeLayer.description}</span>
                    </div>

                    <div className="mt-5 space-y-2">
                      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-ash">
                        Guarantees enforced at this layer
                      </div>
                      {activeLayer.specs.map(spec => (
                        <div
                          key={spec}
                          className="flex items-center gap-2.5 rounded-lg border border-line bg-carbon/70 px-3.5 py-2 text-xs text-bone"
                        >
                          <span
                            style={{ backgroundColor: activeLayer.color }}
                            className="size-2 rounded-full shrink-0"
                          />
                          <span>{spec}</span>
                        </div>
                      ))}
                    </div>

                    {onTryChecker && (
                      <div className="mt-6 pt-4 border-t border-line flex flex-wrap gap-3">
                        <Button variant="primary" onClick={onTryChecker}>
                          Open Check content desk <Icon name="arrow" size={14} />
                        </Button>
                        {onOpenVault && (
                          <Button variant="secondary" onClick={onOpenVault}>
                            Inspect Approved facts
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* =====================================================================
                TAB 2: INTERACTIVE SPLIT-SCREEN RAW DRAFT VS. VERIFIED XDR SLIDER
               ===================================================================== */}
            {activeTab === "curtain" && (
              <div className="p-6 sm:p-8">
                <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-iris">
                      Interactive Comparison Slider · Unchecked Draft vs. BrandLint XDR
                    </span>
                    <h3 className="mt-1 font-display text-2xl font-bold text-bone">
                      Slide across the draft to compare raw claims with verified evidence.
                    </h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 rounded-full border border-white/15 bg-[#0c0e18] px-4 py-1.5 shadow-inner">
                    <button
                      type="button"
                      onClick={() => setCurtainPos(85)}
                      className="font-mono text-[11px] font-semibold text-blocking hover:underline"
                    >
                      Unchecked Draft
                    </button>
                    <div className="relative flex w-36 items-center">
                      <input
                        type="range"
                        aria-label="Comparison slider position"
                        min={10}
                        max={90}
                        value={curtainPos}
                        onChange={e => setCurtainPos(Number(e.target.value))}
                        style={{
                          background: `linear-gradient(90deg, #ff6a5c 0%, #a39cff ${curtainPos}%, #3dc48a ${curtainPos}%, #3dc48a 100%)`,
                        }}
                        className="xdr-range-slider"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setCurtainPos(15)}
                      className="font-mono text-[11px] font-semibold text-ok hover:underline"
                    >
                      BrandLint Verified
                    </button>
                  </div>
                </div>

                {/* Split-Screen Interactive Comparison Canvas */}
                <div className="relative h-[400px] w-full select-none overflow-hidden rounded-xl border border-white/15 bg-carbon">
                  {/* RIGHT LAYER (Full width underneath): BRANDLINT VERIFIED STATE */}
                  <div className="absolute inset-0 flex flex-col justify-between bg-[#080a14] p-6 sm:p-8 guides-dark">
                    <div>
                      <div className="flex items-center justify-between">
                        <Badge tone="success">✓ BrandLint Verified Revision #4 · Standard Route</Badge>
                        <span className="font-mono text-xs text-ok">0 Blockers · EV-1 Supported</span>
                      </div>

                      <div className="mt-5 rounded-xl border border-ok/30 bg-ok/[0.06] p-5">
                        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ok">
                          Intent-Preserving Rewrite · Backed by EV-1 (Customer Productivity Study 2025, p.2)
                        </div>
                        <p className="mt-2 font-display text-xl font-semibold leading-relaxed text-bone sm:text-2xl">
                          “Introducing{" "}
                          <span className="rounded bg-ok/20 px-1.5 py-0.5 text-ok">Lumina Flow</span>, built
                          for operations teams.{" "}
                          <span className="rounded bg-ok/20 px-1.5 py-0.5 text-ok">
                            Teams using Lumina Flow reported 18% higher task throughput after 90 days.
                          </span>{" "}
                          Start your free trial today!”
                        </p>
                      </div>

                      <div className="mt-5 grid grid-cols-3 gap-3">
                        {[
                          { k: "Product Term", v: "Lumina Flow (TERM-01@1 ✓)", c: "text-ok" },
                          { k: "Evidence Passport", v: "EV-1 · Current through 2026", c: "text-ok" },
                          { k: "Protected CTA", v: "“Start your free trial today!”", c: "text-iris" },
                        ].map(item => (
                          <div key={item.k} className="rounded-lg border border-white/10 bg-panel/90 p-3.5">
                            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ash">
                              {item.k}
                            </div>
                            <div className={`mt-1 font-mono text-xs font-semibold ${item.c}`}>
                              {item.v}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-white/10 pt-4 font-mono text-xs text-ash">
                      <span>Citation Validity: 100% Verbatim</span>
                      <span className="text-ok">Ready for independent Reviewer sign-off ✓</span>
                    </div>
                  </div>

                  {/* LEFT LAYER (Clipped by curtainPos): UNCHECKED DRAFT STATE */}
                  <div
                    className="absolute inset-0 flex flex-col justify-between bg-[#161118] p-6 sm:p-8"
                    style={{ clipPath: `inset(0 ${100 - curtainPos}% 0 0)` }}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <Badge tone="danger">✕ Raw Unchecked Draft · Approval Blocked (409)</Badge>
                        <span className="font-mono text-xs text-blocking">3 Issues Flagged</span>
                      </div>

                      <div className="mt-5 rounded-xl border border-blocking/40 bg-blocking/[0.08] p-5">
                        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-blocking">
                          Unverified Launch Email · Cites Expired 2023 Pilot Memo (EV-4)
                        </div>
                        <p className="mt-2 font-display text-xl font-semibold leading-relaxed text-bone sm:text-2xl">
                          “Introducing{" "}
                          <span className="rounded bg-major/25 px-1.5 py-0.5 text-major underline decoration-wavy">
                            LuminaFlow
                          </span>
                          , built for operations teams. Our platform{" "}
                          <span className="rounded bg-blocking/25 px-1.5 py-0.5 text-blocking line-through">
                            guarantees 40% higher productivity.
                          </span>{" "}
                          Start your free trial today!”
                        </p>
                      </div>

                      <div className="mt-5 grid grid-cols-3 gap-3">
                        {[
                          { k: "TERM-01@1", v: "“LuminaFlow” missing space", c: "text-major" },
                          { k: "CLAIM-01@1", v: "“guarantees” is prohibited", c: "text-blocking" },
                          { k: "CLAIM-03@1", v: "EV-4 expired 120 days ago", c: "text-blocking" },
                        ].map(item => (
                          <div key={item.k} className="rounded-lg border border-blocking/25 bg-black/50 p-3.5">
                            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ash">
                              {item.k}
                            </div>
                            <div className={`mt-1 font-mono text-xs font-semibold ${item.c}`}>
                              {item.v}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-white/10 pt-4 font-mono text-xs text-blocking">
                      <span>Gate Status: 409 approval_blocked / claim_expired</span>
                      <span>Drag slider left to apply BrandLint fixes →</span>
                    </div>
                  </div>

                  {/* Vertical Draggable Divider Handle */}
                  <div
                    style={{ left: `${curtainPos}%` }}
                    className="pointer-events-none absolute top-0 bottom-0 z-30 w-0.5 -translate-x-1/2 bg-iris shadow-[0_0_20px_#6366f1]"
                  >
                    <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 flex size-9 items-center justify-center rounded-full border border-iris bg-carbon text-iris shadow-2xl">
                      <Icon name="shield" size={16} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* =====================================================================
                TAB 3: MULTI-TOUCH 5-DIMENSIONAL XDR INSPECTOR
               ===================================================================== */}
            {activeTab === "touch" && (
              <div className="p-6 sm:p-8 guides-dark">
                <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-5">
                  <div>
                    <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-iris">
                      5-Dimensional Claim Inspector · Channel Condition Presets
                    </span>
                    <h3 className="mt-1 font-display text-2xl font-bold text-bone">
                      Switch channels and apply intent-preserving fixes in one tap.
                    </h3>
                  </div>

                  {/* Reference Mode Pills */}
                  <div className="flex flex-wrap gap-1.5">
                    {REFERENCE_MODES.map((m, i) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setActiveModeIdx(i);
                          setTouchApplied(false);
                        }}
                        className={`rounded-lg px-3.5 py-2 text-xs font-medium border transition ${
                          activeModeIdx === i
                            ? "border-iris bg-iris/20 text-bone"
                            : "border-line bg-panel text-ash hover:text-bone"
                        }`}
                      >
                        {m.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-6 grid gap-6 lg:grid-cols-12">
                  {/* Left 6 Cols: Interactive Touch Draft Surface */}
                  <div className="lg:col-span-6 flex flex-col justify-between rounded-xl border border-line bg-panel p-6">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs text-iris">{activeMode.gamut}</span>
                        <Badge tone="neutral">{activeMode.refresh}</Badge>
                      </div>

                      <div className="mt-4 rounded-xl border border-line bg-carbon/80 p-5">
                        <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ash">
                            {touchApplied ? "Verified Rewrite Applied" : "Draft Copy · Click below to apply fix"}
                          </span>
                          <span
                            className={`font-mono text-[11px] font-semibold ${
                              touchApplied ? "text-ok" : "text-blocking"
                            }`}
                          >
                            {touchApplied ? "✓ 5/5 Dimensions Aligned" : activeMode.channelVerdict}
                          </span>
                        </div>

                        <p className="mt-3 text-base font-medium leading-relaxed text-bone">
                          {touchApplied ? activeMode.rewrittenCopy : activeMode.sampleCopy}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                      <Button
                        variant="primary"
                        onClick={() => setTouchApplied(v => !v)}
                      >
                        <Icon name={touchApplied ? "refresh" : "check"} size={14} />
                        {touchApplied ? "Reset to unverified draft" : "Apply intent-preserving fix"}
                      </Button>
                      {onTryChecker && (
                        <Button variant="ghost" onClick={onTryChecker}>
                          Open in Check content <Icon name="arrow" size={13} />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Right 6 Cols: 5-Dimensional Alignment Matrix */}
                  <div className="lg:col-span-6 rounded-xl border border-line bg-panel p-6">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs uppercase tracking-[0.16em] text-bone">
                        5-Dimensional Claim Verification
                      </span>
                      <span className="font-mono text-xs text-ash">
                        All 5 dimensions must align
                      </span>
                    </div>

                    <div className="mt-4 space-y-2.5">
                      {activeMode.dimensions.map(dim => {
                        const resolved = touchApplied || dim.status === "supported";
                        return (
                          <div
                            key={dim.name}
                            className={`grid grid-cols-12 items-center gap-3 rounded-lg border p-3 text-xs transition-all ${
                              resolved
                                ? "border-ok/35 bg-ok/5"
                                : "border-blocking/35 bg-blocking/5"
                            }`}
                          >
                            <div className="col-span-3 font-display text-sm font-semibold text-bone">
                              {dim.name}
                            </div>
                            <div className="col-span-6 space-y-0.5 font-mono text-[11px]">
                              <div className="truncate text-ash">
                                <span className="text-ash/60">DRAFT: </span>
                                <span className={resolved ? "text-bone" : "text-blocking line-through"}>
                                  {resolved ? dim.source : dim.draft}
                                </span>
                              </div>
                              <div className="truncate text-ok">
                                <span className="text-ash/60">PROOF: </span>
                                {dim.source}
                              </div>
                            </div>
                            <div className="col-span-3 text-right">
                              <Badge tone={resolved ? "success" : "danger"}>
                                {resolved ? "Verified" : "Mismatch"}
                              </Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* BrandLint XDR Spec Callout Bento Grid */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: "spark",
              eyebrow: "Tandem Engine",
              stat: "2-Layer",
              unit: "Rules + Facts",
              desc: "Dual verification across tone & proof.",
            },
            {
              icon: "check",
              eyebrow: "Claim Alignment",
              stat: "5 / 5",
              unit: "Locked Checks",
              desc: "Metric, target, window, scope & qualifier.",
            },
            {
              icon: "file",
              eyebrow: "Citation Proof",
              stat: "100%",
              unit: "Page Spans",
              desc: "Exact verbatim offsets cited from PDF.",
            },
            {
              icon: "lock",
              eyebrow: "Governance Gate",
              stat: "4-Eyes",
              unit: "Human Sign-Off",
              desc: "Self-approval blocked; expiry alerts live.",
            },
          ].map(item => (
            <div key={item.eyebrow} className="lv-card p-5">
              <div className="flex items-center justify-between gap-2">
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-iris">
                  {item.eyebrow}
                </div>
                <span className="lv-icon-tile !size-7">
                  <Icon name={item.icon} size={13} />
                </span>
              </div>
              <div className="mt-2.5 flex items-baseline gap-2">
                <span
                  className="font-display text-3xl font-extrabold tracking-tight bg-clip-text text-transparent sm:text-4xl"
                  style={{
                    backgroundImage: "linear-gradient(135deg, #ffffff 0%, #a5b4fc 100%)",
                  }}
                >
                  {item.stat}
                </span>
                <span className="font-mono text-xs text-bone">{item.unit}</span>
              </div>
              <div className="mt-2.5 text-xs text-ash">{item.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
