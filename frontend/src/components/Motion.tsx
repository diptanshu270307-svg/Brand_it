import React, { useEffect, useRef, useState } from "react";

/** Scroll-reveal + cursor glow for everything inside the ref'd root. */
export function useIntroMotion(root: React.RefObject<HTMLElement>) {
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => e.isIntersecting && (e.target.classList.add("in"), io.unobserve(e.target))),
      { threshold: 0.15 }
    );
    el.querySelectorAll("[data-reveal]").forEach((n) => io.observe(n));
    const move = (e: MouseEvent) => {
      const t = (e.target as HTMLElement).closest<HTMLElement>(".tile,.stat-card,.pitch-card");
      if (!t) return;
      const r = t.getBoundingClientRect();
      t.style.setProperty("--mx", `${e.clientX - r.left}px`);
      t.style.setProperty("--my", `${e.clientY - r.top}px`);
    };
    el.addEventListener("mousemove", move);
    return () => { io.disconnect(); el.removeEventListener("mousemove", move); };
  }, [root]);
}

export const Count: React.FC<{ to: number; suffix?: string }> = ({ to, suffix = "" }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const [v, setV] = useState(0);
  useEffect(() => {
    const n = ref.current;
    if (!n) return;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const step = (t: number) => {
        const p = Math.min(1, (t - t0) / 1600);
        setV(Math.round(to * (1 - Math.pow(1 - p, 4))));
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
    io.observe(n);
    return () => io.disconnect();
  }, [to]);
  return <span ref={ref}>{v}{suffix}</span>;
};

export const SectionRail: React.FC<{ items: { id: string; label: string }[] }> = ({ items }) => {
  const [active, setActive] = useState(items[0].id);
  const [prog, setProg] = useState(0);
  useEffect(() => {
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => e.isIntersecting && setActive(e.target.id)),
      { rootMargin: "-45% 0px -50% 0px" }
    );
    items.forEach((i) => { const n = document.getElementById(i.id); if (n) io.observe(n); });
    const onScroll = () => {
      const h = document.documentElement;
      setProg(h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { io.disconnect(); window.removeEventListener("scroll", onScroll); };
  }, [items]);
  return (
    <>
      <div className="bl-scroll" style={{ transform: `scaleX(${prog})` }} aria-hidden="true" />
      <nav className="bl-rail" aria-label="Page sections">
        {items.map((i) => (
          <a key={i.id} href={`#${i.id}`} className={active === i.id ? "on" : ""}
             onClick={(e) => { e.preventDefault(); document.getElementById(i.id)?.scrollIntoView({ behavior: "smooth" }); }}>
            <span>{i.label}</span><i />
          </a>
        ))}
      </nav>
    </>
  );
};
