import React, { useEffect, useState } from "react";

const STAGES = ["Reading brand guidelines", "Matching claims to evidence", "Locking approval gates"];

export const Loader: React.FC<{ ready: boolean }> = ({ ready }) => {
  const [pct, setPct] = useState(0);
  const [minDone, setMinDone] = useState(false);
  const [slow, setSlow] = useState(false);
  const [phase, setPhase] = useState<"run" | "leave" | "gone">("run");

  useEffect(() => {
    const a = setTimeout(() => setMinDone(true), 3600);
    const b = setTimeout(() => setSlow(true), 10000);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, []);

  useEffect(() => {
    const target = ready && minDone ? 100 : 92;
    const id = setInterval(() => setPct((p) => (p < target ? p + 1 : p)), 34);
    return () => clearInterval(id);
  }, [ready, minDone]);

  useEffect(() => {
    if (pct >= 100 && phase === "run") {
      const a = setTimeout(() => setPhase("leave"), 350);
      return () => clearTimeout(a);
    }
    if (phase === "leave") {
      const b = setTimeout(() => setPhase("gone"), 1000);
      return () => clearTimeout(b);
    }
  }, [pct, phase]);

  if (phase === "gone") return null;
  const stage = Math.min(2, Math.floor(pct / 34));

  return (
    <div className={`bl-loader ${phase === "leave" ? "leave" : ""}`} role="status" aria-live="polite">
      <div className="bl-loader-grid" aria-hidden="true" />
      <div className="bl-loader-core">
        <div className="bl-loader-logo">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path d="m9 12 2 2 4-4" />
          </svg>
        </div>
        <div className="bl-loader-word">BrandLint</div>

        <div className="bl-draft" aria-hidden="true">
          <div className="bl-scan" />
          <p>
            Our platform{" "}
            <span className="bl-flag f1">guarantees<i className="sq" /><i className="okline" /></span>{" "}
            <span className="bl-flag f2">40% higher<i className="sq" /><i className="okline" /></span>{" "}
            productivity.
          </p>
          <div className="bl-stamp">Verified · Human sign-off</div>
        </div>

        <div className="bl-loader-meta">
          <span className="bl-stage" key={stage}>{slow && !ready ? "Waiting for the BrandLint API on port 8000…" : STAGES[stage]}</span>
          <span className="bl-pct">{String(pct).padStart(3, "0")}</span>
        </div>
        <div className="bl-bar"><span style={{ transform: `scaleX(${pct / 100})` }} /></div>
        {slow && !ready && (
          <div className="bl-slow">Start the backend (FastAPI, port 8000), then reload this page.</div>
        )}
      </div>
    </div>
  );
};
