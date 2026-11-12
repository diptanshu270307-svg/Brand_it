import React, { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    THREE?: unknown;
    VANTA?: {
      DOTS: (options: Record<string, unknown>) => { destroy: () => void };
    };
  }
}

const STAGES = [
  "Reading brand guidelines · TERM-01@1",
  "Matching claims to evidence · EV-1",
  "Locking four-eyes approval gates",
];

export const Loader: React.FC<{
  ready: boolean;
  onDone?: () => void;
  onRetry?: () => void;
}> = ({ ready, onDone }) => {
  const [pct, setPct] = useState(0);
  const [minDone, setMinDone] = useState(false);
  const [slow, setSlow] = useState(false);
  const [phase, setPhase] = useState<"run" | "leave" | "gone">("run");

  const vantaRef = useRef<HTMLDivElement>(null);
  const vantaEffectRef = useRef<{ destroy: () => void } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animIdRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);

  // Initialize Vanta.js 3D Dots with interactive canvas fallback
  useEffect(() => {
    const tryInitVanta = () => {
      if (typeof window !== "undefined" && window.VANTA && window.VANTA.DOTS && vantaRef.current) {
        try {
          if (!vantaEffectRef.current) {
            vantaEffectRef.current = window.VANTA.DOTS({
              el: vantaRef.current,
              mouseControls: true,
              touchControls: true,
              gyroControls: false,
              minHeight: 200.0,
              minWidth: 200.0,
              scale: 1.0,
              scaleMobile: 1.0,
              color: 0xa39cff,
              color2: 0x4b3fd1,
              backgroundColor: 0x0b0b0d,
              size: 3.5,
              spacing: 36.0,
              showLines: false,
            });
          }
          return true;
        } catch (e) {
          console.warn("Vanta initialization:", e);
        }
      }
      return false;
    };

    const isInitialized = tryInitVanta();

    if (!isInitialized) {
      // Retry in case CDN scripts are still loading
      timerRef.current = window.setInterval(() => {
        if (tryInitVanta() && timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
          if (animIdRef.current) cancelAnimationFrame(animIdRef.current);
        }
      }, 200);

      // Fallback interactive canvas dot grid while waiting or offline
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          let width = (canvas.width = window.innerWidth);
          let height = (canvas.height = window.innerHeight);

          const handleResize = () => {
            if (!canvas) return;
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
          };
          window.addEventListener("resize", handleResize);

          let mouseX = width / 2;
          let mouseY = height / 2;
          const handleMouse = (e: MouseEvent) => {
            mouseX = e.clientX;
            mouseY = e.clientY;
          };
          window.addEventListener("mousemove", handleMouse);

          const spacing = 48;
          let time = 0;

          const renderFallback = () => {
            time += 0.025;
            ctx.fillStyle = "#0b0b0d";
            ctx.fillRect(0, 0, width, height);

            for (let x = spacing / 2; x < width; x += spacing) {
              for (let y = spacing / 2; y < height; y += spacing) {
                const dx = x - mouseX;
                const dy = y - mouseY;
                const distSq = dx * dx + dy * dy;
                const mouseFactor = distSq < 48400 ? Math.max(0, 1 - Math.sqrt(distSq) / 220) : 0;
                const wave = Math.sin(time + (x + y) * 0.015) * 1.5;
                const radius = 2.0 + wave * 0.6 + mouseFactor * 3.0;

                ctx.beginPath();
                ctx.arc(x, y, radius, 0, Math.PI * 2);
                if (mouseFactor > 0.1) {
                  ctx.fillStyle = `rgba(163, 156, 255, ${0.4 + mouseFactor * 0.6})`;
                } else {
                  ctx.fillStyle = "rgba(75, 63, 209, 0.32)";
                }
                ctx.fill();
              }
            }
            if (!vantaEffectRef.current) {
              animIdRef.current = requestAnimationFrame(renderFallback);
            }
          };
          animIdRef.current = requestAnimationFrame(renderFallback);

          return () => {
            window.removeEventListener("resize", handleResize);
            window.removeEventListener("mousemove", handleMouse);
            if (animIdRef.current) cancelAnimationFrame(animIdRef.current);
          };
        }
      }
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animIdRef.current) cancelAnimationFrame(animIdRef.current);
      if (vantaEffectRef.current) {
        vantaEffectRef.current.destroy();
        vantaEffectRef.current = null;
      }
    };
  }, []);

  // Cleanup completely when leaving
  useEffect(() => {
    if (phase === "leave" || phase === "gone") {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (animIdRef.current) {
        cancelAnimationFrame(animIdRef.current);
        animIdRef.current = null;
      }
      if (vantaEffectRef.current) {
        vantaEffectRef.current.destroy();
        vantaEffectRef.current = null;
      }
      if (phase === "gone") {
        onDone?.();
      }
    }
  }, [phase, onDone]);

  useEffect(() => {
    const a = setTimeout(() => setMinDone(true), 3600);
    const b = setTimeout(() => setSlow(true), 10000);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, []);

  useEffect(() => {
    const target = ready && minDone ? 100 : 92;
    const id = setInterval(() => setPct(p => (p < target ? p + 1 : p)), 34);
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
    <div
      className={`bl-loader ${phase === "leave" ? "leave" : ""}`}
      role="status"
      aria-live="polite"
      aria-label="Loading BrandLint"
    >
      {/* 3D Vanta Dots Background Container */}
      <div
        id="vanta-loader-bg"
        ref={vantaRef}
        className="vanta-loader-container"
        aria-hidden="true"
      >
        <canvas ref={canvasRef} className="vanta-fallback-canvas" />
      </div>

      <div className="bl-loader-grid guides contours" aria-hidden="true" />

      {/* Main Architectural Loader Core */}
      <div className="bl-loader-core">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#26262f] bg-[#0b0b0d]/90 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-[#a39cff]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#22c55e]" />
          BRANDLINT // GOVERNANCE ENGINE
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

        <div className="bl-loader-meta">
          <span className="bl-stage" key={stage}>
            {slow && !ready
              ? "Waiting for the BrandLint API…"
              : STAGES[stage]}
          </span>
          <span className="bl-pct">{String(pct).padStart(3, "0")}%</span>
        </div>
        <div className="bl-bar">
          <span style={{ transform: `scaleX(${pct / 100})` }} />
        </div>
        {slow && !ready && (
          <div className="bl-slow">
            Start the backend (FastAPI), then reload this page.
          </div>
        )}
      </div>
    </div>
  );
};
