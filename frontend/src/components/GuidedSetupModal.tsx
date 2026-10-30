import React, { useEffect, useState } from "react";
import { api, DocumentItem, RuleItem, SetupProgress } from "../api";
import { Badge, Button, errorText, FormField, Modal, Notice } from "./ui";

interface Props {
  brandId: number;
  companyId?: number | null;
  role: string;
  setup: SetupProgress;
  onRefresh: () => Promise<void>;
  onClose: () => void;
  onNavigate: (screen: "library" | "review" | "vault" | "queue" | "insights") => void;
}

export const GuidedSetupModal: React.FC<Props> = ({
  brandId,
  companyId,
  role,
  setup,
  onRefresh,
  onClose,
  onNavigate,
}) => {
  const [activeStepId, setActiveStepId] = useState<string>(() => {
    const nextIncomplete = setup.steps.find(s => !s.completed);
    return nextIncomplete ? nextIncomplete.id : "guidelines";
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Step 2: Guidelines upload state
  const [guideTitle, setGuideTitle] = useState("Brand Guidelines 2026");
  const [guideText, setGuideText] = useState(
    "Tone & Style Guidelines:\n\n1. Always communicate with clarity and transparency.\n2. Prohibited wording: never promise '100% risk free' or 'guaranteed returns'.\n3. Promotional claims must be backed by current evidence."
  );
  const [guideFile, setGuideFile] = useState<File | null>(null);

  // Step 3: Rules state
  const [rules, setRules] = useState<RuleItem[]>([]);
  const [rulesLoading, setRulesLoading] = useState(false);

  // Step 4: Evidence state
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<number>(0);
  const [evidencePage, setEvidencePage] = useState(1);
  const [evidenceClaim, setEvidenceClaim] = useState("Reduces customer downtime");
  const [evidenceExcerpt, setEvidenceExcerpt] = useState("reduces downtime by 40%");
  const [evidenceOwner, setEvidenceOwner] = useState("Engineering Lead");
  const [evidenceValidUntil, setEvidenceValidUntil] = useState("2027-12-31");

  // Step 5: Invite state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("reviewer");
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);

  // Step 6: First draft state
  const [draftTitle, setDraftTitle] = useState("Welcome Announcement");
  const [draftText, setDraftText] = useState("Lumina reduces downtime by 40% for our enterprise customers.");

  const isOwner = role === "brand_owner";

  // Fetch rules & docs when relevant step opens
  useEffect(() => {
    if (activeStepId === "rules" || activeStepId === "evidence") {
      setRulesLoading(true);
      api.library(brandId)
        .then(lib => {
          setRules(lib.rules);
          setDocs(lib.documents);
          if (lib.documents.length > 0 && selectedDocId === 0) {
            setSelectedDocId(lib.documents[0].id);
          }
        })
        .catch(e => setError(errorText(e)))
        .finally(() => setRulesLoading(false));
    }
  }, [activeStepId, brandId]);

  const handleUploadGuidelines = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("kind", "guideline");
      formData.append("title", guideTitle.trim());
      if (guideFile) {
        formData.append("file", guideFile);
      } else {
        formData.append("text", guideText.trim());
      }
      const res = await api.uploadDocument(brandId, formData);
      setSuccess(`Uploaded "${res.document.title}". Extracted ${res.proposed_rules.length} proposed rule(s).`);
      await onRefresh();
      setActiveStepId("rules");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  };

  const handleApproveRule = async (ruleId: number) => {
    setError("");
    setLoading(true);
    try {
      await api.approveRule(brandId, ruleId);
      setSuccess("Rule approved and activated.");
      const lib = await api.library(brandId);
      setRules(lib.rules);
      await onRefresh();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  };

  const handleRejectRule = async (ruleId: number) => {
    setError("");
    setLoading(true);
    try {
      await api.rejectRule(brandId, ruleId);
      setSuccess("Rule rejected.");
      const lib = await api.library(brandId);
      setRules(lib.rules);
      await onRefresh();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDocId) {
      setError("Please select a source document.");
      return;
    }
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const ev = await api.addEvidence(brandId, {
        document_id: selectedDocId,
        page: evidencePage,
        claim_text: evidenceClaim.trim(),
        excerpt: evidenceExcerpt.trim(),
        owner: evidenceOwner.trim(),
        valid_until: evidenceValidUntil.trim() || undefined,
        keywords: ["setup", "onboarding"],
      });
      // If brand owner, immediately approve
      if (isOwner) {
        await api.decideEvidence(brandId, ev.id, "approve");
      }
      setSuccess("Approved fact registered successfully with verified source excerpt.");
      await onRefresh();
      setActiveStepId("invite");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) {
      setError("Company ID unavailable for invitations.");
      return;
    }
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const res = await api.createInvitation(companyId, inviteEmail.trim(), inviteRole);
      setInviteUrl(res.invite_url);
      setSuccess(`Invitation created for ${inviteEmail}!`);
      await onRefresh();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSkipInvite = async () => {
    setError("");
    setLoading(true);
    try {
      await api.skipSetupStep(brandId, "invite");
      setSuccess("Teammate invitation skipped. You can invite teammates anytime from Account & Settings.");
      await onRefresh();
      setActiveStepId("first_draft");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFirstDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const draft = await api.createDraft(brandId, {
        title: draftTitle.trim(),
        channel: "Landing Page",
        text: draftText.trim(),
        audience: "Prospective customers",
        purpose: "Product announcement",
        cta: "Learn more",
      });
      await api.checkDraft(brandId, draft.id);
      setSuccess("Draft created and checked against your approved rules and facts!");
      await onRefresh();
      setTimeout(() => {
        onClose();
        onNavigate("review");
      }, 900);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  };

  const activeStep = setup.steps.find(s => s.id === activeStepId) || setup.steps[0];
  const proposedRules = rules.filter(r => r.status === "proposed");
  const activeRules = rules.filter(r => r.status === "active");

  return (
    <Modal title="Guided brand setup" onClose={onClose} wide>
      <div className="space-y-6">
        {/* Progress Bar & Header */}
        <div className="rounded-2xl border border-line bg-well/40 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="lv-eyebrow mb-1">ONBOARDING PROGRESS</div>
              <h3 className="font-display text-lg font-semibold text-ink">
                {setup.is_completed ? "Workspace setup complete" : `${setup.progress_pct}% completed`}
              </h3>
              <p className="lv-muted mt-1 text-xs">
                {setup.completed_count} of {setup.total_steps} steps completed · Server-persisted state
              </p>
            </div>
            <Badge tone={setup.is_completed ? "success" : "accent"}>
              {setup.is_completed ? "Setup complete" : `Step: ${activeStep.title}`}
            </Badge>
          </div>
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-line/60">
            <div
              className="h-full rounded-full bg-violet-400 transition-all duration-300"
              style={{ width: `${Math.max(8, setup.progress_pct)}%` }}
            />
          </div>
        </div>

        {error && <Notice tone="danger">{error}</Notice>}
        {success && <Notice tone="success">{success}</Notice>}

        {/* 2-Column: Step Navigation List & Step Content */}
        <div className="grid items-start gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          {/* Step Selector List */}
          <nav className="space-y-1.5" aria-label="Setup steps">
            {setup.steps.map((s, idx) => {
              const isCurrent = s.id === activeStepId;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setActiveStepId(s.id);
                    setError("");
                    setSuccess("");
                  }}
                  className={`flex w-full items-center justify-between rounded-xl border p-3 text-left transition ${
                    isCurrent
                      ? "border-violet-400/40 bg-violet-400/10 text-ink"
                      : "border-transparent bg-transparent text-muted hover:bg-well/60"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                        s.completed
                          ? "bg-emerald-500/20 text-emerald-400"
                          : isCurrent
                          ? "bg-violet-400/20 text-violet-300"
                          : "bg-line/60 text-muted"
                      }`}
                    >
                      {s.completed ? "✓" : idx + 1}
                    </span>
                    <span className="text-xs font-medium">{s.title}</span>
                  </div>
                  {s.skipped && <Badge className="!text-[10px]">Skipped</Badge>}
                </button>
              );
            })}
          </nav>

          {/* Active Step Workspace */}
          <div className="rounded-2xl border border-line bg-well/30 p-6">
            {/* Step 1: Company & Brand Workspace */}
            {activeStepId === "brand" && (
              <div className="space-y-5">
                <div>
                  <div className="lv-eyebrow mb-2">STEP 1 / WORKSPACE CONFIGURATION</div>
                  <h3 className="font-display text-xl font-medium text-ink">Company &amp; brand tenant</h3>
                  <p className="lv-muted mt-2 text-sm leading-6">
                    BrandLint enforces strict company and brand boundaries. Your rules, source documents, and evidence passports are isolated to your company.
                  </p>
                </div>
                <div className="space-y-3 rounded-xl border border-line/60 bg-well/60 p-4 font-mono text-xs">
                  <div className="flex justify-between border-b border-line/40 py-1.5">
                    <span className="text-muted">Brand ID:</span>
                    <span className="font-semibold text-ink">#{brandId}</span>
                  </div>
                  <div className="flex justify-between border-b border-line/40 py-1.5">
                    <span className="text-muted">Your active role:</span>
                    <Badge tone="accent">{role.replace(/_/g, " ")}</Badge>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-muted">Tenant status:</span>
                    <span className="text-emerald-400">Ready &amp; authenticated</span>
                  </div>
                </div>
                <Button variant="primary" onClick={() => setActiveStepId("guidelines")}>
                  Next: Upload guidelines →
                </Button>
              </div>
            )}

            {/* Step 2: Upload Guidelines */}
            {activeStepId === "guidelines" && (
              <form onSubmit={handleUploadGuidelines} className="space-y-5">
                <div>
                  <div className="lv-eyebrow mb-2">STEP 2 / SOURCE GUIDELINES</div>
                  <h3 className="font-display text-xl font-medium text-ink">Upload brand guidelines</h3>
                  <p className="lv-muted mt-2 text-sm leading-6">
                    Upload your brand manual or tone guidelines as a PDF or text snippet. BrandLint ingests guidelines as untrusted source data and extracts candidate rules for human approval.
                  </p>
                </div>

                <FormField label="Document title" required>
                  <input
                    type="text"
                    className="lv-input w-full"
                    value={guideTitle}
                    onChange={e => setGuideTitle(e.target.value)}
                    required
                    disabled={loading || !isOwner}
                  />
                </FormField>

                <FormField label="Upload PDF file (optional)">
                  <input
                    type="file"
                    accept=".pdf,.txt"
                    className="lv-input w-full"
                    onChange={e => setGuideFile(e.target.files?.[0] || null)}
                    disabled={loading || !isOwner}
                  />
                </FormField>

                {!guideFile && (
                  <FormField label="Or paste guideline text">
                    <textarea
                      rows={5}
                      className="lv-input w-full"
                      value={guideText}
                      onChange={e => setGuideText(e.target.value)}
                      disabled={loading || !isOwner}
                      required={!guideFile}
                    />
                  </FormField>
                )}

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <Button type="submit" variant="primary" disabled={loading || !isOwner}>
                    {loading ? "Extracting rules…" : "Upload guidelines & extract rules"}
                  </Button>
                  {setup.steps[1].completed && (
                    <Button variant="secondary" onClick={() => setActiveStepId("rules")}>
                      Next: Inspect rules →
                    </Button>
                  )}
                  {!isOwner && (
                    <span className="lv-muted text-xs">Brand Owner permission required to upload guidelines.</span>
                  )}
                </div>
              </form>
            )}

            {/* Step 3: Inspect & Approve Extracted Rules */}
            {activeStepId === "rules" && (
              <div className="space-y-5">
                <div>
                  <div className="lv-eyebrow mb-2">STEP 3 / RULE APPROVAL</div>
                  <h3 className="font-display text-xl font-medium text-ink">Inspect &amp; approve extracted rules</h3>
                  <p className="lv-muted mt-2 text-sm leading-6">
                    BrandLint never auto-activates AI-extracted rules. A Brand Owner must inspect and approve each rule before it takes effect on live drafts.
                  </p>
                </div>

                {rulesLoading ? (
                  <p className="lv-muted text-xs" role="status">Loading rules…</p>
                ) : (
                  <>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="lv-kicker">Proposed rules awaiting approval ({proposedRules.length})</span>
                        <Badge tone={activeRules.length > 0 ? "success" : "warning"}>
                          {activeRules.length} active rule(s)
                        </Badge>
                      </div>

                      {proposedRules.length === 0 && (
                        <div className="rounded-xl border border-line/60 bg-well/40 p-4 text-xs text-muted">
                          {activeRules.length > 0
                            ? "All extracted rules have been reviewed. Active rules are ready for checking content."
                            : "No proposed rules found. Upload guidelines in Step 2 to generate proposed rules."}
                        </div>
                      )}

                      {proposedRules.map(r => (
                        <div key={r.id} className="rounded-xl border border-line/60 bg-well/60 p-4 space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-medium text-ink">{r.title}</span>
                            <div className="flex gap-2">
                              <Badge>{r.category}</Badge>
                              <Badge tone={r.severity === "critical" ? "danger" : "neutral"}>{r.severity}</Badge>
                            </div>
                          </div>
                          <p className="text-xs leading-5 text-muted">{r.text}</p>
                          <div className="flex items-center gap-2 pt-2">
                            <Button
                              variant="primary"
                              disabled={loading || !isOwner}
                              onClick={() => handleApproveRule(r.id)}
                            >
                              Approve rule
                            </Button>
                            <Button
                              variant="danger"
                              disabled={loading || !isOwner}
                              onClick={() => handleRejectRule(r.id)}
                            >
                              Reject
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 pt-3">
                      <Button variant="secondary" onClick={() => setActiveStepId("evidence")}>
                        Next: Register approved fact →
                      </Button>
                      {!isOwner && (
                        <span className="lv-muted text-xs">Waiting for Brand Owner to approve rules.</span>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Step 4: Register Approved Fact */}
            {activeStepId === "evidence" && (
              <form onSubmit={handleCreateEvidence} className="space-y-5">
                <div>
                  <div className="lv-eyebrow mb-2">STEP 4 / APPROVED FACTS</div>
                  <h3 className="font-display text-xl font-medium text-ink">Register an approved fact</h3>
                  <p className="lv-muted mt-2 text-sm leading-6">
                    An Evidence Passport is the approved source behind a promotional claim. It anchors a claim to a verified source excerpt, page number, and validity window.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label="Source document" required>
                    <select
                      className="lv-input w-full"
                      value={selectedDocId}
                      onChange={e => setSelectedDocId(Number(e.target.value))}
                      disabled={loading || docs.length === 0}
                    >
                      {docs.map(d => (
                        <option key={d.id} value={d.id}>
                          {d.title} (v{d.version}, {d.pages} pages)
                        </option>
                      ))}
                    </select>
                  </FormField>

                  <FormField label="Page number" required>
                    <input
                      type="number"
                      min={1}
                      max={docs.find(d => d.id === selectedDocId)?.pages || 10}
                      className="lv-input w-full"
                      value={evidencePage}
                      onChange={e => setEvidencePage(Number(e.target.value))}
                      disabled={loading}
                    />
                  </FormField>
                </div>

                <FormField label="Verbatim supporting excerpt (must appear on source page)" required>
                  <textarea
                    rows={2}
                    className="lv-input w-full font-mono text-xs"
                    value={evidenceExcerpt}
                    onChange={e => setEvidenceExcerpt(e.target.value)}
                    placeholder="Exact text quotation from the source page…"
                    required
                    disabled={loading}
                  />
                </FormField>

                <FormField label="Claim text (what this excerpt proves)" required>
                  <input
                    type="text"
                    className="lv-input w-full"
                    value={evidenceClaim}
                    onChange={e => setEvidenceClaim(e.target.value)}
                    required
                    disabled={loading}
                  />
                </FormField>

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label="Evidence owner" required>
                    <input
                      type="text"
                      className="lv-input w-full"
                      value={evidenceOwner}
                      onChange={e => setEvidenceOwner(e.target.value)}
                      required
                      disabled={loading}
                    />
                  </FormField>

                  <FormField label="Valid until">
                    <input
                      type="date"
                      className="lv-input w-full"
                      value={evidenceValidUntil}
                      onChange={e => setEvidenceValidUntil(e.target.value)}
                      disabled={loading}
                    />
                  </FormField>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <Button type="submit" variant="primary" disabled={loading}>
                    {loading ? "Registering fact…" : "Register approved fact"}
                  </Button>
                  <Button variant="secondary" onClick={() => setActiveStepId("invite")}>
                    Next: Invite teammate →
                  </Button>
                </div>
              </form>
            )}

            {/* Step 5: Invite Teammate */}
            {activeStepId === "invite" && (
              <form onSubmit={handleSendInvite} className="space-y-5">
                <div>
                  <div className="lv-eyebrow mb-2">STEP 5 / TEAM INVITATIONS (OPTIONAL)</div>
                  <h3 className="font-display text-xl font-medium text-ink">Invite a teammate</h3>
                  <p className="lv-muted mt-2 text-sm leading-6">
                    Invite creators or reviewers to collaborate on content checks. You can skip this step and invite teammates anytime later.
                  </p>
                </div>

                <FormField label="Teammate email" required>
                  <input
                    type="email"
                    className="lv-input w-full"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    placeholder="colleague@yourcompany.com"
                    required
                    disabled={loading || !isOwner}
                  />
                </FormField>

                <FormField label="Role assignment" required>
                  <select
                    className="lv-input w-full"
                    value={inviteRole}
                    onChange={e => setInviteRole(e.target.value)}
                    disabled={loading || !isOwner}
                  >
                    <option value="creator">Creator (can create and check drafts)</option>
                    <option value="reviewer">Reviewer (can review and approve drafts)</option>
                    <option value="senior_reviewer">Senior Reviewer (can approve high-risk claims)</option>
                    <option value="brand_owner">Brand Owner (full workspace governance)</option>
                  </select>
                </FormField>

                {inviteUrl && (
                  <Notice tone="success">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold">Invitation link ready:</p>
                      <input
                        type="text"
                        readOnly
                        value={inviteUrl}
                        className="lv-input w-full font-mono text-[11px]"
                        onClick={e => (e.target as HTMLInputElement).select()}
                      />
                    </div>
                  </Notice>
                )}

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <Button type="submit" variant="primary" disabled={loading || !isOwner}>
                    {loading ? "Sending invite…" : "Send invitation"}
                  </Button>
                  <Button variant="ghost" onClick={handleSkipInvite} disabled={loading}>
                    Skip for now
                  </Button>
                  <Button variant="secondary" onClick={() => setActiveStepId("first_draft")}>
                    Next: Check first draft →
                  </Button>
                </div>
              </form>
            )}

            {/* Step 6: Check First Draft */}
            {activeStepId === "first_draft" && (
              <form onSubmit={handleCreateFirstDraft} className="space-y-5">
                <div>
                  <div className="lv-eyebrow mb-2">STEP 6 / FIRST CONTENT CHECK</div>
                  <h3 className="font-display text-xl font-medium text-ink">Check your first draft</h3>
                  <p className="lv-muted mt-2 text-sm leading-6">
                    Paste your marketing copy or social post to run your first content check against your approved rules and facts.
                  </p>
                </div>

                <FormField label="Draft title" required>
                  <input
                    type="text"
                    className="lv-input w-full"
                    value={draftTitle}
                    onChange={e => setDraftTitle(e.target.value)}
                    required
                    disabled={loading}
                  />
                </FormField>

                <FormField label="Draft content" required>
                  <textarea
                    rows={4}
                    className="lv-input w-full"
                    value={draftText}
                    onChange={e => setDraftText(e.target.value)}
                    required
                    disabled={loading}
                  />
                </FormField>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <Button type="submit" variant="primary" disabled={loading}>
                    {loading ? "Checking content…" : "Check content & finish setup"}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      onClose();
                      onNavigate("review");
                    }}
                  >
                    Open Check Content desk →
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
