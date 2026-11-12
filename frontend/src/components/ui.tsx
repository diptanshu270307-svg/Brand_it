import React, { useEffect, useId, useRef } from "react";

export const BrandLintLogo: React.FC<{ className?: string; size?: number }> = ({
  className = "",
  size = 18,
}) => (
  <span className={`lv-logo inline-flex items-center justify-center ${className}`}>
    <span>
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="m9 12 2 2 4-4" stroke="#a39cff" />
      </svg>
    </span>
  </span>
);

export const HeaderCalibrationSvg: React.FC<{ className?: string }> = ({
  className = "pointer-events-none absolute -top-6 right-2 hidden h-[calc(100%+1.5rem)] w-14 sm:block",
}) => (
  <svg aria-hidden="true" viewBox="0 0 60 200" preserveAspectRatio="xMidYMin meet" className={className}>
    <line x1="30" y1="0" x2="30" y2="128" stroke="#A39CFF" strokeWidth="1" strokeDasharray="3 3" opacity="0.55" />
    <rect x="16" y="128" width="28" height="28" rx="6" fill="#17171d" stroke="#4B3FD1" strokeWidth="1.5" />
    <path d="M30 135l7 2.6v5.2c0 4.3-7 7.7-7 7.7s-7-3.4-7-7.7v-5.2l7-2.6z" fill="#4B3FD1" fillOpacity="0.25" stroke="#A39CFF" strokeWidth="1.2" />
    <path d="m27.5 143 1.8 1.8 3.5-3.5" fill="none" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

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
    user: <><circle cx="12" cy="8.5" r="3.5"/><path d="M5.5 19.5c1.5-3 4-4.5 6.5-4.5s5 1.5 6.5 4.5"/></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    copy: <><rect x="9" y="9" width="10" height="10" rx="2"/><path d="M6 15H5a2 2 0 01-2-2V5a2 2 0 012-2h8a2 2 0 012 2v1"/></>,
    download: <><path d="M12 4v11"/><path d="M8 11l4 4 4-4"/><path d="M4.5 18.5h15"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></>,
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      aria-hidden="true"
    >
      {paths[name] || paths.spark}
    </svg>
  );
}

export type Tone = "neutral" | "success" | "warning" | "danger" | "accent";

export function Badge({ children, tone = "neutral", className = "" }: { children: React.ReactNode; tone?: Tone; className?: string }) {
  return <span className={`lv-badge lv-badge-${tone} ${className}`}>{children}</span>;
}

export function Button({
  children,
  variant = "secondary",
  className = "",
  type = "button",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  return (
    <button type={type} className={`lv-btn lv-btn-${variant} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function Panel({ children, className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`lv-card ${className}`} {...props}>
      {children}
    </div>
  );
}

export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  const words = title.trim().split(/\s+/);
  return (
    <header className="relative mb-6 border-b border-line pt-8 pb-8 sm:pt-12">
      <HeaderCalibrationSvg />
      <div className="relative flex flex-wrap items-end justify-between gap-6 sm:pr-20">
        <div className="max-w-3xl">
          <p className="font-label text-xs uppercase text-bone/50">BrandLint · {eyebrow}</p>
          <h1 className="mt-3 font-display text-[clamp(2.4rem,6vw,4.75rem)] font-bold uppercase leading-[0.86] tracking-[-0.04em] text-bone">
            {words.map((word, idx) => (
              <React.Fragment key={`${word}-${idx}`}>
                <span className="inline-block overflow-hidden pb-1 align-bottom">
                  <span className="mask-up inline-block" style={{ animationDelay: `${idx * 65}ms` }}>
                    {word}
                  </span>
                </span>
                {idx < words.length - 1 ? " " : ""}
              </React.Fragment>
            ))}
          </h1>
          {description && (
            <p className="rise-in mt-4 max-w-2xl text-lg leading-snug text-bone/65" style={{ animationDelay: "180ms" }}>
              {description}
            </p>
          )}
        </div>
        {action && <div className="flex flex-wrap items-center gap-2.5">{action}</div>}
      </div>
    </header>
  );
}

export function StatusAnnouncer({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {message}
    </div>
  );
}

export function Notice({
  children,
  tone = "neutral",
  className = "",
  action,
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      className={`lv-notice lv-notice-${tone} flex flex-wrap items-center justify-between gap-3 ${className}`}
      role={tone === "danger" ? "alert" : "status"}
    >
      <div className="min-w-0 flex-1">{children}</div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function Empty({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-panel flex min-h-40 flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-raised text-iris">
        <Icon name="shield" size={20} />
      </div>
      <h3 className="font-display text-lg font-bold uppercase tracking-[-0.02em] text-bone">{title}</h3>
      {children && <div className="max-w-md text-sm leading-6 text-ash">{children}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Metric({
  label,
  value,
  note,
  tone = "neutral",
}: {
  label: string;
  value: React.ReactNode;
  note?: React.ReactNode;
  tone?: Tone;
}) {
  const valueTone =
    tone === "success"
      ? "text-ok"
      : tone === "warning"
      ? "text-major"
      : tone === "danger"
      ? "text-blocking"
      : tone === "accent"
      ? "text-iris"
      : "text-bone";
  return (
    <div className="rounded-xl border border-line bg-panel p-4">
      <div className={`font-display text-4xl font-bold tabular-nums leading-none ${valueTone}`}>{value}</div>
      <div className="mt-2 font-label text-[11px] font-semibold uppercase text-ash">{label}</div>
      {note && <div className="mt-2 text-xs leading-5 text-bone/65">{note}</div>}
    </div>
  );
}

export function Modal({
  title,
  description,
  children,
  footer,
  onClose,
  wide = false,
  open = true,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
  open?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () =>
      Array.from(
        ref.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex="0"]'
        ) || []
      );
    (focusable()[0] || ref.current)?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
      if (e.key === "Tab") {
        const list = focusable();
        const first = list[0];
        const last = list[list.length - 1];
        if (!first) {
          e.preventDefault();
          return;
        }
        if (e.shiftKey && (document.activeElement === first || !ref.current?.contains(document.activeElement))) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = oldOverflow;
      previous?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="lv-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
      onMouseDown={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`relative max-h-[90vh] w-full overflow-y-auto rounded-2xl border border-line bg-panel shadow-2xl ${
          wide ? "max-w-5xl" : "max-w-2xl"
        }`}
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div aria-hidden="true" className="guides pointer-events-none absolute inset-0 opacity-35" />
        <div className="relative flex items-start justify-between gap-4 border-b border-line p-6">
          <div>
            <p className="font-label text-[11px] font-semibold uppercase text-iris">BrandLint · Workspace</p>
            <h2 id={titleId} className="mt-1 font-display text-2xl font-bold uppercase tracking-[-0.02em] text-bone">
              {title}
            </h2>
            {description && <p className="mt-1.5 text-sm leading-6 text-ash">{description}</p>}
          </div>
          <Button variant="ghost" onClick={onClose} aria-label="Close dialog">
            <Icon name="close" />
          </Button>
        </div>
        <div className="relative p-6">{children}</div>
        {footer && (
          <div className="relative flex flex-wrap justify-end gap-2.5 border-t border-line px-6 py-4">{footer}</div>
        )}
      </div>
    </div>
  );
}

export const errorText = (e: unknown) =>
  e instanceof Error ? e.message : "The request could not be completed. Please try again.";

export const formatDate = (v?: string | null) =>
  v
    ? new Date(
        v.length === 10 ? `${v}T00:00:00` : v.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(v) ? v : `${v}Z`
      ).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : "Not set";

export const percentage = (n?: number | null) =>
  n == null || !Number.isFinite(n) ? "—" : `${Math.round(n * 100)}%`;

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

export function IssueBadge({
  tier,
  value,
  className = "",
}: {
  tier?: IssueTier;
  value?: string | null;
  className?: string;
}) {
  const resolvedTier =
    tier ||
    (value === "critical" || value === "high" || value === "blocking" || value === "must_fix"
      ? "must_fix"
      : value === "medium" || value === "warning" || value === "major" || value === "needs_review"
      ? "needs_review"
      : "suggestion");

  if (resolvedTier === "must_fix") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded border border-blocking/55 bg-blocking/12 px-2 py-0.5 font-label text-[11px] font-semibold uppercase text-blocking ${className}`}
      >
        <span aria-hidden="true" className="size-2 shrink-0 rotate-45 bg-blocking" />
        Blocking
      </span>
    );
  }
  if (resolvedTier === "needs_review") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded border border-major/55 bg-major/12 px-2 py-0.5 font-label text-[11px] font-semibold uppercase text-major ${className}`}
      >
        <span aria-hidden="true" className="size-2 shrink-0 rotate-45 bg-major" />
        Needs review
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border border-minor/55 bg-minor/12 px-2 py-0.5 font-label text-[11px] font-semibold uppercase text-minor ${className}`}
    >
      <span aria-hidden="true" className="size-2 shrink-0 rotate-45 bg-minor" />
      Advisory
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
      className={`group rounded-xl border border-line bg-panel px-4 py-3 text-xs transition ${className}`}
      onToggle={e => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between rounded font-label text-xs font-semibold uppercase text-bone/80 hover:text-bone focus-visible:outline-none">
        <span>{displayTitle}</span>
        <Icon
          name="chevron"
          size={12}
          className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </summary>
      <div className="mt-2.5 space-y-1 border-t border-line pt-2 font-mono text-[11px] text-ash">{children}</div>
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
      <label htmlFor={htmlFor} className="flex items-center justify-between font-label text-xs font-semibold uppercase text-bone/85">
        <span>
          {label} {required && <span className="text-blocking">*</span>}
        </span>
        {hint && <span className="font-sans text-[11px] font-normal normal-case text-ash">{hint}</span>}
      </label>
      {children}
      {error && (
        <p className="text-xs text-blocking" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export interface FlowStep {
  icon: string;
  label: string;
  detail?: string;
  tone?: Tone;
}

const FLOW_TONE_RING: Record<Tone, string> = {
  neutral: "border-line text-ash bg-white/[0.03]",
  success: "border-mint/35 text-mint bg-mint/10",
  warning: "border-amber/35 text-amber bg-amber/10",
  danger: "border-coral/35 text-coral bg-coral/10",
  accent: "border-iris/35 text-iris bg-iris/10",
};

/** Compact horizontal diagram strip to replace multi-sentence workflow explanations. */
export function FlowDiagram({
  steps,
  className = "",
}: {
  steps: FlowStep[];
  className?: string;
}) {
  return (
    <div
      className={`flex flex-wrap items-center gap-2 rounded-xl border border-line bg-carbon/70 px-3.5 py-2.5 ${className}`}
    >
      {steps.map((step, idx) => {
        const tone = step.tone ?? "neutral";
        return (
          <React.Fragment key={`${step.label}-${idx}`}>
            <div className="flex items-center gap-2 rounded-lg border border-line/80 bg-panel/80 px-2.5 py-1.5">
              <span className={`flex size-6 shrink-0 items-center justify-center rounded-md border ${FLOW_TONE_RING[tone]}`}>
                <Icon name={step.icon} size={13} />
              </span>
              <div className="leading-tight">
                <div className="font-label text-[11px] font-semibold uppercase tracking-wide text-bone">
                  {step.label}
                </div>
                {step.detail && (
                  <div className="text-[11px] text-ash">{step.detail}</div>
                )}
              </div>
            </div>
            {idx < steps.length - 1 && (
              <Icon name="arrow" size={13} className="shrink-0 text-ash/70" />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export interface ShortLineItem {
  icon: string;
  label: string;
  value?: string;
  tone?: Tone;
}

/** Concise icon + short-line list used in place of descriptive prose blocks. */
export function CompactList({
  items,
  columns = 1,
  className = "",
}: {
  items: ShortLineItem[];
  columns?: 1 | 2 | 3;
  className?: string;
}) {
  const gridCls =
    columns === 3
      ? "grid gap-2.5 sm:grid-cols-3"
      : columns === 2
      ? "grid gap-2.5 sm:grid-cols-2"
      : "space-y-2";

  return (
    <div className={`${gridCls} ${className}`}>
      {items.map((item, idx) => {
        const tone = item.tone ?? "accent";
        return (
          <div
            key={`${item.label}-${idx}`}
            className="flex items-center gap-2.5 rounded-lg border border-line/75 bg-carbon/55 px-3 py-2"
          >
            <span className={`flex size-7 shrink-0 items-center justify-center rounded-md border ${FLOW_TONE_RING[tone]}`}>
              <Icon name={item.icon} size={14} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-bone">{item.label}</div>
              {item.value && <div className="truncate text-[11px] text-ash">{item.value}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

