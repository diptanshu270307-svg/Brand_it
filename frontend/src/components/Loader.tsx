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
  "Reading brand guidelines",
  "Matching claims to evidence",
  "Locking approval gates",
];

export const Loader: React.FC<{ ready: boolean }> = ({ ready }) => {
  const [pct, setPct] = useState(0);
  const [minDone, setMinDone] = useState(false);
  const [slow, setSlow] = useState(false);
  const [phase, setPhase] = useState<"run" | "leave" | "gone">("run");

  const vantaRef = useRef<HTMLDivElement>(null);
  const vantaEffectRef = useRef<{ destroy: () => void } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Initialize Vanta.js 3D Dots with exact configuration
  useEffect(() => {
    let timer: number | null = null;
    let fallbackAnimId: number | null = null;

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
              color: 0x6366f1,
              color2: 0x38bdf8,
              backgroundColor: 0x090d16,
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
      timer = window.setInterval(() => {
        if (tryInitVanta() && timer) {
          clearInterval(timer);
          timer = null;
          // Stop fallback canvas if Vanta took over
          if (fallbackAnimId) cancelAnimationFrame(fallbackAnimId);
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

          const spacing = 38;
          let time = 0;

          const renderFallback = () => {
            time += 0.025;
            ctx.fillStyle = "#090d16";
            ctx.fillRect(0, 0, width, height);

            for (let x = spacing / 2; x < width; x += spacing) {
              for (let y = spacing / 2; y < height; y += spacing) {
                const dx = x - mouseX;
                const dy = y - mouseY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const mouseFactor = Math.max(0, 1 - dist / 220);
                const wave = Math.sin(time + (x + y) * 0.015) * 1.5;
                const radius = 2.2 + wave * 0.8 + mouseFactor * 3.5;

                ctx.beginPath();
                ctx.arc(x, y, radius, 0, Math.PI * 2);
                if (mouseFactor > 0.1) {
                  ctx.fillStyle = `rgba(99, 102, 241, ${0.4 + mouseFactor * 0.6})`;
                } else {
                  ctx.fillStyle = "rgba(79, 70, 229, 0.28)";
                }
                ctx.fill();
              }
            }
            if (!vantaEffectRef.current) {
              fallbackAnimId = requestAnimationFrame(renderFallback);
            }
          };
          fallbackAnimId = requestAnimationFrame(renderFallback);

          return () => {
            window.removeEventListener("resize", handleResize);
            window.removeEventListener("mousemove", handleMouse);
            if (fallbackAnimId) cancelAnimationFrame(fallbackAnimId);
          };
        }
      }
    }

    return () => {
      if (timer) clearInterval(timer);
      if (fallbackAnimId) cancelAnimationFrame(fallbackAnimId);
      if (vantaEffectRef.current) {
        vantaEffectRef.current.destroy();
        vantaEffectRef.current = null;
      }
    };
  }, []);

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
    <div
      className={`bl-loader ${phase === "leave" ? "leave" : ""}`}
      role="status"
      aria-live="polite"
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

      <div className="bl-loader-grid" aria-hidden="true" />

      {/* Main Glassmorphic Loader Core */}
      <div className="bl-loader-core">
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
          <div className="bl-stamp">Verified · Human sign-off</div>
        </div>

        <div className="bl-loader-meta">
          <span className="bl-stage" key={stage}>
            {slow && !ready
              ? "Waiting for the BrandLint API on port 8000…"
              : STAGES[stage]}
          </span>
          <span className="bl-pct">{String(pct).padStart(3, "0")}%</span>
        </div>
        <div className="bl-bar">
          <span style={{ transform: `scaleX(${pct / 100})` }} />
        </div>
        {slow && !ready && (
          <div className="bl-slow">
            Start the backend (FastAPI, port 8000), then reload this page.
          </div>
        )}
      </div>
    </div>
  );
};
