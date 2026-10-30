import React, { useEffect, useState } from "react";
import {
  api,
  AppNotificationItem,
  DraftDetail,
  DraftSummary,
  Passport,
  PrivacyInfo,
  RecallAlertItem,
  SetupProgress,
  UserInfo,
} from "../api";
import { GovernanceOrbit } from "../components/GovernanceOrbit";
import { GuidedSetupModal } from "../components/GuidedSetupModal";
import {
  Badge,
  Button,
  Empty,
  errorText,
  formatDate,
  Icon,
  Modal,
  Notice,
  Panel,
} from "../components/ui";

interface Props {
  brandId?: number;
  companyId?: number | null;
  role?: string;
  user?: UserInfo | null;
  privacy?: PrivacyInfo | null;
  onOpenScreen: (screen: "library" | "review" | "vault" | "queue" | "insights") => void;
  onLaunchDraft: (draftId: number, persona?: string) => void;
  onLaunchStep: (stepIdx: number) => void;
}

export const AppleIntro: React.FC<Props> = ({
  brandId,
  companyId,
  role = "creator",
  user,
  privacy,
  onOpenScreen,
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

  // Modals
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [reviewingDraft, setReviewingDraft] = useState<DraftDetail | null>(null);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState("");

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
    setError("");

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
      if ([s, d, q, ev].some(r => r.status === "rejected")) {
        setError("Some workspace data could not be loaded. Please refresh.");
      }
      setLoading(false);
    });

    return () => { active = false; };
  }, [brandId]);

  // Handle Quick Review from Home Screen
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
      setReviewError("Authors cannot approve their own drafts. Waiting for an independent teammate.");
      return;
    }
    if (!reviewComment.trim()) {
      setReviewError("A review comment is required before signing off.");
      return;
    }
    setReviewSubmitting(true);
    setReviewError("");
    try {
      await api.approveDraft(brandId, reviewingDraft.id, reviewingDraft.revision_id, reviewComment.trim());
      setMessage(`Draft "${reviewingDraft.title}" approved successfully!`);
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
    setReviewError("");
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

  const handleDismissSetup = async () => {
    if (!brandId) return;
    try {
      await api.dismissSetup(brandId);
      if (setup) setSetup({ ...setup, dismissed: true });
    } catch (e) {
      setError(errorText(e));
    }
  };

  const handleResumeSetup = async () => {
    if (!brandId) return;
    try {
      const updated = await api.resumeSetup(brandId);
      setSetup(updated);
      setShowSetupModal(true);
    } catch (e) {
      setError(errorText(e));
    }
  };

  // Partition real vs seeded drafts
  const liveDrafts = drafts.filter(d => !d.seeded);
  const sampleDrafts = drafts.filter(d => d.seeded);

  // Pending approvals
  const pendingApprovals = queue.filter(
    d => d.status === "in_review" || d.status === "senior_review"
  );

  // Evidence needing attention
  const now = new Date();
  const thirtyDaysOut = new Date(now.getTime() + 30 * 86400 * 1000);
  const evidenceNeedingAttention = passports.filter(p => {
    if (p.state === "expired" || p.state === "pending" || p.state === "rejected") return true;
    if (p.valid_until) {
      const exp = new Date(p.valid_until);
      if (exp <= thirtyDaysOut) return true;
    }
    return false;
  });

  return (
    <div className="space-y-10 pb-8 sm:space-y-12">
      {/* 1. Header / Workspace Overview */}
      <section className="flex flex-wrap items-end justify-between gap-6 border-b border-line/60 pb-8 pt-2">
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2.5">
            <Badge tone="accent">
              <Icon name="spark" size={12} /> HOME DESK
            </Badge>
            <Badge>{role.replace(/_/g, " ")}</Badge>
            {privacy && (
              <Badge tone={privacy.hosted ? "success" : "neutral"}>
                {privacy.hosted ? "Live AI" : "Offline Verifier"}
              </Badge>
            )}
          </div>
          <h1 className="font-display text-4xl font-medium tracking-tight text-ink sm:text-5xl">
            Welcome back, <span className="lv-gradient-text">{user?.name || "Colleague"}</span>.
          </h1>
          <p className="lv-muted mt-3 max-w-xl text-base leading-7">
            Your brand governance desk. Check marketing drafts, review team submissions, and monitor approved factual evidence.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" onClick={() => onOpenScreen("review")}>
            + Check content <Icon name="arrow" size={15} />
          </Button>
          <Button onClick={() => onLaunchStep(0)}>
            <Icon name="review" size={15} /> Interactive tour
          </Button>
        </div>
      </section>

      {error && <Notice tone="danger">{error}</Notice>}
      {message && <Notice tone="success">{message}</Notice>}

      {/* Evidence Recall Alerts Banner */}
      {recallAlerts.length > 0 && (
        <section aria-labelledby="recall-alerts-heading">
          <Panel className="border-rose-500/40 bg-rose-500/[0.06] p-6 rounded-2xl">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge tone="danger">Evidence Recall Alert</Badge>
                  <span className="font-semibold text-rose-300 text-sm">
                    {recallAlerts.length} content item{recallAlerts.length === 1 ? "" : "s"} require revalidation
                  </span>
                </div>
                <p className="text-xs text-muted">
                  Underlying facts or brand guidelines have been updated or revoked. Affected content has been flagged for human re-check.
                </p>
              </div>
              <Button variant="primary" className="!text-xs" onClick={() => onOpenScreen("queue")}>
                View all in Approvals →
              </Button>
            </div>
            <div className="space-y-2.5">
              {recallAlerts.map(alert => (
                <div key={alert.draft_id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-500/20 bg-rose-500/[0.04] p-3 text-xs">
                  <div>
                    <h3 className="font-medium text-ink">{alert.title}</h3>
                    <p className="text-muted text-[11px] mt-0.5">{alert.recall_reason}</p>
                  </div>
                  <Button
                    variant="secondary"
                    className="!min-h-7 !px-2.5 !py-1 !text-xs"
                    onClick={() => onLaunchDraft(alert.draft_id)}
                  >
                    Inspect &amp; Re-check →
                  </Button>
                </div>
              ))}
            </div>
          </Panel>
        </section>
      )}

      {/* 2. Resumable Setup Progress Card */}
      {setup && !setup.dismissed && (
        <section aria-labelledby="setup-progress-heading">
          <Panel className="relative overflow-hidden p-6 sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="lv-eyebrow mb-2">SETUP &amp; ONBOARDING</div>
                <h2 id="setup-progress-heading" className="font-display text-2xl font-medium text-ink">
                  {setup.is_completed ? "Workspace setup complete" : `${setup.progress_pct}% setup complete`}
                </h2>
                <p className="lv-muted mt-1.5 text-xs">
                  {setup.completed_count} of {setup.total_steps} milestones reached · Progress is saved server-side and survives refresh
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button variant="primary" onClick={() => setShowSetupModal(true)}>
                  {setup.is_completed ? "Review setup guide" : "Resume setup"} <Icon name="arrow" size={14} />
                </Button>
                <Button variant="ghost" onClick={handleDismissSetup} aria-label="Dismiss setup card">
                  Dismiss
                </Button>
              </div>
            </div>

            {/* Server-reported Progress Bar */}
            <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-line/60">
              <div
                className="h-full rounded-full bg-violet-400 transition-all duration-300"
                style={{ width: `${Math.max(6, setup.progress_pct)}%` }}
              />
            </div>

            {/* Role-aware Task Highlight */}
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-violet-400/20 bg-violet-400/[0.04] p-4 text-xs">
              <div className="flex items-center gap-2.5">
                <span className="font-semibold text-ink">Next task for your role:</span>
                <span className="text-muted">{setup.role_task.description}</span>
              </div>
              {setup.role_task.can_act && (
                <Button
                  variant="secondary"
                  className="!min-h-7 !px-3 !py-1 !text-xs"
                  onClick={() => {
                    if (setup.role_task.target === "review") onOpenScreen("review");
                    else if (setup.role_task.target === "library") onOpenScreen("library");
                    else if (setup.role_task.target === "queue") onOpenScreen("queue");
                    else setShowSetupModal(true);
                  }}
                >
                  {setup.role_task.action_label} →
                </Button>
              )}
            </div>

            {/* Checklist Step Pills */}
            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {setup.steps.map((s, idx) => (
                <div
                  key={s.id}
                  className={`flex items-center gap-2 rounded-lg border p-2.5 text-xs transition ${
                    s.completed
                      ? "border-emerald-500/20 bg-emerald-500/[0.04] text-emerald-400"
                      : "border-line/60 bg-well/40 text-muted"
                  }`}
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                      s.completed ? "bg-emerald-500/20 text-emerald-300" : "bg-line text-muted"
                    }`}
                  >
                    {s.completed ? "✓" : idx + 1}
                  </span>
                  <span className="truncate text-[11px] font-medium">{s.title}</span>
                </div>
              ))}
            </div>
          </Panel>
        </section>
      )}

      {/* Dismissed setup bar */}
      {setup && setup.dismissed && !setup.is_completed && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-well/30 px-5 py-3 text-xs text-muted">
          <span>
            Workspace setup is <strong>{setup.progress_pct}% complete</strong> ({setup.completed_count} of 6 steps).
          </span>
          <Button variant="ghost" className="!min-h-7 !px-3 !py-1 !text-xs" onClick={handleResumeSetup}>
            Resume setup guide →
          </Button>
        </div>
      )}

      {/* 3. Main Operational Sections (Pending Approvals & Recent Drafts) */}
      <div className="grid items-start gap-8 lg:grid-cols-3">
        {/* Left Column (2 Cols): Pending Approvals & Recent Drafts */}
        <div className="space-y-8 lg:col-span-2">
          {/* Pending Approvals Section */}
          <section aria-labelledby="pending-approvals-heading">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="lv-eyebrow mb-1">TEAM GOVERNANCE</div>
                <h2 id="pending-approvals-heading" className="font-display text-xl font-medium text-ink">
                  Pending approvals ({pendingApprovals.length})
                </h2>
              </div>
              <Button variant="ghost" className="!text-xs" onClick={() => onOpenScreen("queue")}>
                View all in Approvals →
              </Button>
            </div>

            {loading ? (
              <Panel className="p-8">
                <p className="lv-muted" role="status">Loading approval queue…</p>
              </Panel>
            ) : pendingApprovals.length > 0 ? (
              <div className="space-y-3">
                {pendingApprovals.map(d => (
                  <Panel key={d.id} className="p-5 transition hover:border-violet-400/30">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <Badge tone={d.status === "senior_review" ? "warning" : "neutral"}>
                            {d.status === "senior_review" ? "Senior reviewer required" : "Standard review"}
                          </Badge>
                          <Badge>{d.channel || "Promotional"}</Badge>
                          <span className="lv-muted font-mono text-[11px]">Rev {d.revision}</span>
                        </div>
                        <h3 className="font-display text-base font-semibold text-ink">{d.title}</h3>
                        <p className="lv-muted mt-1 text-xs">
                          Submitted by <strong className="text-ink">{d.author}</strong> · Updated {formatDate(d.updated_at)}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant="primary"
                          className="!min-h-8 !px-3.5 !py-1 !text-xs"
                          onClick={() => openQuickReview(d.id)}
                        >
                          Review &amp; sign off <Icon name="arrow" size={13} />
                        </Button>
                      </div>
                    </div>
                  </Panel>
                ))}
              </div>
            ) : (
              <Empty title="No drafts awaiting approval">
                When teammates submit promotional content for review, approval requests appear here for independent sign-off.
              </Empty>
            )}
          </section>

          {/* User's Recent Live Drafts */}
          <section aria-labelledby="recent-drafts-heading">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="lv-eyebrow mb-1">CONTENT STUDIO</div>
                <h2 id="recent-drafts-heading" className="font-display text-xl font-medium text-ink">
                  Recent drafts ({liveDrafts.length})
                </h2>
              </div>
              <Button variant="ghost" className="!text-xs" onClick={() => onOpenScreen("review")}>
                Open Check content desk →
              </Button>
            </div>

            {loading ? (
              <Panel className="p-8">
                <p className="lv-muted" role="status">Loading drafts…</p>
              </Panel>
            ) : liveDrafts.length > 0 ? (
              <div className="space-y-3">
                {liveDrafts.map(d => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => onLaunchDraft(d.id)}
                    className="flex w-full flex-wrap items-center justify-between gap-4 rounded-2xl border border-line/70 bg-well/40 p-4 text-left transition hover:border-violet-400/40 hover:bg-well"
                  >
                    <div>
                      <div className="mb-1.5 flex flex-wrap items-center gap-2">
                        <Badge tone={d.status === "approved" ? "success" : "neutral"}>
                          {d.status.replace(/_/g, " ")}
                        </Badge>
                        <Badge>{d.channel || "Draft"}</Badge>
                        <span className="lv-muted font-mono text-[11px]">Rev {d.revision}</span>
                      </div>
                      <h3 className="text-sm font-semibold text-ink">{d.title}</h3>
                      <p className="lv-muted mt-1 text-[11px]">
                        By {d.author} · Updated {formatDate(d.updated_at)}
                      </p>
                    </div>
                    <span className="lv-text-accent text-xs">Inspect findings →</span>
                  </button>
                ))}
              </div>
            ) : (
              <Empty title="No company drafts yet">
                Start by checking your first draft against brand rules and approved facts.
                <div className="mt-3">
                  <Button variant="primary" onClick={() => onOpenScreen("review")}>
                    + Check new content
                  </Button>
                </div>
              </Empty>
            )}
          </section>
        </div>

        {/* Right Column: Evidence Needing Attention & Stats */}
        <div className="space-y-8">
          {/* Evidence Needing Attention */}
          <section aria-labelledby="evidence-attention-heading">
            <div className="mb-4">
              <div className="lv-eyebrow mb-1">EVIDENCE AUDIT</div>
              <h2 id="evidence-attention-heading" className="font-display text-xl font-medium text-ink">
                Evidence attention ({evidenceNeedingAttention.length})
              </h2>
            </div>

            {evidenceNeedingAttention.length > 0 ? (
              <div className="space-y-3">
                {evidenceNeedingAttention.map(p => (
                  <Panel key={p.id} className="p-4 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold text-ink">{p.ref}</span>
                      <Badge
                        tone={
                          p.state === "expired" || p.state === "rejected"
                            ? "danger"
                            : p.state === "pending"
                            ? "warning"
                            : "neutral"
                        }
                      >
                        {p.state.replace(/_/g, " ")}
                      </Badge>
                    </div>
                    <p className="text-xs leading-5 text-ink font-medium">“{p.claim_text}”</p>
                    <p className="lv-muted text-[11px]">
                      Source: {p.document.title} (p.{p.page})
                      {p.valid_until && ` · Expires ${formatDate(p.valid_until)}`}
                    </p>
                    <Button
                      variant="ghost"
                      className="!min-h-6 !p-0 !text-[11px]"
                      onClick={() => onOpenScreen("vault")}
                    >
                      Inspect in Approved facts →
                    </Button>
                  </Panel>
                ))}
              </div>
            ) : (
              <Empty title="Evidence is current">
                All approved claim statements have valid source references. No passports currently require renewal.
              </Empty>
            )}
          </section>

          {/* Quick Metrics */}
          <Panel className="p-5 space-y-4">
            <div className="lv-eyebrow">WORKSPACE SNAPSHOT</div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl border border-line/60 bg-well/50 p-3">
                <span className="lv-muted">Active rules</span>
                <div className="font-display text-2xl font-semibold text-ink mt-1">
                  {setup?.stats.active_rules_count ?? "—"}
                </div>
              </div>
              <div className="rounded-xl border border-line/60 bg-well/50 p-3">
                <span className="lv-muted">Approved facts</span>
                <div className="font-display text-2xl font-semibold text-ink mt-1">
                  {setup?.stats.approved_evidence_count ?? "—"}
                </div>
              </div>
              <div className="rounded-xl border border-line/60 bg-well/50 p-3">
                <span className="lv-muted">Live drafts</span>
                <div className="font-display text-2xl font-semibold text-ink mt-1">
                  {liveDrafts.length}
                </div>
              </div>
              <div className="rounded-xl border border-line/60 bg-well/50 p-3">
                <span className="lv-muted">Team members</span>
                <div className="font-display text-2xl font-semibold text-ink mt-1">
                  {setup?.stats.members_count ?? "—"}
                </div>
              </div>
            </div>
          </Panel>

          {/* In-App Alerts & Notifications */}
          {notifications.length > 0 && (
            <Panel className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="lv-eyebrow">IN-APP ALERTS</div>
                <Badge tone="accent">{notifications.filter(n => !n.is_read).length} unread</Badge>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {notifications.slice(0, 5).map(n => (
                  <div key={n.id} className={`rounded-xl border p-3 text-xs transition ${n.is_read ? "border-line/40 bg-well/30 opacity-70" : "border-violet-400/30 bg-violet-400/[0.04]"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-ink truncate">{n.title}</span>
                      {!n.is_read && (
                        <button
                          type="button"
                          className="text-[10px] text-violet-300 hover:underline"
                          onClick={async () => {
                            if (!brandId) return;
                            await api.markNotificationRead(brandId, n.id);
                            setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, is_read: true } : item));
                          }}
                        >
                          Mark read
                        </button>
                      )}
                    </div>
                    <p className="text-muted text-[11px] mt-1 leading-4">{n.body}</p>
                    <p className="lv-muted text-[10px] mt-1">{formatDate(n.created_at)}</p>
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </div>
      </div>

      {/* 4. Clearly Separated Sample Workspace for Demonstrations */}
      <section aria-labelledby="sample-workspace-heading" className="pt-4">
        <Panel className="relative overflow-hidden border-violet-500/30 bg-violet-500/[0.03] p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line/60 pb-6">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Badge tone="accent">Demonstration &amp; tour</Badge>
                <Badge>Isolated from company data</Badge>
              </div>
              <h2 id="sample-workspace-heading" className="font-display text-2xl font-semibold text-ink">
                Sample workspace
              </h2>
              <p className="lv-muted mt-1.5 max-w-2xl text-xs sm:text-sm leading-6">
                Explore pre-seeded test drafts and factual claims to evaluate BrandLint without modifying your company's live content.
              </p>
            </div>
            <Button variant="secondary" onClick={() => onLaunchStep(0)}>
              <Icon name="review" size={15} /> Start 5-step tour
            </Button>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {sampleDrafts.map(sample => (
              <div
                key={sample.id}
                className="flex flex-col justify-between rounded-xl border border-line/60 bg-well/60 p-4"
              >
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <Badge tone="neutral">Sample draft</Badge>
                    <span className="lv-muted font-mono text-[10px]">Rev {sample.revision}</span>
                  </div>
                  <h3 className="font-display text-sm font-semibold text-ink">{sample.title}</h3>
                  <p className="lv-muted mt-1 text-xs">{sample.channel || "Promotional"}</p>
                </div>
                <div className="mt-4 pt-3 border-t border-line/40">
                  <Button
                    variant="ghost"
                    className="!min-h-7 !p-0 !text-xs text-[var(--lv-accent)]"
                    onClick={() => onLaunchDraft(sample.id)}
                  >
                    Launch sample check →
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      {/* 5. Governance Architecture Orbit */}
      <section aria-label="Governance pipeline architecture" className="pt-4">
        <GovernanceOrbit mode="hero" activeScreen="intro" onNavigate={onOpenScreen} />
      </section>

      {/* Guided Setup Modal */}
      {showSetupModal && setup && (
        <GuidedSetupModal
          brandId={brandId!}
          companyId={companyId}
          role={role}
          setup={setup}
          onRefresh={refreshAll}
          onClose={() => setShowSetupModal(false)}
          onNavigate={onOpenScreen}
        />
      )}

      {/* Home Screen Quick Review Modal (Enables teammates to complete review directly) */}
      {reviewingDraft && (
        <Modal
          title={`Review draft: ${reviewingDraft.title}`}
          onClose={() => setReviewingDraft(null)}
          wide
        >
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/60 pb-4">
              <div>
                <span className="lv-eyebrow">CONTENT UNDER REVIEW</span>
                <h3 className="font-display text-lg font-semibold text-ink">{reviewingDraft.title}</h3>
                <p className="lv-muted mt-0.5 text-xs">
                  Submitted by <strong>{reviewingDraft.author}</strong> · Revision {reviewingDraft.revision}
                </p>
              </div>
              <div className="flex gap-2">
                <Badge tone={reviewingDraft.computed_route === "senior" ? "warning" : "neutral"}>
                  {reviewingDraft.computed_route === "senior" ? "Senior route" : "Standard route"}
                </Badge>
                <Badge tone={reviewingDraft.blockers.length > 0 ? "danger" : "success"}>
                  {reviewingDraft.blockers.length} blocker(s)
                </Badge>
              </div>
            </div>

            {reviewError && <Notice tone="danger">{reviewError}</Notice>}

            {/* Draft Content Preview */}
            <div className="rounded-xl border border-line/60 bg-well/50 p-4">
              <span className="lv-kicker mb-2 block">Submitted copy</span>
              <p className="whitespace-pre-wrap text-sm leading-7 text-ink">{reviewingDraft.text}</p>
            </div>

            {/* Blockers or Warnings */}
            {reviewingDraft.blockers.length > 0 ? (
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/[0.04] p-4 text-xs text-rose-300">
                <span className="font-semibold block mb-1">Unresolved approval blockers:</span>
                <ul className="list-disc pl-4 space-y-1">
                  {reviewingDraft.blockers.map((b, i) => (
                    <li key={i}>{typeof b === "string" ? b : (b as any).message || (b as any).code}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-3 text-xs text-emerald-300">
                ✓ No critical blockers detected. Ready for human sign-off.
              </div>
            )}

            {/* Review Decision Form */}
            <div className="space-y-4">
              <label className="lv-label block">
                Review decision note <span className="text-rose-400">*</span>
                <textarea
                  rows={3}
                  className="lv-input mt-1.5 w-full text-xs"
                  placeholder="Leave a decision note explaining your sign-off or requested changes…"
                  value={reviewComment}
                  onChange={e => setReviewComment(e.target.value)}
                  disabled={reviewSubmitting}
                  required
                />
              </label>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    variant="primary"
                    disabled={reviewSubmitting || reviewingDraft.author_id === user?.id}
                    onClick={handleApproveDraft}
                  >
                    {reviewSubmitting ? "Approving…" : "Approve & sign off"}
                  </Button>
                  <Button
                    variant="danger"
                    disabled={reviewSubmitting}
                    onClick={handleRequestChanges}
                  >
                    Request changes
                  </Button>
                </div>

                {reviewingDraft.author_id === user?.id && (
                  <span className="lv-muted text-xs text-amber-400">
                    Self-approval prevented. Another teammate must review this draft.
                  </span>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
