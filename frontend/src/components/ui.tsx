import React, { useEffect, useId, useRef } from "react";

export function Icon({ name = "spark", className = "", size = 18 }: { name?: string; className?: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    spark: <><path d="m12 3 2.7 6.3L21 12l-6.3 2.7L12 21l-2.7-6.3L3 12l6.3-2.7L12 3Z"/><path d="M20 3v4M18 5h4"/></>,
    arrow: <path d="M4 12h15m-6-6 6 6-6 6"/>,
    check: <path d="m5 12 4 4L19 6"/>,
    close: <path d="m6 6 12 12M6 18 18 6"/>,
    plus: <path d="M12 5v14M5 12h14"/>,
    shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/></>,
    book: <><path d="M12 5v16M3 4h5a4 4 0 0 1 4 3 4 4 0 0 1 4-3h5v14h-5a4 4 0 0 0-4 3 4 4 0 0 0-4-3H3V4Z"/></>,
    radar: <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="m12 12 7-7"/><circle cx="12" cy="12" r="1"/></>,
    review: <><rect x="5" y="3" width="14" height="18" rx="3"/><path d="M9 8h6M9 12h6m-6 4 2 2 4-4"/></>,
    chart: <><path d="M4 4v16h16M8 15l4-6 4 3 4-7"/></>,
    sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1"/></>,
    moon: <path d="M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z"/>,
    chevron: <path d="m6 9 6 6 6-6"/>,
    upload: <><path d="M12 16V3m-5 5 5-5 5 5M4 15v5h16v-5"/></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 7a7 7 0 0 1 12-1l2 3M4 15l2 3a7 7 0 0 0 12-1"/></>,
    alert: <><path d="m12 3 10 18H2L12 3Z"/><path d="M12 9v5m0 3v1"/></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>,
    file: <><path d="M14 2H5v20h14V7l-5-5Zm0 0v5h5M8 12h8M8 16h6"/></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${className}`} aria-hidden="true">{paths[name] || paths.spark}</svg>;
}

export type Tone = "neutral" | "success" | "warning" | "danger" | "accent";
export function Badge({ children, tone = "neutral", className = "" }: { children: React.ReactNode; tone?: Tone; className?: string }) {
  return <span className={`lv-badge lv-badge-${tone} ${className}`}>{children}</span>;
}
export function Button({ children, variant = "secondary", className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  return <button type="button" className={`lv-btn lv-btn-${variant} ${className}`} {...props}>{children}</button>;
}
export function Panel({ children, className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`lv-card ${className}`} {...props}>{children}</div>;
}
export function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <header className="mb-8 flex flex-wrap items-end justify-between gap-5"><div><div className="lv-eyebrow mb-3">{eyebrow}</div><h1 className="lv-title">{title}</h1><p className="lv-muted mt-3 max-w-2xl text-sm leading-6">{description}</p></div>{action && <div className="flex flex-wrap gap-2">{action}</div>}</header>;
}
export function StatusAnnouncer({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
    >
      {message}
    </div>
  );
}

export function Notice({ children, tone = "neutral", className = "", action }: { children: React.ReactNode; tone?: Tone; className?: string; action?: React.ReactNode }) {
  const isConfirm = tone === "success" || tone === "accent";
  return (
    <div className={`lv-notice lv-notice-${tone} ${isConfirm ? "motion-confirmation" : ""} flex items-center justify-between gap-3 ${className}`} role={tone === "danger" ? "alert" : "status"}>
      <div>{children}</div>
      {action && <div>{action}</div>}
    </div>
  );
}
export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return <div className="lv-well flex min-h-40 flex-col items-center justify-center gap-3 p-7 text-center"><Icon name="shield" className="lv-muted" size={26}/><h3 className="font-display text-base font-medium">{title}</h3>{children && <div className="lv-muted max-w-md text-sm leading-6">{children}</div>}</div>;
}
export function Metric({ label, value, note, tone = "neutral" }: { label: string; value: React.ReactNode; note?: React.ReactNode; tone?: Tone }) {
  return <Panel className="p-5"><div className="lv-muted text-xs">{label}</div><div className={`lv-metric mt-3 ${tone === "neutral" ? "" : `lv-text-${tone}`}`}>{value}</div>{note && <div className="lv-muted mt-3 text-xs leading-5">{note}</div>}</Panel>;
}
export function Modal({ title, children, onClose, wide = false }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () => Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex="0"]') || []);
    (focusable()[0] || ref.current)?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
      if (e.key === "Tab") {
        const list = focusable(); const first = list[0]; const last = list[list.length - 1];
        if (!first) { e.preventDefault(); return; }
        if (e.shiftKey && (document.activeElement === first || !ref.current?.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", handler);
    return () => { document.removeEventListener("keydown", handler); document.body.style.overflow = oldOverflow; previous?.focus(); };
  }, []);
  return <div className="lv-modal-overlay motion-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><div className={`lv-card lv-modal motion-dialog ${wide ? "max-w-5xl" : "max-w-2xl"}`} ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}><div className="lv-divider flex items-center justify-between gap-4 border-b p-6"><h2 id={titleId} className="font-display text-xl font-semibold">{title}</h2><Button variant="ghost" onClick={onClose} aria-label="Close dialog"><Icon name="close"/></Button></div><div className="p-6">{children}</div></div></div>;
}
export const errorText = (e: unknown) => e instanceof Error ? e.message : "The request could not be completed. Please try again.";
export const formatDate = (v?: string | null) => v ? new Date(v.length === 10 ? `${v}T00:00:00` : v.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(v) ? v : `${v}Z`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "Not set";
export const percentage = (n?: number | null) => n == null || !Number.isFinite(n) ? "—" : `${Math.round(n * 100)}%`;

export type IssueTier = "must_fix" | "needs_review" | "suggestion";

export function getIssueTier(finding: { severity?: string; is_claim?: boolean; evidence_status?: string | null }): IssueTier {
  if (
    finding.severity === "critical" ||
    finding.severity === "high" ||
    finding.evidence_status === "expired" ||
    finding.evidence_status === "missing" ||
    finding.evidence_status === "rejected"
  ) {
    return "must_fix";
  }
  if (
    finding.is_claim ||
    finding.severity === "medium" ||
    finding.evidence_status === "insufficient" ||
    finding.evidence_status === "needs_review"
  ) {
    return "needs_review";
  }
  return "suggestion";
}

export function IssueBadge({ tier, className = "" }: { tier: IssueTier; className?: string }) {
  if (tier === "must_fix") {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/15 text-rose-300 border border-rose-500/30 ${className}`}>
        <Icon name="alert" size={12} /> Must fix
      </span>
    );
  }
  if (tier === "needs_review") {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30 ${className}`}>
        <Icon name="clock" size={12} /> Needs review
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-violet-500/15 text-violet-300 border border-violet-500/30 ${className}`}>
      <Icon name="spark" size={12} /> Suggestion
    </span>
  );
}

export function ExpandableDetails({
  title,
  summary,
  children,
  className = "",
}: {
  title?: string;
  summary?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const displayTitle = title || summary || "Technical details & rule versions";
  return (
    <details
      className={`group rounded-xl border border-line/60 bg-well/40 p-3 text-xs transition ${className}`}
      onToggle={e => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary className="cursor-pointer font-medium text-muted hover:text-ink flex items-center justify-between list-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-400 rounded">
        <span>{displayTitle}</span>
        <Icon
          name="chevron"
          size={12}
          className={`motion-chevron transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </summary>
      <div className="motion-accordion-content mt-2.5 pt-2 border-t border-line/40 text-muted space-y-1 font-mono text-[11px]">
        {children}
      </div>
    </details>
  );
}

export function FormField({
  label,
  hint,
  error,
  required,
  children,
  htmlFor,
  className = "",
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <label htmlFor={htmlFor} className="lv-label flex items-center justify-between">
        <span>
          {label} {required && <span className="text-rose-400">*</span>}
        </span>
        {hint && <span className="text-[11px] text-muted font-normal">{hint}</span>}
      </label>
      {children}
      {error && <p className="text-xs text-rose-400" role="alert">{error}</p>}
    </div>
  );
}
