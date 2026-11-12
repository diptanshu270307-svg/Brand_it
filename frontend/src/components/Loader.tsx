import React, { Suspense, lazy, useEffect, useState } from "react";
import { subscribeColdStart } from "../api";
import { Icon } from "./ui";

const ThreeBackdrop = lazy(() =>
  import("./ThreeBackdrop").then(m => ({ default: m.ThreeBackdrop }))
);

const STAGES = [
  "Reading brand guidelines · TERM-01@1",
  "Matching claims to evidence · EV-1",
  "Locking four-eyes approval gates",
];

export const Loader: React.FC<{
  ready: boolean;
  onDone?: () => void;
  onRetry?: () => void;
}> = ({ ready, onDone, onRetry }) => {
  const [pct, setPct] = useState(0);
  const [minDone, setMinDone] = useState(false);
  const [coldStart, setColdStart] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [phase, setPhase] = useState<"run" | "leave" | "gone">("run");

  useEffect(() => {
    const unsub = subscribeColdStart(warming => {
      if (warming) setColdStart(true);
    });
    const minTimer = setTimeout(() => setMinDone(true), 1100);
    const slowTimer = setTimeout(() => setColdStart(true), 3600);
    const tick = setInterval(() => {
      setElapsedSec(s => s + 1);
    }, 1000);

    return () => {
      unsub();
      clearTimeout(minTimer);
      clearTimeout(slowTimer);
      clearInterval(tick);
    };
  }, []);

  useEffect(() => {
    const target = ready && minDone ? 100 : coldStart ? 88 : 94;
    const id = setInterval(() => {
      setPct(p => {
        if (p >= target) return p;
        const step = ready && minDone ? 5 : coldStart ? 1 : 3;
        return Math.min(target, p + step);
      });
    }, 36);
    return () => clearInterval(id);
  }, [ready, minDone, coldStart]);

  useEffect(() => {
    if (pct >= 100 && phase === "run") {
      const a = setTimeout(() => setPhase("leave"), 220);
      return () => clearTimeout(a);
    }
    if (phase === "leave") {
      const b = setTimeout(() => setPhase("gone"), 620);
      return () => clearTimeout(b);
    }
  }, [pct, phase]);

  useEffect(() => {
    if (phase === "gone") {
      onDone?.();
    }
  }, [phase, onDone]);

  if (phase === "gone") return null;
  const stage = Math.min(2, Math.floor(pct / 34));

  return (
    <div
      className={`bl-loader ${phase === "leave" ? "leave" : ""}`}
      role="status"
      aria-live="polite"
      aria-label="Loading BrandLint"
    >
      {/* Code-split Three.js Navy/Teal Ambient Particle Backdrop */}
      <div className="vanta-loader-container" aria-hidden="true">
        <Suspense fallback={null}>
          <ThreeBackdrop density="minimal" className="h-full w-full" />
        </Suspense>
      </div>

      <div className="bl-loader-grid guides contours" aria-hidden="true" />

      {/* Main Architectural Loader Core */}
      <div className="bl-loader-core">
        <div
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-widest ${
            coldStart && !ready
              ? "border-teal-400/40 bg-teal-500/10 text-teal-300"
              : "border-[#26262f] bg-[#0b0b0d]/90 text-[#a39cff]"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full animate-pulse ${
              coldStart && !ready ? "bg-teal-400" : "bg-[#22c55e]"
            }`}
          />
          {coldStart && !ready ? "WAKING CLOUD ENGINE" : "BRANDLINT // GOVERNANCE ENGINE"}
        </div>

        <div className="bl-loader-logo">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path d="m9 12 2 2 4-4" />
          </svg>
        </div>
        <div className="bl-loader-word">BrandLint</div>

        {/* 3-Step Stage Pills */}
        <div className="flex flex-wrap items-center justify-center gap-1.5" aria-hidden="true">
          {["01 RULES", "02 EVIDENCE", "03 SIGN-OFF"].map((pill, idx) => (
            <span
              key={pill}
              className={`rounded border px-2 py-0.5 font-mono text-[10px] uppercase transition-colors ${
                stage >= idx
                  ? "border-[#a39cff]/50 bg-[#4b3fd1]/25 text-[#f3efe6]"
                  : "border-[#26262f] bg-[#0b0b0d]/60 text-[#8a8680]"
              }`}
            >
              {pill}
            </span>
          ))}
        </div>

        {/* Friendly Cold-Start Explainer Card when Render backend is waking from sleep */}
        {coldStart && !ready ? (
          <div className="w-full rounded-xl border border-teal-500/30 bg-[#06121d]/90 p-4 text-left space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-teal-200">
                <Icon name="clock" size={14} className="text-teal-400" />
                <span>Waking up Render backend server…</span>
              </div>
              <span className="font-mono text-[11px] text-teal-300">{elapsedSec}s</span>
            </div>
            <div className="text-xs text-slate-300 leading-5">
              Free-tier cloud servers hibernate after inactivity (~20–40s on first visit). Your workspace loads automatically as soon as it responds.
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-teal-400/40 bg-teal-500/15 px-3 py-1.5 font-mono text-[11px] font-semibold text-teal-200 transition hover:bg-teal-500/25"
                >
                  <Icon name="refresh" size={12} /> Ping server now
                </button>
              )}
              <button
                type="button"
                onClick={() => setPhase("leave")}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.04] px-3 py-1.5 font-mono text-[11px] text-slate-300 transition hover:bg-white/[0.1]"
              >
                Continue to UI preview →
              </button>
            </div>
          </div>
        ) : (
          <div className="bl-draft" aria-hidden="true">
            <div className="bl-scan" />
            <p>
              Our platform{" "}
              <span className="bl-flag f1">
                guarantees<i className="sq" />
                <i className="okline" />
              </span>{" "}
              <span className="bl-flag f2">
                40% higher<i className="sq" />
                <i className="okline" />
              </span>{" "}
              productivity.
            </p>
            <div className="mt-2 text-center font-mono text-[11px] text-[#4ade80]">
              → “reported 18% higher task throughput (EV-1, p.2)”
            </div>
            <div className="bl-stamp">Verified · Human sign-off</div>
          </div>
        )}

        <div className="bl-loader-meta">
          <span className="bl-stage" key={coldStart && !ready ? "cold" : stage}>
            {coldStart && !ready
              ? `Connecting to API · ${elapsedSec}s elapsed`
              : STAGES[stage]}
          </span>
          <span className="bl-pct">{String(pct).padStart(3, "0")}%</span>
        </div>
        <div className="bl-bar">
          <span style={{ transform: `scaleX(${pct / 100})` }} />
        </div>
      </div>
    </div>
  );
};
