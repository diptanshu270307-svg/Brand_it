import React, { useEffect, useRef } from "react";
import * as THREE from "three";

interface ThreeBackdropProps {
  className?: string;
  density?: "minimal" | "hero";
}

function createTealDotTexture(): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255, 255, 255, 1)");
  grad.addColorStop(0.35, "rgba(209, 250, 229, 0.8)");
  grad.addColorStop(0.75, "rgba(20, 184, 166, 0.25)");
  grad.addColorStop(1, "rgba(20, 184, 166, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Lightweight Three.js particle field styled to BrandLint's deep navy / teal palette.
 * - Reduces particle count on mobile screens
 * - Caps devicePixelRatio (<= 1.5 mobile, <= 1.75 desktop)
 * - Pauses rendering automatically when off-screen, tab-hidden, or under reduced-motion
 */
export const ThreeBackdrop: React.FC<ThreeBackdropProps> = ({
  className = "",
  density = "hero",
}) => {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof window === "undefined") return;

    const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const isMobile = window.innerWidth < 768;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: false,
        powerPreference: isMobile ? "low-power" : "default",
      });
    } catch {
      // Headless / WebGL-disabled environment: leave deep navy CSS backdrop visible without logging errors.
      return;
    }

    const dprCap = isMobile ? 1.5 : 1.75;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
    renderer.setClearColor(0x0b1220, 0);

    const width = host.clientWidth || window.innerWidth;
    const height = host.clientHeight || window.innerHeight;
    renderer.setSize(width, height, false);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, width / Math.max(height, 1), 0.1, 100);
    camera.position.z = 22;

    const count = density === "minimal"
      ? (isMobile ? 16 : 30)
      : (isMobile ? 22 : 44);

    const spreadX = isMobile ? 22 : 34;
    const spreadY = isMobile ? 16 : 20;
    const spreadZ = 14;

    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);

    const palette = [
      new THREE.Color("#0a2540"), // Corporate navy
      new THREE.Color("#0f766e"), // Muted corporate teal
      new THREE.Color("#14b8a6"), // Primary teal accent
      new THREE.Color("#5eead4"), // Soft teal highlight
    ];

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      positions[i3] = (Math.random() - 0.5) * spreadX;
      positions[i3 + 1] = (Math.random() - 0.5) * spreadY;
      positions[i3 + 2] = (Math.random() - 0.5) * spreadZ;

      velocities[i3] = (Math.random() - 0.5) * 0.014;
      velocities[i3 + 1] = (Math.random() - 0.5) * 0.011;
      velocities[i3 + 2] = (Math.random() - 0.5) * 0.008;

      const c = palette[i % palette.length];
      colors[i3] = c.r;
      colors[i3 + 1] = c.g;
      colors[i3 + 2] = c.b;
    }

    const pointGeo = new THREE.BufferGeometry();
    pointGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    pointGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const dotTexture = createTealDotTexture();
    const pointMat = new THREE.PointsMaterial({
      size: isMobile ? 0.45 : 0.4,
      map: dotTexture ?? undefined,
      vertexColors: true,
      transparent: true,
      opacity: 0.46,
      depthWrite: false,
      blending: THREE.NormalBlending,
      sizeAttenuation: true,
    });

    const points = new THREE.Points(pointGeo, pointMat);
    scene.add(points);

    // Sparse low-density connection lines
    const maxSegments = isMobile ? 18 : 38;
    const linePositions = new Float32Array(maxSegments * 6);
    const lineGeo = new THREE.BufferGeometry();
    const lineAttr = new THREE.BufferAttribute(linePositions, 3);
    lineAttr.setUsage(THREE.DynamicDrawUsage);
    lineGeo.setAttribute("position", lineAttr);

    const lineMat = new THREE.LineBasicMaterial({
      color: 0x14b8a6,
      transparent: true,
      opacity: 0.09,
      depthWrite: false,
    });
    const lines = new THREE.LineSegments(lineGeo, lineMat);
    scene.add(lines);

    const updateConnections = () => {
      let seg = 0;
      const maxDistSq = isMobile ? 28 : 34;
      for (let i = 0; i < count && seg < maxSegments; i++) {
        const i3 = i * 3;
        for (let j = i + 1; j < count && seg < maxSegments; j++) {
          const j3 = j * 3;
          const dx = positions[i3] - positions[j3];
          const dy = positions[i3 + 1] - positions[j3 + 1];
          const dz = positions[i3 + 2] - positions[j3 + 2];
          if (dx * dx + dy * dy + dz * dz < maxDistSq) {
            const s6 = seg * 6;
            linePositions[s6] = positions[i3];
            linePositions[s6 + 1] = positions[i3 + 1];
            linePositions[s6 + 2] = positions[i3 + 2];
            linePositions[s6 + 3] = positions[j3];
            linePositions[s6 + 4] = positions[j3 + 1];
            linePositions[s6 + 5] = positions[j3 + 2];
            seg++;
          }
        }
      }
      lineGeo.setDrawRange(0, seg * 2);
      lineAttr.needsUpdate = true;
    };

    let rafId = 0;
    let isVisible = true;
    let isTabVisible = typeof document !== "undefined" ? !document.hidden : true;
    let pointerX = 0;
    let pointerY = 0;

    const handleResize = () => {
      if (!host) return;
      const w = host.clientWidth || window.innerWidth;
      const h = host.clientHeight || window.innerHeight;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, w < 768 ? 1.5 : 1.75));
      camera.aspect = w / Math.max(h, 1);
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
      if (prefersReducedMotion) {
        updateConnections();
        renderer.render(scene, camera);
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (isMobile || prefersReducedMotion) return;
      pointerX = ((e.clientX / Math.max(window.innerWidth, 1)) - 0.5) * 1.4;
      pointerY = ((e.clientY / Math.max(window.innerHeight, 1)) - 0.5) * 0.9;
    };

    const renderLoop = () => {
      if (!isVisible || !isTabVisible || prefersReducedMotion) {
        rafId = 0;
        return;
      }

      const posAttr = pointGeo.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        positions[i3] += velocities[i3];
        positions[i3 + 1] += velocities[i3 + 1];
        positions[i3 + 2] += velocities[i3 + 2];

        if (positions[i3] > spreadX * 0.5 || positions[i3] < -spreadX * 0.5) velocities[i3] *= -1;
        if (positions[i3 + 1] > spreadY * 0.5 || positions[i3 + 1] < -spreadY * 0.5) velocities[i3 + 1] *= -1;
        if (positions[i3 + 2] > spreadZ * 0.5 || positions[i3 + 2] < -spreadZ * 0.5) velocities[i3 + 2] *= -1;
      }
      posAttr.needsUpdate = true;
      updateConnections();

      camera.position.x += (pointerX - camera.position.x) * 0.025;
      camera.position.y += (-pointerY - camera.position.y) * 0.025;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
      rafId = requestAnimationFrame(renderLoop);
    };

    const startIfActive = () => {
      if (!rafId && isVisible && isTabVisible && !prefersReducedMotion) {
        rafId = requestAnimationFrame(renderLoop);
      }
    };

    const observer = new IntersectionObserver(
      entries => {
        isVisible = entries[0]?.isIntersecting ?? false;
        if (isVisible) {
          startIfActive();
        } else if (rafId) {
          cancelAnimationFrame(rafId);
          rafId = 0;
        }
      },
      { threshold: 0.02 }
    );
    observer.observe(host);

    const handleVisibility = () => {
      isTabVisible = !document.hidden;
      if (isTabVisible) {
        startIfActive();
      } else if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
    };

    window.addEventListener("resize", handleResize, { passive: true });
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    document.addEventListener("visibilitychange", handleVisibility);

    updateConnections();
    renderer.render(scene, camera);
    startIfActive();

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      observer.disconnect();
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("visibilitychange", handleVisibility);

      pointGeo.dispose();
      pointMat.dispose();
      lineGeo.dispose();
      lineMat.dispose();
      dotTexture?.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === host) {
        host.removeChild(renderer.domElement);
      }
    };
  }, [density]);

  return (
    <div
      ref={hostRef}
      aria-hidden="true"
      className={`pointer-events-none select-none ${className}`}
      style={{
        background:
          "radial-gradient(circle at 20% 20%, rgba(20, 184, 166, 0.08) 0%, rgba(11, 18, 32, 0.94) 55%, #0b1220 100%)",
      }}
    />
  );
};

export default ThreeBackdrop;
