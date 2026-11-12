import React, { useEffect, useRef, useState } from "react";
import {
  api,
  AppNotificationItem,
  DEMO_USERS,
  DraftDetail,
  DraftSummary,
  Passport,
  PrivacyInfo,
  RecallAlertItem,
  SetupProgress,
  UserInfo,
} from "../api";
import { AdImageScanner, AURA_GLOW_ADS } from "../components/AdImageScanner";
import { GovernanceOrbit } from "../components/GovernanceOrbit";
import { ProledXdrShowcase } from "../components/ProledXdrShowcase";
import { SectionMockup } from "../components/SectionMockup";
import {
  Badge,
  Button,
  CompactList,
  Empty,
  errorText,
  FlowDiagram,
  formatDate,
  Icon,
  Metric,
  Modal,
  Notice,
  Panel,
} from "../components/ui";

interface Props {
  brandId?: number;
  brandName?: string;
  companyId?: number | null;
  role?: string;
  user?: UserInfo | null;
  privacy?: PrivacyInfo | null;
  onOpenScreen: (screen: "library" | "review" | "vault" | "queue" | "insights") => void;
  onSwitchPersona?: (email: string) => void;
  onLaunchDraft: (draftId: number, persona?: string) => void;
  onLaunchStep: (stepIdx: number) => void;
}

const HERO_TOPICS = [
  {
    id: "scanner",
    pill: "Ad Image & Placement Scanner",
    eyebrow: "Computer Vision + OCR Engine",
    titleLine1: "Every Ad Claim Checked.",
    titleGradient: "Every Visual Placement",
    titleLine3: "Verified Before Launch.",
    subtitle: "Label OCR · Safe zones · Contrast score.",
    badgeText: "5 Brand Creatives Audited",
    primaryCta: "Scan Creative ↓",
    primaryAction: "scroll-scanner" as const,
  },
  {
    id: "aura-glow",
    pill: "Aura Glow Skincare Audit",
    eyebrow: "Featured Campaign Portfolio",
    titleLine1: "Spot Packaging Typos &",
    titleGradient: "Unbacked Guarantees",
    titleLine3: "In Milliseconds.",
    subtitle: "Bottle typos · Unqualified claims · Safe zones.",
    badgeText: "OCR + Safe Zones",
    primaryCta: "Explore 5 Ads ↓",
    primaryAction: "scroll-gallery" as const,
  },
  {
    id: "claims",
    pill: "5-Dimension Claim Checker",
    eyebrow: "Deterministic Rules + AI",
    titleLine1: "Never Ship An",
    titleGradient: "Unsupported Metric",
    titleLine3: "Or Prohibited Term.",
    subtitle: "5D verification · 1-click Evidence swaps.",
    badgeText: "94% Recall · 100% Quote Match",
    primaryCta: "Open Checker →",
    primaryAction: "open-review" as const,
  },
  {
    id: "vault",
    pill: "Evidence Vault Passports",
    eyebrow: "Versioned Passports · EV-1..4",
    titleLine1: "Anchor Every Claim",
    titleGradient: "To Verified Source",
    titleLine3: "Clinical Passports.",
    subtitle: "Live recall watch · Auto expiry alerts.",
    badgeText: "Automated Recall Watch",
    primaryCta: "View Passports →",
    primaryAction: "open-vault" as const,
  },
  {
    id: "approvals",
    pill: "Four-Eyes Sign-Off",
    eyebrow: "Enforced Four-Eyes Policy",
    titleLine1: "Authors Cannot",
    titleGradient: "Approve Their Own",
    titleLine3: "Campaign Drafts.",
    subtitle: "Independent sign-off · SHA-256 audit trail.",
    badgeText: "Mandatory Gate",
    primaryCta: "Open Queue →",
    primaryAction: "open-queue" as const,
  },
];

const MARQUEE_FINDINGS = [
  { sev: "bg-blocking", code: "CLAIM-01", quote: "“VISIBLE RESULTS GUARANTEED”", note: "Aura Glow #1 · EV-1 Required" },
  { sev: "bg-minor", code: "PRINT-01", quote: "“FACIAL SERUM / FACIAL SERUM”", note: "Bottle Label · Duplicate Print Typo" },
  { sev: "bg-minor", code: "DENSITY-34%", quote: "“THIS vs THAT”", note: "Crowded Text > 20% Meta Limit" },
  { sev: "bg-blocking", code: "TERM-01", quote: "“100% risk-free”", note: "Prohibited Absolute Guarantee" },
  { sev: "bg-blocking", code: "EV-2", quote: "“Zero-downtime SLA”", note: "Passport EV-2 Expired" },
  { sev: "bg-blocking", code: "CERT-03", quote: "“Sovereign cloud certified”", note: "SOC 2 Type II Only" },
];

const ROLE_STUDIO_TABS = [
  {
    key: "creator",
    email: DEMO_USERS[0].email,
    title: "Creator Studio",
    author: "Alex",
    avatar: "file",
    accent: "from-indigo-600/30 to-purple-600/10",
    badge: "Creator · Drafts & Auto-Fix",
    policy: "Draft creation, image scan, 1-click EV-1 wording swap & submit.",
  },
  {
    key: "reviewer",
    email: DEMO_USERS[1].email,
    title: "Reviewer Approvals Queue",
    author: "Samira",
    avatar: "review",
    accent: "from-emerald-600/30 to-teal-600/10",
    badge: "Four-Eyes Reviewer Gate",
    policy: "First-line peer sign-off. Author ≠ Reviewer strictly enforced.",
  },
  {
    key: "senior_reviewer",
    email: DEMO_USERS[2].email,
    title: "Senior & Legal Escalations",
    author: "Morgan",
    avatar: "shield",
    accent: "from-amber-600/30 to-orange-600/10",
    badge: "Legal & Regulatory Route",
    policy: "Escalated regulatory claims, financial guarantees, and overrides.",
  },
  {
    key: "brand_owner",
    email: DEMO_USERS[3].email,
    title: "Brand Owner Governance",
    author: "Olivia",
    avatar: "chart",
    accent: "from-sky-600/30 to-indigo-600/10",
    badge: "Rulebook & Guideline Health",
    policy: "Rules governance, Evidence Vault Passports lifecycle & audit log.",
  },
];

export const AppleIntro: React.FC<Props> = ({
  brandId,
  brandName,
  role = "creator",
  user,
  onOpenScreen,
  onSwitchPersona,
  onLaunchDraft,
  onLaunchStep,
}) => {
  const [setup, setSetup] = useState<SetupProgress | null>(null);
  const [drafts, setDrafts] = useState<DraftSummary[]>([]);
  const [queue, setQueue] = useState<DraftSummary[]>([]);
  const [passports, setPassports] = useState<Passport[]>([]);
  const [recallAlerts, setRecallAlerts] = useState<RecallAlertItem[]>([]);
  const [notifications, setNotifications] = useState<AppNotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Hero & Interactive States
  const [activeTopicIdx, setActiveTopicIdx] = useState(0);
  const activeTopic = HERO_TOPICS[activeTopicIdx] || HERO_TOPICS[0];
  const [heroAdIdx, setHeroAdIdx] = useState(0);
  const [selectedScannerAdId, setSelectedScannerAdId] = useState<string>(AURA_GLOW_ADS[0].id);

  // Dedicated Employee Drafts Studio Persona Tab
  const [selectedRoleKey, setSelectedRoleKey] = useState<string>(role || "creator");

  // Quick Review Modal
  const [reviewingDraft, setReviewingDraft] = useState<DraftDetail | null>(null);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState("");

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Scroll Reveal Observer ("Scroll to load as you scroll down")
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-revealed");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.05, rootMargin: "0px 0px -30px 0px" }
    );

    const observePending = () => {
      const elements = document.querySelectorAll(".reveal-on-scroll:not(.is-revealed)");
      elements.forEach(el => observer.observe(el));
    };

    observePending();

    // Re-check when dynamic data loads, tabs switch, or DOM updates
    const mutationObserver = new MutationObserver(() => {
      observePending();
    });
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    // Catch any elements immediately in viewport or rendered on hydration
    const timer = window.setTimeout(observePending, 100);

    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
      mutationObserver.disconnect();
    };
  }, []);

  // Progressive Scroll-Down Content Loading Animation Observer
  // "while loading scrolling down the website there must be the content loading animation like as we scroll down the content gets loaded"
  useEffect(() => {
    const contentObserver = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement;
            const delay = parseInt(el.dataset.delay || "0", 10);

            // 1. Kick off active holographic scan and shimmer
            window.setTimeout(() => {
              el.classList.add("is-loading");

              // 2. Resolve to fully loaded content with verification badge
              window.setTimeout(() => {
                el.classList.remove("is-loading");
                el.classList.add("is-loaded");
              }, 480);
            }, delay);

            contentObserver.unobserve(el);
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -30px 0px" }
    );

    const observeCards = () => {
      const cards = document.querySelectorAll<HTMLElement>(".scroll-load-card:not(.is-loaded):not(.is-loading)");
      cards.forEach(card => contentObserver.observe(card));
    };

    observeCards();

    // Re-observe when roles switch or dynamic lists change
    const t = window.setTimeout(observeCards, 80);

    return () => {
      window.clearTimeout(t);
      contentObserver.disconnect();
    };
  }, [selectedRoleKey, drafts.length, queue.length]);

  // Constellation Particle Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId = 0;
    let isVisible = true;
    let isScrolling = false;
    let scrollTimer: number | null = null;
    let width = (canvas.width = canvas.offsetWidth || 1200);
    let height = (canvas.height = canvas.offsetHeight || 600);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth || 1200;
      height = canvas.height = canvas.offsetHeight || 600;
    };
    window.addEventListener("resize", handleResize);

    // Pause canvas completely during scrolling to guarantee 60+ FPS scroll performance
    const handleScroll = () => {
      isScrolling = true;
      if (scrollTimer) clearTimeout(scrollTimer);
      scrollTimer = window.setTimeout(() => {
        isScrolling = false;
        if (isVisible && !animId) {
          animId = requestAnimationFrame(render);
        }
      }, 100);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });

    // Pause animation when out of view
    const observer = new IntersectionObserver(
      entries => {
        isVisible = entries[0]?.isIntersecting ?? false;
        if (isVisible && !animId && !isScrolling) {
          render();
        }
      },
      { threshold: 0.05 }
    );
    observer.observe(canvas);

    // 14 lightweight constellation nodes for minimal CPU usage
    const particles = Array.from({ length: 14 }, (_, i) => ({
      x: ((i * 137.5) % 100) * 0.01 * width,
      y: ((i * 73.1) % 100) * 0.01 * height,
      vx: (Math.sin(i * 1.7) * 0.22) || 0.1,
      vy: (Math.cos(i * 2.3) * 0.22) || 0.1,
      r: (i % 3) + 1.2,
      color: i % 2 === 0 ? "rgba(129, 140, 248, 0.7)" : "rgba(56, 189, 248, 0.65)",
    }));

    const render = () => {
      if (!isVisible || isScrolling) {
        animId = 0;
        return;
      }
      ctx.clearRect(0, 0, width, height);
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();

        for (let j = i + 1; j < particles.length; j++) {
          const q = particles[j];
          const dx = p.x - q.x;
          const dy = p.y - q.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < 14400) { // 120^2
            const dist = Math.sqrt(distSq);
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.strokeStyle = `rgba(129, 140, 248, ${(1 - dist / 120) * 0.18})`;
            ctx.lineWidth = 0.75;
            ctx.stroke();
          }
        }
      }
      animId = requestAnimationFrame(render);
    };
    render();

    return () => {
      if (animId) cancelAnimationFrame(animId);
      if (scrollTimer) clearTimeout(scrollTimer);
      observer.disconnect();
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const refreshAll = async () => {
    if (!brandId) return;
    try {
      const [setupRes, draftsRes, queueRes, evidenceRes, recallsRes, notifsRes] = await Promise.all([
        api.getSetup(brandId),
        api.listDrafts(brandId),
        api.getQueue(brandId),
        api.listEvidence(brandId),
        api.getRecallAlerts(brandId),
        api.getNotifications(brandId),
      ]);
      setSetup(setupRes);
      setDrafts(draftsRes);
      setQueue(queueRes);
      setPassports(evidenceRes);
      setRecallAlerts(recallsRes);
      setNotifications(notifsRes);
    } catch (e) {
      setError(errorText(e));
    }
  };

  useEffect(() => {
    let active = true;
    if (!brandId) return () => { active = false; };
    setLoading(true);

    Promise.allSettled([
      api.getSetup(brandId),
      api.listDrafts(brandId),
      api.getQueue(brandId),
      api.listEvidence(brandId),
      api.getRecallAlerts(brandId),
      api.getNotifications(brandId),
    ]).then(([s, d, q, ev, rec, notif]) => {
      if (!active) return;
      if (s.status === "fulfilled") setSetup(s.value);
      if (d.status === "fulfilled") setDrafts(d.value);
      if (q.status === "fulfilled") setQueue(q.value);
      if (ev.status === "fulfilled") setPassports(ev.value);
      if (rec.status === "fulfilled") setRecallAlerts(rec.value);
      if (notif.status === "fulfilled") setNotifications(notif.value);
      setLoading(false);
    });

    return () => { active = false; };
  }, [brandId]);

  const openQuickReview = async (draftId: number) => {
    if (!brandId) return;
    setReviewError("");
    setReviewComment("");
    try {
      const detail = await api.getDraft(brandId, draftId);
      setReviewingDraft(detail);
    } catch (e) {
      setError(errorText(e));
    }
  };

  const handleApproveDraft = async () => {
    if (!brandId || !reviewingDraft) return;
    if (reviewingDraft.author_id === user?.id) {
      setReviewError("Authors cannot approve their own drafts (Four-Eyes Gate).");
      return;
    }
    if (!reviewComment.trim()) {
      setReviewError("Review note is required.");
      return;
    }
    setReviewSubmitting(true);
    try {
      await api.approveDraft(brandId, reviewingDraft.id, reviewingDraft.revision_id, reviewComment.trim());
      setMessage(`Draft "${reviewingDraft.title}" approved.`);
      setReviewingDraft(null);
      await refreshAll();
    } catch (e) {
      setReviewError(errorText(e));
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleRequestChanges = async () => {
    if (!brandId || !reviewingDraft) return;
    if (!reviewComment.trim()) {
      setReviewError("Please explain what changes are requested.");
      return;
    }
    setReviewSubmitting(true);
    try {
      await api.requestChanges(brandId, reviewingDraft.id, reviewComment.trim());
      setMessage(`Changes requested on "${reviewingDraft.title}".`);
      setReviewingDraft(null);
      await refreshAll();
    } catch (e) {
      setReviewError(errorText(e));
    } finally {
      setReviewSubmitting(false);
    }
  };

  const jumpToScannerWithAd = (adId: string) => {
    setSelectedScannerAdId(adId);
    const el = document.getElementById("ad-image-scanner");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const liveDrafts = drafts.filter(d => !d.seeded);
  const pendingApprovals = queue.filter(d => d.status === "in_review" || d.status === "senior_review");
  const seniorQueue = queue.filter(d => d.status === "senior_review");
  const standardQueue = queue.filter(d => d.status === "in_review");

  const activeHeroAd = AURA_GLOW_ADS[heroAdIdx] || AURA_GLOW_ADS[0];
  const activeRoleConfig = ROLE_STUDIO_TABS.find(r => r.key === selectedRoleKey) || ROLE_STUDIO_TABS[0];

  return (
    <div className="space-y-14 pb-12">
      {/* =====================================================================
          1. INTERACTIVE CONSTELLATION HERO (Spotlight: #hero-scanner-preview)
         ===================================================================== */}
      <section
        id="hero-scanner-preview"
        className="relative -mx-4 -mt-6 overflow-hidden border-b border-white/10 bg-[#050508] px-4 pb-14 pt-6 sm:-mx-6 sm:px-6 sm:pb-16 sm:pt-8 lg:-mx-9 lg:px-9"
      >
        <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full opacity-85" />
        <div aria-hidden="true" style={{ background: "radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)" }} className="pointer-events-none absolute -left-20 top-6 h-80 w-80 rounded-full" />
        <div aria-hidden="true" style={{ background: "radial-gradient(circle, rgba(56,189,248,0.12) 0%, transparent 70%)" }} className="pointer-events-none absolute right-0 top-16 h-80 w-80 rounded-full" />

        <div className="relative mx-auto max-w-[1400px]">
          {/* Topic Switcher Pills */}
          <div className="mb-6 flex flex-wrap items-center gap-1.5 border-b border-white/10 pb-4">
            <span className="mr-1 inline-flex items-center gap-1.5 rounded-full border border-indigo-400/30 bg-indigo-500/10 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase text-indigo-300">
              <span className="size-1.5 rounded-full bg-indigo-400 animate-pulse" />
              Mode
            </span>
            {HERO_TOPICS.map((t, idx) => {
              const active = idx === activeTopicIdx;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTopicIdx(idx)}
                  className={`cursor-pointer rounded-full border px-3 py-1 font-sans text-xs font-medium transition-all ${
                    active
                      ? "border-indigo-400 bg-indigo-600/80 text-white shadow-[0_0_16px_rgba(99,102,241,0.4)]"
                      : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20 hover:text-white"
                  }`}
                >
                  {t.pill}
                </button>
              );
            })}
          </div>

          {/* Hero Split Grid */}
          <div className="grid items-center gap-8 lg:grid-cols-[1.1fr_1fr] lg:gap-10">
            {/* Left Column: Clean, high-impact headline & actions */}
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3.5 py-1 backdrop-blur-md">
                <span className="size-2 rounded-full bg-emerald-400" />
                <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-indigo-200">
                  {activeTopic.eyebrow}
                </span>
                <span className="rounded-full bg-white/10 px-2 py-0.5 font-mono text-[9px] text-sky-300">
                  {activeTopic.badgeText}
                </span>
              </div>

              <h1 className="font-sans text-[clamp(2.2rem,4.5vw,3.8rem)] font-extrabold leading-[1.05] tracking-tight text-white">
                <span>{activeTopic.titleLine1}</span>{" "}
                <span className="bg-gradient-to-r from-indigo-400 via-sky-400 to-purple-400 bg-clip-text text-transparent">
                  {activeTopic.titleGradient}
                </span>{" "}
                <span>{activeTopic.titleLine3}</span>
              </h1>

              <div className="flex items-center gap-2 text-xs font-medium text-slate-300 sm:text-sm">
                <Icon name="check" size={14} className="shrink-0 text-mint" />
                <span>{activeTopic.subtitle}</span>
              </div>

              {/* CTAs */}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    if (activeTopic.primaryAction === "scroll-scanner") {
                      jumpToScannerWithAd(activeHeroAd.id);
                    } else if (activeTopic.primaryAction === "scroll-gallery") {
                      document.getElementById("aura-glow-campaign-gallery")?.scrollIntoView({ behavior: "smooth" });
                    } else if (activeTopic.primaryAction === "open-review") {
                      onOpenScreen("review");
                    } else if (activeTopic.primaryAction === "open-vault") {
                      onOpenScreen("vault");
                    } else {
                      onOpenScreen("queue");
                    }
                  }}
                  className="cursor-pointer inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-500 px-6 py-2.5 font-sans text-xs font-bold text-white shadow-lg transition hover:scale-[1.02]"
                >
                  <span>{activeTopic.primaryCta}</span>
                </button>

                <button
                  type="button"
                  onClick={() => onOpenScreen("review")}
                  className="cursor-pointer inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.05] px-5 py-2.5 font-sans text-xs font-semibold text-white backdrop-blur-md transition hover:bg-white/[0.1]"
                >
                  <Icon name="file" size={13} />
                  <span>Draft Studio</span>
                </button>

                <button
                  type="button"
                  onClick={() => onLaunchStep(0)}
                  className="cursor-pointer inline-flex items-center gap-1.5 rounded-full border border-sky-400/30 bg-sky-500/10 px-4 py-2.5 font-mono text-[11px] font-semibold uppercase text-sky-300 transition hover:bg-sky-500/20"
                >
                  <Icon name="spark" size={12} />
                  <span>Guided Tour</span>
                </button>
              </div>

              {/* 4 Clean Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 reveal-stagger">
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-2.5 text-center">
                  <div className="font-mono text-base font-bold text-white">94%</div>
                  <div className="text-[10px] text-slate-400">Issue Recall</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-2.5 text-center">
                  <div className="font-mono text-base font-bold text-sky-400">5 Ads</div>
                  <div className="text-[10px] text-slate-400">Audited Live</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-2.5 text-center">
                  <div className="font-mono text-base font-bold text-emerald-400">100%</div>
                  <div className="text-[10px] text-slate-400">Citation Match</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-2.5 text-center">
                  <div className="font-mono text-base font-bold text-purple-400">4-Eyes</div>
                  <div className="text-[10px] text-slate-400">Sign-Off Gate</div>
                </div>
              </div>
            </div>

            {/* Right Column: Interactive 5-Ad Selector Preview Card */}
            <div id="hero-ad-card" className="reveal-on-scroll relative rounded-2xl border border-white/15 bg-[#0b0d16]/95 p-4 shadow-xl backdrop-blur-xl">
              <div className="mb-2.5 flex items-center justify-between border-b border-white/10 pb-2">
                <div className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-rose-500/80" />
                  <span className="size-2 rounded-full bg-amber-400/80" />
                  <span className="size-2 rounded-full bg-emerald-400/80" />
                  <span className="ml-1 font-mono text-[10px] uppercase text-slate-300">
                    Aura Glow · Packaging &amp; Ad Scan
                  </span>
                </div>
                <span className="font-mono text-[9px] text-emerald-400">● Live OCR Active</span>
              </div>

              {/* 5 Thumbnails */}
              <div className="mb-2.5 grid grid-cols-5 gap-1.5">
                {AURA_GLOW_ADS.map((ad, idx) => {
                  const active = idx === heroAdIdx;
                  return (
                    <button
                      key={ad.id}
                      type="button"
                      onClick={() => setHeroAdIdx(idx)}
                      className={`group relative cursor-pointer overflow-hidden rounded-lg border p-0.5 transition ${
                        active
                          ? "border-sky-400 bg-sky-500/20 ring-1 ring-sky-400"
                          : "border-white/10 bg-white/[0.02] opacity-70 hover:opacity-100"
                      }`}
                    >
                      <div className="aspect-[16/10] w-full overflow-hidden rounded bg-black">
                        <img src={ad.customImageUrl} alt="" className="h-full w-full object-cover" />
                      </div>
                      <p className="mt-0.5 truncate font-mono text-[8px] font-semibold text-white">
                        0{idx + 1}
                      </p>
                    </button>
                  );
                })}
              </div>

              {/* Dynamic Aspect Image Stage */}
              <div className="relative h-56 sm:h-64 w-full overflow-hidden rounded-xl border border-white/10 bg-[#07080d] flex items-center justify-center">
                {activeHeroAd.customImageUrl && (
                  <img
                    src={activeHeroAd.customImageUrl}
                    alt=""
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-20"
                  />
                )}
                <img
                  src={activeHeroAd.customImageUrl}
                  alt={activeHeroAd.name}
                  className="relative z-10 max-h-full max-w-full object-contain rounded"
                />

                {/* Bounding Box Highlights */}
                {activeHeroAd.regions.slice(0, 2).map(reg => {
                  const isBlocker = reg.status === "blocking";
                  return (
                    <div
                      key={reg.id}
                      style={{
                        top: `${reg.box.top}%`,
                        left: `${reg.box.left}%`,
                        width: `${reg.box.width}%`,
                        height: `${reg.box.height}%`,
                      }}
                      className={`absolute z-20 rounded-md border-2 transition ${
                        isBlocker ? "border-rose-500 bg-rose-500/20" : "border-amber-400 bg-amber-400/20"
                      }`}
                    >
                      <span
                        className={`inline-block px-1 py-0.5 font-mono text-[8px] font-bold uppercase ${
                          isBlocker ? "bg-rose-600 text-white" : "bg-amber-400 text-slate-950"
                        }`}
                      >
                        {reg.code}
                      </span>
                    </div>
                  );
                })}

                {/* Bottom Overlay Pill */}
                <div className="absolute inset-x-2.5 bottom-2.5 flex items-center justify-between rounded-lg border border-white/15 bg-black/80 px-2.5 py-1.5 backdrop-blur-md z-30">
                  <div className="truncate">
                    <span className="font-mono text-[9px] uppercase text-sky-400">
                      {activeHeroAd.channel}
                    </span>
                    <h2 className="truncate text-xs font-semibold text-white">{activeHeroAd.shortLabel}</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => jumpToScannerWithAd(activeHeroAd.id)}
                    className="cursor-pointer shrink-0 rounded-full bg-sky-400 px-2.5 py-1 font-mono text-[9px] font-bold uppercase text-slate-950 hover:bg-sky-300"
                  >
                    Inspect HUD ↓
                  </button>
                </div>
              </div>

              {/* Telemetry Chips */}
              <div className="mt-2.5 grid grid-cols-3 gap-1.5 text-center font-mono text-[10px]">
                <div className="rounded-lg border border-white/10 bg-white/[0.02] p-1.5">
                  <span className="text-slate-400">Text Density: </span>
                  <span className={activeHeroAd.textCoveragePct > 25 ? "text-amber-400 font-bold" : "text-emerald-400 font-bold"}>
                    {activeHeroAd.textCoveragePct}%
                  </span>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/[0.02] p-1.5">
                  <span className="text-slate-400">WCAG: </span>
                  <span className="text-sky-400 font-bold">{activeHeroAd.contrastRatio}:1</span>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/[0.02] p-1.5 truncate">
                  <span className="text-rose-400 font-bold">{activeHeroAd.regions[0]?.code}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          2. COMPACT MARQUEE TICKER
         ===================================================================== */}
      <section aria-label="Sample findings" className="reveal-on-scroll -mx-4 -mt-14 overflow-hidden border-b border-line bg-panel py-2.5 sm:-mx-6 lg:-mx-9">
        <div className="marquee flex w-max gap-8 whitespace-nowrap text-xs">
          {[...MARQUEE_FINDINGS, ...MARQUEE_FINDINGS].map((item, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className={`size-1.5 rotate-45 ${item.sev}`} />
              <span className="font-mono text-iris">{item.code}</span>
              <span className="text-bone">{item.quote}</span>
              <span className="text-ash">— {item.note}</span>
            </div>
          ))}
        </div>
      </section>

      {/* =====================================================================
          3. DEDICATED ROLE DRAFTS STUDIO (Spotlight: #role-drafts-studio)
             "for every employ like as a creator or owner or senior manager create the draft sections"
         ===================================================================== */}
      <section
        id="role-drafts-studio"
        aria-labelledby="role-studio-heading"
        className="reveal-on-scroll relative overflow-hidden rounded-3xl border border-line bg-panel p-6 sm:p-8"
      >
        <div id="role-studio-controls" className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-indigo-400/30 bg-indigo-500/10 px-3 py-0.5 font-mono text-[10px] font-semibold uppercase text-indigo-300">
              <span className="size-1.5 rounded-full bg-emerald-400" />
              Role-Based Draft Pipelines
            </div>
            <h2 id="role-studio-heading" className="mt-1 font-sans text-2xl font-extrabold text-bone sm:text-3xl">
              Workspace Drafts by Employee Role
            </h2>
          </div>

          {/* Role Tab Switcher */}
          <div className="flex flex-wrap items-center gap-1.5 rounded-full border border-white/10 bg-carbon p-1">
            {ROLE_STUDIO_TABS.map(tab => {
              const active = tab.key === selectedRoleKey;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setSelectedRoleKey(tab.key)}
                  className={`cursor-pointer rounded-full px-3.5 py-1.5 font-sans text-xs font-semibold transition ${
                    active
                      ? "bg-gradient-to-r from-indigo-600 to-sky-500 text-white shadow-md"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  {tab.title}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Role Viewport */}
        <div className="mt-5 space-y-5">
          {/* Role Header Banner */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-carbon/70 p-4">
            <div className="flex items-center gap-3">
              <span className="inline-flex size-9 items-center justify-center rounded-xl bg-white/[0.06] text-sky-400 ring-1 ring-white/10">
                <Icon name={activeRoleConfig.avatar} size={16} />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-sans text-base font-bold text-white">{activeRoleConfig.title}</h3>
                  <Badge tone="accent">{activeRoleConfig.author}</Badge>
                </div>
                <p className="text-xs text-ash">{activeRoleConfig.policy}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {onSwitchPersona && user?.email !== activeRoleConfig.email && (
                <button
                  type="button"
                  onClick={() => onSwitchPersona(activeRoleConfig.email)}
                  className="cursor-pointer rounded-full border border-indigo-400/40 bg-indigo-500/15 px-3 py-1 font-mono text-[11px] font-semibold text-indigo-300 hover:bg-indigo-500/25"
                >
                  Switch Persona to {activeRoleConfig.author} ↗
                </button>
              )}
              {selectedRoleKey === "creator" && (
                <button
                  type="button"
                  onClick={() => onOpenScreen("review")}
                  className="cursor-pointer rounded-full bg-white px-3.5 py-1 font-sans text-xs font-bold text-slate-950 hover:bg-slate-100"
                >
                  + New Draft Check
                </button>
              )}
            </div>
          </div>

          {/* DRAFTS LIST ACCORDING TO SELECTED ROLE */}
          {selectedRoleKey === "creator" && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 reveal-stagger">
              {liveDrafts.length > 0 ? (
                liveDrafts.map((d, idx) => (
                  <div
                    key={d.id}
                    data-delay={idx * 75}
                    className="scroll-load-card relative flex flex-col justify-between rounded-xl border border-line bg-carbon/60 p-4 transition hover:border-indigo-400/40"
                  >
                    <div className="scroll-load-hud">
                      <span className="load-badge-loading">
                        <span className="size-1.5 rounded-full bg-sky-400 animate-ping" />
                        SYNCING DRAFT...
                      </span>
                      <span className="load-badge-loaded">
                        <span className="size-1.5 rounded-full bg-emerald-400" />
                        DRAFT SYNCED ✓
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center justify-between">
                        <Badge tone={d.status === "approved" ? "success" : "neutral"}>
                          {d.status.replace(/_/g, " ")}
                        </Badge>
                        <span className="font-mono text-[10px] text-ash">Rev {d.revision}</span>
                      </div>
                      <h4 className="mt-2 font-semibold text-bone">{d.title}</h4>
                      <p className="mt-0.5 text-xs text-ash">{d.channel || "Ad / Landing Page"}</p>
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-xs">
                      <span className="font-mono text-[10px] text-ash">{formatDate(d.updated_at)}</span>
                      <button
                        type="button"
                        onClick={() => onLaunchDraft(d.id)}
                        className="cursor-pointer font-mono font-semibold text-iris hover:underline"
                      >
                        Edit in Studio →
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-full rounded-2xl border border-dashed border-line p-6 text-center text-xs text-ash">
                  <p>No active creator drafts yet.</p>
                  <button
                    type="button"
                    onClick={() => onOpenScreen("review")}
                    className="mt-2 font-mono text-iris underline"
                  >
                    Create or paste first draft in Check Content →
                  </button>
                </div>
              )}
            </div>
          )}

          {selectedRoleKey === "reviewer" && (
            <div className="space-y-2.5 reveal-stagger">
              {standardQueue.length > 0 ? (
                standardQueue.map((item, idx) => (
                  <div
                    key={item.id}
                    data-delay={idx * 75}
                    className="scroll-load-card relative flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-carbon/70 p-3.5 transition hover:border-emerald-400/40"
                  >
                    <div className="scroll-load-hud">
                      <span className="load-badge-loading">
                        <span className="size-1.5 rounded-full bg-sky-400 animate-ping" />
                        VERIFYING GATE...
                      </span>
                      <span className="load-badge-loaded">
                        <span className="size-1.5 rounded-full bg-emerald-400" />
                        GATE VERIFIED ✓
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-bone">{item.title}</span>
                        <Badge tone="accent">Standard Route</Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-ash">
                        Author: <strong>{item.author}</strong> · Channel: {item.channel} · Four-Eyes Gate Verified ✓
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openQuickReview(item.id)}
                        className="cursor-pointer rounded-full bg-emerald-500/15 border border-emerald-400/30 px-3 py-1 font-mono text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25"
                      >
                        Quick Review &amp; Sign-Off
                      </button>
                      <button
                        type="button"
                        onClick={() => onLaunchDraft(item.id)}
                        className="cursor-pointer font-mono text-xs text-ash hover:text-white"
                      >
                        Open Draft →
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-line p-6 text-center text-xs text-ash">
                  All standard drafts have been signed off. Review queue is clean ✓
                </div>
              )}
            </div>
          )}

          {selectedRoleKey === "senior_reviewer" && (
            <div className="space-y-2.5 reveal-stagger">
              {seniorQueue.length > 0 ? (
                seniorQueue.map((item, idx) => (
                  <div
                    key={item.id}
                    data-delay={idx * 75}
                    className="scroll-load-card relative flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-carbon/70 p-3.5"
                  >
                    <div className="scroll-load-hud">
                      <span className="load-badge-loading">
                        <span className="size-1.5 rounded-full bg-amber-400 animate-ping" />
                        LEGAL CHECK...
                      </span>
                      <span className="load-badge-loaded">
                        <span className="size-1.5 rounded-full bg-amber-400" />
                        LEGAL ESCALATED
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-bone">{item.title}</span>
                        <Badge tone="warning">Senior Route · Escalated Claim</Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-ash">
                        Unqualified guarantee / regulatory claim requires legal sign-off before publishing.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openQuickReview(item.id)}
                        className="cursor-pointer rounded-full bg-amber-500/20 border border-amber-400/40 px-3 py-1 font-mono text-xs font-semibold text-amber-300 hover:bg-amber-500/30"
                      >
                        Legal Review &amp; Clearance
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-line p-6 text-center text-xs text-ash">
                  No escalated regulatory or legal blockers waiting. All claims supported.
                </div>
              )}
            </div>
          )}

          {selectedRoleKey === "brand_owner" && (
            <div className="grid gap-3 sm:grid-cols-3 text-xs reveal-stagger">
              <div data-delay={0} className="scroll-load-card rounded-xl border border-line bg-carbon/70 p-4">
                <span className="font-mono text-[10px] uppercase text-iris">Active Rules</span>
                <p className="mt-1 font-sans text-2xl font-bold text-bone">
                  {setup?.stats.active_rules_count ?? 18}
                </p>
                <p className="mt-1 text-ash">Deterministic brand term &amp; tone guardrails.</p>
                <button
                  type="button"
                  onClick={() => onOpenScreen("library")}
                  className="mt-3 font-mono font-semibold text-iris hover:underline block"
                >
                  Manage Rulebook →
                </button>
              </div>

              <div data-delay={80} className="scroll-load-card rounded-xl border border-line bg-carbon/70 p-4">
                <span className="font-mono text-[10px] uppercase text-emerald-400">Approved Facts</span>
                <p className="mt-1 font-sans text-2xl font-bold text-bone">
                  {setup?.stats.approved_evidence_count ?? 4} Passports
                </p>
                <p className="mt-1 text-ash">EV-1..4 clinical studies &amp; benchmarks.</p>
                <button
                  type="button"
                  onClick={() => onOpenScreen("vault")}
                  className="mt-3 font-mono font-semibold text-emerald-400 hover:underline block"
                >
                  Evidence Vault →
                </button>
              </div>

              <div data-delay={160} className="scroll-load-card rounded-xl border border-line bg-carbon/70 p-4">
                <span className="font-mono text-[10px] uppercase text-sky-400">Guideline Health</span>
                <p className="mt-1 font-sans text-2xl font-bold text-bone">94% Precision</p>
                <p className="mt-1 text-ash">Zero rule friction on approved copy.</p>
                <button
                  type="button"
                  onClick={() => onOpenScreen("insights")}
                  className="mt-3 font-mono font-semibold text-sky-400 hover:underline block"
                >
                  View Benchmarks →
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* =====================================================================
          4. AI AD IMAGE, COPY & PLACEMENT SCANNER (Spotlight: #ad-image-scanner)
             Flexible with ALL image aspect ratios
         ===================================================================== */}
      <div id="ad-image-scanner" className="reveal-on-scroll">
        <AdImageScanner
          brandId={brandId}
          brandName={brandName}
          initialAdId={selectedScannerAdId}
          onOpenDraftInChecker={draftId => onLaunchDraft(draftId)}
        />
      </div>

      {/* =====================================================================
          5. AURA GLOW 5-IMAGE BRAND CAMPAIGN GALLERY
         ===================================================================== */}
      <section
        id="aura-glow-campaign-gallery"
        aria-labelledby="campaign-gallery-heading"
        className="reveal-on-scroll relative overflow-hidden rounded-3xl border border-line bg-panel p-6 sm:p-8"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-0.5 font-mono text-[10px] font-semibold uppercase text-sky-300">
              Campaign Portfolio · 5 Creatives
            </div>
            <h2 id="campaign-gallery-heading" className="mt-1 font-sans text-2xl font-extrabold text-bone sm:text-3xl">
              Aura Glow Skincare Creatives
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onOpenScreen("review")}
            className="cursor-pointer rounded-full border border-line bg-carbon px-4 py-1.5 font-mono text-xs font-semibold text-bone hover:border-iris hover:text-iris"
          >
            Check Copy in Studio →
          </button>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 reveal-stagger">
          {AURA_GLOW_ADS.map((ad, idx) => {
            const hasBlocker = ad.regions.some(r => r.status === "blocking");
            return (
              <div
                key={ad.id}
                data-delay={idx * 100}
                className="scroll-load-card group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-line bg-carbon/75 transition-all duration-300 hover:-translate-y-1 hover:border-indigo-400/50"
              >
                {/* Interactive Scroll-Loading HUD Badge */}
                <div className="scroll-load-hud">
                  <span className="load-badge-loading">
                    <span className="size-1.5 rounded-full bg-sky-400 animate-ping" />
                    STREAMING AD 0{idx + 1}...
                  </span>
                  <span className="load-badge-loaded">
                    <span className="size-1.5 rounded-full bg-emerald-400" />
                    AD 0{idx + 1} VERIFIED ✓
                  </span>
                </div>
                <div>
                  {/* Flexible Image Container */}
                  <div className="relative h-48 w-full overflow-hidden bg-[#06070a] flex items-center justify-center">
                    {ad.customImageUrl && (
                      <img
                        src={ad.customImageUrl}
                        alt=""
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-20"
                      />
                    )}
                    <img
                      src={ad.customImageUrl}
                      alt={ad.name}
                      className="relative z-10 max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="absolute left-2.5 top-2.5 z-20 flex gap-1">
                      <span className="rounded-full bg-black/80 px-2 py-0.5 font-mono text-[9px] font-bold text-white">
                        {ad.channel}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 font-mono text-[9px] font-bold ${
                          hasBlocker ? "bg-rose-500/20 text-rose-300 border border-rose-500/40" : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                        }`}
                      >
                        {hasBlocker ? "Blocker" : "Clear ✓"}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 space-y-2">
                    <h3 className="font-sans text-sm font-bold text-bone truncate">{ad.name}</h3>
                    <p className="text-xs text-ash line-clamp-2">{ad.subline}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-line bg-panel/40 px-4 py-2.5 text-xs font-mono">
                  <span className="text-ash">{ad.textCoveragePct}% Density</span>
                  <button
                    type="button"
                    onClick={() => jumpToScannerWithAd(ad.id)}
                    className="cursor-pointer text-iris font-semibold hover:underline"
                  >
                    Inspect in HUD ↑
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* =====================================================================
          6. KEYNOTE ARCHITECTURE MOCKUP & TANDEM VERIFICATION SHOWCASE
         ===================================================================== */}
      <section aria-label="Keynote governance architecture" className="reveal-on-scroll py-2">
        <Panel className="p-6 sm:p-8">
          <div className="grid gap-8 lg:grid-cols-12 lg:items-center">
            <div className="space-y-5 lg:col-span-7">
              <div>
                <div className="lv-eyebrow mb-2">
                  <Icon name="spark" size={14} /> KEYNOTE · GOVERNANCE ENGINE
                </div>
                <h2 className="font-display text-2xl font-bold uppercase tracking-tight text-bone sm:text-3xl">
                  From raw copy to verified sign-off.
                </h2>
              </div>

              <FlowDiagram
                steps={[
                  { icon: "book", label: "Rules", detail: "Page-pinned", tone: "accent" },
                  { icon: "shield", label: "Passports", detail: "Dated proof", tone: "success" },
                  { icon: "search", label: "5D Check", detail: "Text & Ad", tone: "warning" },
                  { icon: "lock", label: "4-Eyes", detail: "Signed", tone: "success" },
                ]}
              />

              <CompactList
                columns={3}
                items={[
                  { icon: "file", label: "Cited Spans", value: "PDF page + offset", tone: "accent" },
                  { icon: "radar", label: "Recall Watch", value: "Expiry flagged live", tone: "danger" },
                  { icon: "users", label: "Role Gate", value: "Zero self-approvals", tone: "success" },
                ]}
              />
            </div>

            <div className="lg:col-span-5">
              <SectionMockup variant="keynote" />
            </div>
          </div>
        </Panel>
      </section>

      <div className="reveal-on-scroll -mx-4 sm:-mx-6 lg:-mx-9">
        <ProledXdrShowcase
          onTryChecker={() => onOpenScreen("review")}
          onOpenVault={() => onOpenScreen("vault")}
        />
      </div>

      {error && <Notice tone="danger">{error}</Notice>}
      {message && <Notice tone="success">{message}</Notice>}

      {/* Recall Alerts */}
      {recallAlerts.length > 0 && (
        <section aria-labelledby="recall-alerts-heading" className="reveal-on-scroll">
          <Panel className="rounded-2xl border-blocking/50 bg-blocking/[0.07] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="font-mono text-xs font-bold text-blocking uppercase">
                  ⚠ Claim Watch · {recallAlerts.length} Content Item(s) Need Revalidation
                </span>
                <p className="text-xs text-ash">Underlying Evidence Passports have expired or been updated.</p>
              </div>
              <Button variant="primary" className="!text-xs" onClick={() => onOpenScreen("queue")}>
                Review in Approvals →
              </Button>
            </div>
          </Panel>
        </section>
      )}

      {/* =====================================================================
          7. EVIDENCE VAULT & LIVE DESK (Spotlight: #evidence-vault-desk)
         ===================================================================== */}
      <section
        id="evidence-vault-desk"
        aria-label="Workspace overview"
        className="reveal-on-scroll space-y-5"
      >
        <div id="vault-metrics-grid" className="grid grid-cols-2 gap-3 sm:grid-cols-4 reveal-stagger">
          <div data-delay={0} className="scroll-load-card">
            <Metric label="Active rules" value={setup?.stats.active_rules_count ?? "18"} note="Brand rulebook" />
          </div>
          <div data-delay={70} className="scroll-load-card">
            <Metric label="Approved facts" value={setup?.stats.approved_evidence_count ?? "4"} note="Evidence Vault" tone="accent" />
          </div>
          <div data-delay={140} className="scroll-load-card">
            <Metric label="Waiting for review" value={pendingApprovals.length} note="Four-Eyes Queue" tone={pendingApprovals.length > 0 ? "warning" : "success"} />
          </div>
          <div data-delay={210} className="scroll-load-card">
            <Metric label="Evidence alerts" value={recallAlerts.length} note="Expired studies" tone={recallAlerts.length > 0 ? "danger" : "success"} />
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr] reveal-stagger">
          <Panel className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-mono text-xs uppercase text-iris">Review Queue</span>
              <button
                type="button"
                onClick={() => onOpenScreen("queue")}
                className="font-mono text-xs text-ash hover:text-white"
              >
                Open Full Queue →
              </button>
            </div>

            {loading ? (
              <p className="text-xs text-ash">Loading queue…</p>
            ) : pendingApprovals.length > 0 ? (
              <div className="space-y-2">
                {pendingApprovals.slice(0, 3).map(item => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-line bg-carbon/70 p-3 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-bone truncate">{item.title}</div>
                      <div className="text-ash font-mono text-[10px]">{item.author} · {item.channel}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => openQuickReview(item.id)}
                      className="cursor-pointer shrink-0 rounded-full bg-white/10 px-3 py-1 font-mono text-[11px] font-semibold text-bone hover:bg-white/20"
                    >
                      Quick Review
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <Empty title="Queue is clean">No drafts waiting for review.</Empty>
            )}
          </Panel>

          <Panel className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs uppercase text-emerald-400">Evidence Vault</span>
                {notifications.length > 0 && (
                  <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 font-mono text-[10px] text-indigo-300">
                    {notifications.length} alerts
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => onOpenScreen("vault")}
                className="font-mono text-xs text-ash hover:text-white"
              >
                All Facts →
              </button>
            </div>

            <div className="space-y-2">
              {passports.slice(0, 3).map(p => (
                <div key={p.id} className="rounded-xl border border-line bg-carbon/70 p-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-iris">{p.ref}</span>
                    <Badge tone={p.state === "current" ? "success" : "warning"}>{p.state}</Badge>
                  </div>
                  <p className="mt-1 font-medium text-bone truncate">“{p.claim_text}”</p>
                  <p className="text-[10px] text-ash font-mono">{p.document.title} (p.{p.page})</p>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </section>

      {/* Quick Review Modal */}
      {reviewingDraft && (
        <Modal title={`Review Draft: ${reviewingDraft.title}`} onClose={() => setReviewingDraft(null)} wide>
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
              <div>
                <h3 className="font-sans text-lg font-bold text-bone">{reviewingDraft.title}</h3>
                <p className="text-xs text-ash">
                  Author: {reviewingDraft.author} · Rev {reviewingDraft.revision}
                </p>
              </div>
              <Badge tone={reviewingDraft.blockers.length > 0 ? "danger" : "success"}>
                {reviewingDraft.blockers.length} Blocker(s)
              </Badge>
            </div>

            {reviewError && <Notice tone="danger">{reviewError}</Notice>}

            <div className="paper rounded-xl p-4">
              <span className="font-mono text-[10px] uppercase text-ink/70 block mb-1">Submitted Copy</span>
              <p className="text-sm leading-relaxed text-ink">{reviewingDraft.text}</p>
            </div>

            <label className="block font-mono text-xs uppercase text-bone">
              Review Decision Note
              <textarea
                rows={2}
                className="lv-input mt-1 w-full text-xs"
                placeholder="Leave review notes…"
                value={reviewComment}
                onChange={e => setReviewComment(e.target.value)}
              />
            </label>

            <div className="flex items-center justify-between pt-2">
              <div className="flex gap-2">
                <Button variant="primary" disabled={reviewSubmitting || reviewingDraft.author_id === user?.id} onClick={handleApproveDraft}>
                  {reviewSubmitting ? "Approving…" : "Approve & Sign Off"}
                </Button>
                <Button variant="danger" disabled={reviewSubmitting} onClick={handleRequestChanges}>
                  Request Changes
                </Button>
              </div>
              {reviewingDraft.author_id === user?.id && (
                <span className="text-xs text-major">Self-approval prevented (Four-Eyes Gate).</span>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Orbit Architecture */}
      <div className="reveal-on-scroll">
        <GovernanceOrbit mode="hero" activeScreen="intro" onNavigate={onOpenScreen} />
      </div>
    </div>
  );
};
