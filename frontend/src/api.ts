export interface UserInfo {
  id: number;
  name: string;
  email: string;
}

export interface BrandInfo {
  id: number;
  company_id?: number;
  name: string;
  description: string;
  role: "creator" | "reviewer" | "senior_reviewer" | "brand_owner";
  protected_terms: string[];
}

export interface CompanyInfo {
  id: number;
  name: string;
  slug: string;
  role: "creator" | "reviewer" | "senior_reviewer" | "brand_owner";
  role_label: string;
  created_at: string;
  settings?: Record<string, unknown>;
  brands: BrandInfo[];
}

export interface CompanyMember {
  id: number;
  user_id: number;
  name: string;
  email: string;
  role: "creator" | "reviewer" | "senior_reviewer" | "brand_owner";
  role_label: string;
  role_description: string;
  created_at: string;
}

export interface CompanyInvitationItem {
  id: number;
  email: string;
  role: "creator" | "reviewer" | "senior_reviewer" | "brand_owner";
  role_label: string;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  status: "pending" | "accepted" | "expired" | "revoked";
}

export interface RoleExplanation {
  role: string;
  label: string;
  description: string;
  permissions: string[];
}

export interface InvitationDetails {
  email: string;
  company_name: string;
  role: "creator" | "reviewer" | "senior_reviewer" | "brand_owner";
  role_label: string;
  role_description: string;
  permissions: string[];
  expires_at: string;
}

export interface PrivacyInfo {
  provider: string;
  hosted: boolean;
  notice: string;
}

export interface SetupStep {
  id: "brand" | "guidelines" | "rules" | "evidence" | "invite" | "first_draft";
  title: string;
  description: string;
  completed: boolean;
  status: "completed" | "current" | "pending";
  required_role: "brand_owner" | "reviewer" | "creator";
  can_execute: boolean;
  action_label: string;
  optional?: boolean;
  skipped?: boolean;
  count?: number;
  proposed_count?: number;
  active_count?: number;
  approved_count?: number;
  pending_count?: number;
  members_count?: number;
  invitations_count?: number;
}

export interface RoleTask {
  key: string;
  title: string;
  description: string;
  can_act: boolean;
  action_label: string;
  target: string;
}

export interface SetupProgress {
  brand_id: number;
  company_id: number | null;
  current_step: string;
  is_completed: boolean;
  completed_count: number;
  total_steps: number;
  progress_pct: number;
  dismissed: boolean;
  skipped_invite: boolean;
  steps: SetupStep[];
  role_task: RoleTask;
  stats: {
    guidelines_count: number;
    proposed_rules_count: number;
    active_rules_count: number;
    approved_evidence_count: number;
    pending_evidence_count: number;
    members_count: number;
    invitations_count: number;
    live_drafts_count: number;
    pending_approvals_count: number;
  };
}

export interface RuleItem {
  id: number;
  key: string;
  version: number;
  ref: string;
  status: "active" | "proposed" | "superseded" | "rejected";
  title: string;
  category: string;
  severity: "low" | "medium" | "high" | "critical";
  text: string;
  sensitive: boolean;
  matchers: number;
  banned: string[];
  source: {
    document_id: number;
    title: string;
    version: number;
    page: number | null;
  } | null;
  excerpt: string;
}

export interface DocumentItem {
  id: number;
  kind: "guideline" | "evidence";
  title: string;
  version: number;
  pages: number;
  expires_on: string | null;
  suspicious: boolean;
  suspicious_notes: string[];
  seeded: boolean;
  created_at: string;
  page_text?: string[];
}

export interface Passport {
  id: number;
  ref: string;
  claim_text: string;
  excerpt: string;
  page: number;
  document: {
    id: number;
    title: string;
    version: number;
    kind: string;
  };
  owner: string;
  valid_from: string | null;
  valid_until: string | null;
  approval_status: "pending" | "approved" | "rejected";
  state: "current" | "expired" | "not_yet_valid" | "pending" | "rejected";
  keywords?: string[];
  valid_until_record?: string | null;
  source_expires_on?: string | null;
}

export interface FindingItem {
  id: number;
  fingerprint: string;
  origin: "deterministic" | "llm" | "evidence";
  category: string;
  severity: "info" | "low" | "medium" | "high" | "critical";
  start: number;
  end: number;
  quote: string;
  explanation: string;
  rule: { id: number | null; key: string; version: number | null } | null;
  source_excerpt: string;
  source_ref: string;
  is_claim: boolean;
  evidence_status: "supported" | "expired" | "missing" | "insufficient" | "needs_review" | null;
  needs_review: boolean;
  sensitive: boolean;
  suggestion: {
    original: string;
    replacement: string;
    protected_flags: string[];
    requires_confirmation: boolean;
  } | null;
  disposition: {
    action: "accepted" | "rejected";
    reason: string;
    by: string;
    at: string;
  } | null;
  passport: Passport | null;
  dimensions?: Record<string, { claim?: string; evidence?: string; status: "supported" | "mismatch" | "unstated"; note: string }>;
  uncertainty?: string | null;
}

export interface DraftSummary {
  id: number;
  title: string;
  channel: string;
  status: "draft" | "checked" | "in_review" | "senior_review" | "changes_requested" | "approved" | "needs_revalidation";
  route: "standard" | "senior" | null;
  author: string;
  author_id: number;
  seeded: boolean;
  revision: number;
  updated_at: string;
  actionable?: boolean;
  validity_status?: string;
  recall_reason?: string | null;
  assigned_reviewer_id?: number | null;
}

export interface EligibleReviewerItem {
  id: number;
  name: string;
  email: string;
  role: string;
}

export interface AppNotificationItem {
  id: number;
  kind: string;
  title: string;
  body: string;
  draft_id?: number | null;
  is_read: boolean;
  created_at: string;
}

export interface RecallAlertItem {
  draft_id: number;
  title: string;
  author_id: number;
  author_name: string;
  recall_reason: string;
  updated_at: string;
  approved_revision_id: number;
}

export interface DraftDetail extends DraftSummary {
  revision_id: number;
  text: string;
  audience: string;
  purpose: string;
  cta: string;
  approved_revision_id: number | null;
  validity_status?: string;
  recall_reason?: string | null;
  assigned_reviewer?: { id: number; name: string; email: string } | null;
  eligible_reviewers?: EligibleReviewerItem[];
  revisions: { id: number; number: number; note: string; at: string; by: string }[];
  analysis: {
    id: number;
    at: string;
    provider: string;
    rule_versions: Record<string, number>;
    source_versions: Record<string, { title: string; version: number }>;
    notes: string[];
    triggered_by: string;
  } | null;
  findings: FindingItem[];
  computed_route: "standard" | "senior" | null;
  blockers: {
    code: string;
    finding_id?: number;
    message: string;
    who_can_resolve?: string;
    next_step?: string;
  }[];
  can_edit: boolean;
  can_review: boolean;
  role: string;
}

export interface HistoryData {
  decisions: {
    id: number;
    kind: string;
    body: string;
    by: string;
    route: string | null;
    revision_id: number | null;
    at: string;
    seeded: boolean;
  }[];
  audit: {
    id: number;
    action: string;
    by: string;
    details: Record<string, unknown>;
    at: string;
    seeded: boolean;
  }[];
}

export interface ChannelConditionItem {
  channel: string;
  action: "allow" | "exempt" | "restrict" | "prohibit";
  reason?: string;
  patterns?: string[];
}

export interface RuleVersionStats {
  version: number;
  status: string;
  overrides: number;
  accepted: number;
  decisions: number;
  override_rate: number | null;
  live_overrides: number;
  seeded_overrides: number;
  live_accepted: number;
  seeded_accepted: number;
  insufficient_history: boolean;
}

export interface ChannelOutcomeStats {
  channel?: string;
  overrides: number;
  accepted: number;
  decisions: number;
  override_rate: number | null;
  live_overrides: number;
  seeded_overrides: number;
}

export interface GuidelineProposalItem {
  id: number;
  rule_key: string;
  current_text: string;
  proposed_text: string;
  rationale: string;
  override_count: number;
  channel_conditions?: ChannelConditionItem[];
  proposed_matchers?: Array<Record<string, unknown>>;
  status: "pending" | "approved" | "rejected";
  created_at: string;
}

export interface GuidelineHealthItem {
  rule_key: string;
  rule_id: number;
  version: number;
  title: string;
  category: string;
  rule_text: string;
  channel_conditions?: ChannelConditionItem[];
  exempt_channels?: string[];
  overrides: number;
  accepted: number;
  decisions: number;
  override_rate: number | null;
  seeded_overrides: number;
  live_overrides: number;
  all_time_overrides?: number;
  all_time_decisions?: number;
  insufficient_history: boolean;
  uncertainty_label?: string;
  confidence_interval?: { low: number; high: number } | null;
  min_sample: number;
  reasons: { reason: string; count: number }[];
  examples: { excerpt: string; reason: string; channel?: string; rule_version?: number; seeded: boolean }[];
  outcomes_by_channel?: Record<string, ChannelOutcomeStats>;
  version_breakdown?: RuleVersionStats[];
  proposal: GuidelineProposalItem | null;
}

export interface SimulationResult {
  rule_key: string;
  sample_size: number;
  drafts_evaluated: number;
  changed_count: number;
  unchanged_count: number;
  findings_eliminated_count: number;
  findings_added_count: number;
  changed_drafts: {
    draft_id: number;
    title: string;
    channel: string;
    status: string;
    change_type: string;
    findings_diff: number;
    current_count: number;
    proposed_count: number;
    quotes_eliminated?: string[];
    quotes_added?: string[];
  }[];
  unchanged_drafts: {
    draft_id: number;
    title: string;
    channel: string;
    status: string;
    findings_count: number;
  }[];
  channel_conditions: ChannelConditionItem[];
}

export interface InsightsData {
  recurring_issues: {
    rule_key: string;
    title: string;
    category: string;
    live_count: number;
    seeded_count: number;
    total: number;
  }[];
  claim_evidence_status: Record<string, number>;
  drafts_by_status: Record<string, number>;
  note: string;
  health: GuidelineHealthItem[];
}

export interface EvaluationData {
  drafts_total: number;
  clean_drafts: number;
  problematic_drafts: number;
  expected_issues: number;
  true_positives: number;
  missed_issues: number;
  false_alarms: number;
  clean_draft_false_alarms: number;
  precision: number;
  recall: number;
  citations_checked: number;
  citations_valid: number;
  citation_validity_rate: number;
  total_time_ms: number;
  avg_review_time_ms: number;
  cases: {
    id: string;
    label: string;
    clean: boolean;
    expected: string[];
    observed: string[];
    tp: number;
    missed: string[];
    false_alarms: string[];
    latency_ms: number;
  }[];
}

export interface SystemModeInfo {
  mode: string;
  is_production: boolean;
  is_demo: boolean;
  allow_reset: boolean;
  allow_persona_switch: boolean;
}

export const DEMO_USERS = [
  { email: "casey@lumina.demo", label: "Casey Morgan", role: "Creator", badge: "creator" },
  { email: "riley@lumina.demo", label: "Riley Chen", role: "Reviewer", badge: "reviewer" },
  { email: "sam@lumina.demo", label: "Sam Patel", role: "Senior Reviewer", badge: "senior_reviewer" },
  { email: "olivia@lumina.demo", label: "Olivia Brooks", role: "Brand Owner", badge: "brand_owner" },
];

export class ApiError extends Error {
  status: number;
  detail: unknown;
  constructor(status: number, message: string, detail?: unknown) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

// In-memory CSRF and Session tokens. Credentials are held in server-stored HttpOnly cookies
// and in-memory process state (never stored in localStorage).
let inMemoryCsrf: string = "";
let inMemoryToken: string = "";

// Clean up any legacy localStorage auth tokens
try {
  localStorage.removeItem("brandlint_token");
} catch {
  /* Ignore in environments without window/localStorage */
}

export function setCsrfToken(token: string) {
  inMemoryCsrf = token;
}

export function getCsrfToken(): string {
  if (inMemoryCsrf) return inMemoryCsrf;
  if (typeof document !== "undefined") {
    const match = document.cookie.match(/(?:^|;\s*)brandlint_csrf=([^;]+)/);
    if (match) return decodeURIComponent(match[1]);
  }
  return "";
}

export function setAuthToken(token: string) {
  inMemoryToken = token;
}

export function getAuthToken(): string {
  return inMemoryToken;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers || {});
  const method = (init.method || "GET").toUpperCase();

  // Attach CSRF token on mutating requests
  if (["POST", "PUT", "DELETE", "PATCH"].includes(method)) {
    const csrf = getCsrfToken();
    if (csrf) headers.set("X-CSRF-Token", csrf);
  }

  // Attach in-memory bearer token for authorization header validation
  const token = getAuthToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (!(init.body instanceof FormData) && init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  // Include credentials for server-stored HttpOnly cookie sessions
  const res = await fetch(`/api${path}`, { ...init, credentials: "include", headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const d = data?.detail;
    const msg =
      typeof d === "string"
        ? d
        : d?.message || (Array.isArray(d) ? d.map((x: { msg?: string }) => x.msg).join("; ") : `Request failed (${res.status})`);
    throw new ApiError(res.status, msg, d);
  }

  // Update in-memory CSRF token if returned by the endpoint
  if (data && typeof data === "object" && "csrf_token" in data && typeof data.csrf_token === "string") {
    setCsrfToken(data.csrf_token);
  }
  if (data && typeof data === "object" && "token" in data && typeof data.token === "string") {
    setAuthToken(data.token);
  }

  return data as T;
}

export const api = {
  register: (name: string, email: string, password: string) =>
    request<{ status: string; token?: string; csrf_token?: string; user: UserInfo }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    }),
  login: async (email: string, password = "demo1234") => {
    const res = await request<{ token?: string; csrf_token?: string; user: UserInfo }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    if (res.token) setAuthToken(res.token);
    if (res.csrf_token) setCsrfToken(res.csrf_token);
    return res;
  },
  logout: async () => {
    try {
      await request<{ status: string }>("/auth/logout", { method: "POST" });
    } finally {
      setAuthToken("");
      setCsrfToken("");
    }
  },
  demoSwitch: async (email: string) => {
    const res = await request<{ token?: string; csrf_token?: string; user: UserInfo }>("/auth/demo-switch", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
    if (res.token) setAuthToken(res.token);
    if (res.csrf_token) setCsrfToken(res.csrf_token);
    return res;
  },
  forgotPassword: (email: string) =>
    request<{ status: string; message: string }>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  resetPassword: (token: string, newPassword: string) =>
    request<{ status: string; message: string }>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, new_password: newPassword }),
    }),
  getSession: () => request<{ authenticated: boolean; csrf_token: string; user: UserInfo }>("/auth/session"),
  me: async () => {
    const res = await request<{
      user: UserInfo;
      companies: CompanyInfo[];
      brands: BrandInfo[];
      roles: Record<string, RoleExplanation>;
      privacy: PrivacyInfo;
      csrf_token?: string;
    }>("/me");
    if (res.csrf_token) setCsrfToken(res.csrf_token);
    return res;
  },
  getCompanies: () => request<CompanyInfo[]>("/companies"),
  getCompany: (companyId: number) =>
    request<CompanyInfo & { my_role: string; members_count: number }>(`/companies/${companyId}`),
  updateCompany: (companyId: number, data: { name?: string; settings?: Record<string, unknown> }) =>
    request<{ id: number; name: string; slug: string; settings: Record<string, unknown> }>(`/companies/${companyId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  getCompanyMembers: (companyId: number) => request<CompanyMember[]>(`/companies/${companyId}/members`),
  updateMemberRole: (companyId: number, userId: number, role: string) =>
    request<{ status: string; user_id: number; role: string }>(`/companies/${companyId}/members/${userId}`, {
      method: "PUT",
      body: JSON.stringify({ role }),
    }),
  removeMember: (companyId: number, userId: number) =>
    request<{ status: string; user_id: number }>(`/companies/${companyId}/members/${userId}`, {
      method: "DELETE",
    }),
  getInvitations: (companyId: number) => request<CompanyInvitationItem[]>(`/companies/${companyId}/invitations`),
  createInvitation: (companyId: number, email: string, role: string) =>
    request<{
      id: number;
      email: string;
      role: string;
      role_label: string;
      expires_at: string;
      invite_url: string;
      token: string;
    }>(`/companies/${companyId}/invitations`, {
      method: "POST",
      body: JSON.stringify({ email, role }),
    }),
  revokeInvitation: (companyId: number, invitationId: number) =>
    request<{ status: string; id: number }>(`/companies/${companyId}/invitations/${invitationId}`, {
      method: "DELETE",
    }),
  inspectInvitation: (token: string) => request<InvitationDetails>(`/invitations/${encodeURIComponent(token)}`),
  acceptInvitation: (token: string, name?: string, password?: string) =>
    request<{
      status: string;
      company: { id: number; name: string; slug: string };
      role: string;
      user: UserInfo;
      token: string;
      csrf_token: string;
    }>("/invitations/accept", {
      method: "POST",
      body: JSON.stringify({ token, name, password }),
    }),
  getRoles: () => request<Record<string, RoleExplanation>>("/roles"),
  library: (brandId: number) =>
    request<{ rules: RuleItem[]; documents: DocumentItem[] }>(`/brands/${brandId}/library`),
  getDocument: (brandId: number, docId: number) =>
    request<DocumentItem>(`/brands/${brandId}/documents/${docId}`),
  uploadDocument: (brandId: number, form: FormData) =>
    request<{ document: DocumentItem; proposed_rules: RuleItem[]; notes: string[] }>(
      `/brands/${brandId}/documents`,
      { method: "POST", body: form }
    ),
  approveRule: (brandId: number, ruleId: number) =>
    request<RuleItem>(`/brands/${brandId}/rules/${ruleId}/approve`, { method: "POST" }),
  rejectRule: (brandId: number, ruleId: number) =>
    request<RuleItem>(`/brands/${brandId}/rules/${ruleId}/reject`, { method: "POST" }),
  listEvidence: (brandId: number) => request<Passport[]>(`/brands/${brandId}/evidence`),
  addEvidence: (
    brandId: number,
    body: {
      claim_text: string;
      excerpt: string;
      document_id: number;
      page: number;
      owner: string;
      valid_from?: string | null;
      valid_until?: string | null;
      keywords?: string[];
    }
  ) =>
    request<Passport>(`/brands/${brandId}/evidence`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  decideEvidence: (brandId: number, evidenceId: number, decision: "approve" | "reject") =>
    request<Passport>(`/brands/${brandId}/evidence/${evidenceId}/${decision}`, { method: "POST" }),
  listDrafts: (brandId: number) => request<DraftSummary[]>(`/brands/${brandId}/drafts`),
  createDraft: (
    brandId: number,
    body: { title: string; channel: string; text: string; audience: string; purpose: string; cta: string }
  ) =>
    request<DraftDetail>(`/brands/${brandId}/drafts`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  getDraft: (brandId: number, draftId: number) =>
    request<DraftDetail>(`/brands/${brandId}/drafts/${draftId}`),
  editDraft: (
    brandId: number,
    draftId: number,
    body: { text: string; audience: string; purpose: string; cta: string; title?: string }
  ) =>
    request<DraftDetail>(`/brands/${brandId}/drafts/${draftId}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  checkDraft: (brandId: number, draftId: number) =>
    request<DraftDetail>(`/brands/${brandId}/drafts/${draftId}/check`, { method: "POST" }),
  acceptFinding: (brandId: number, draftId: number, findingId: number, confirmProtected = false) =>
    request<DraftDetail>(`/brands/${brandId}/drafts/${draftId}/findings/${findingId}/accept`, {
      method: "POST",
      body: JSON.stringify({ confirm_protected: confirmProtected }),
    }),
  rejectFinding: (brandId: number, draftId: number, findingId: number, reason: string) =>
    request<DraftDetail>(`/brands/${brandId}/drafts/${draftId}/findings/${findingId}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  submitDraft: (brandId: number, draftId: number) =>
    request<DraftDetail>(`/brands/${brandId}/drafts/${draftId}/submit`, { method: "POST" }),
  approveDraft: (brandId: number, draftId: number, revisionId: number, comment: string) =>
    request<DraftDetail>(`/brands/${brandId}/drafts/${draftId}/approve`, {
      method: "POST",
      body: JSON.stringify({ revision_id: revisionId, comment }),
    }),
  requestChanges: (brandId: number, draftId: number, reason: string) =>
    request<DraftDetail>(`/brands/${brandId}/drafts/${draftId}/request-changes`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  addComment: (brandId: number, draftId: number, body: string) =>
    request<HistoryData>(`/brands/${brandId}/drafts/${draftId}/comments`, {
      method: "POST",
      body: JSON.stringify({ body }),
    }),
  getHistory: (brandId: number, draftId: number) =>
    request<HistoryData>(`/brands/${brandId}/drafts/${draftId}/history`),
  getEligibleReviewers: (brandId: number, draftId: number) =>
    request<EligibleReviewerItem[]>(`/brands/${brandId}/drafts/${draftId}/eligible-reviewers`),
  reopenDraft: (brandId: number, draftId: number, reason?: string) =>
    request<DraftDetail>(`/brands/${brandId}/drafts/${draftId}/reopen`, {
      method: "POST",
      body: JSON.stringify({ reason: reason || "" }),
    }),
  recheckDraft: (brandId: number, draftId: number) =>
    request<DraftDetail>(`/brands/${brandId}/drafts/${draftId}/recheck`, { method: "POST" }),
  processRecall: (brandId: number, asOf?: string) =>
    request<{ affected_count: number; affected: Array<{ draft_id: number; title: string; revision_id: number; reason: string }>; as_of: string }>(
      `/brands/${brandId}/recall/process`,
      {
        method: "POST",
        body: JSON.stringify({ as_of: asOf || null }),
      }
    ),
  getRecallAlerts: (brandId: number) =>
    request<RecallAlertItem[]>(`/brands/${brandId}/recall/alerts`),
  getNotifications: (brandId: number) =>
    request<AppNotificationItem[]>(`/brands/${brandId}/notifications`),
  markNotificationRead: (brandId: number, notificationId: number) =>
    request<{ status: string; id: number }>(`/brands/${brandId}/notifications/${notificationId}/read`, {
      method: "POST",
    }),
  getQueue: (brandId: number) => request<DraftSummary[]>(`/brands/${brandId}/queue`),
  getInsights: (brandId: number) => request<InsightsData>(`/brands/${brandId}/insights`),
  suggestWording: (brandId: number, ruleKey: string) =>
    request<GuidelineProposalItem>(`/brands/${brandId}/health/${ruleKey}/suggest`, {
      method: "POST",
    }),
  decideProposal: (
    brandId: number,
    proposalId: number,
    decision: "approve" | "reject",
    editedText?: string,
    channelConditions?: ChannelConditionItem[],
    proposedMatchers?: Array<Record<string, unknown>>
  ) =>
    request<GuidelineProposalItem>(`/brands/${brandId}/proposals/${proposalId}/${decision}`, {
      method: "POST",
      body: JSON.stringify({
        edited_text: editedText || null,
        channel_conditions: channelConditions || null,
        proposed_matchers: proposedMatchers || null,
      }),
    }),
  simulateRule: (
    brandId: number,
    ruleKey: string,
    proposedText: string,
    channelConditions: ChannelConditionItem[]
  ) =>
    request<SimulationResult>(`/brands/${brandId}/health/${ruleKey}/simulate`, {
      method: "POST",
      body: JSON.stringify({
        proposed_text: proposedText,
        channel_conditions: channelConditions,
      }),
    }),
  getEvaluation: (brandId: number) =>
    request<EvaluationData>(`/brands/${brandId}/evaluation`),
  runEvaluation: (brandId: number) =>
    request<EvaluationData>(`/brands/${brandId}/evaluation/run`, {
      method: "POST",
    }),
  getSystemMode: () => request<SystemModeInfo>("/system/mode"),
  resetDemo: () => request<{ status: string }>("/demo/reset", { method: "POST" }),
  getSetup: (brandId: number) => request<SetupProgress>(`/brands/${brandId}/setup`),
  skipSetupStep: (brandId: number, step: string) =>
    request<SetupProgress>(`/brands/${brandId}/setup/skip-step`, {
      method: "POST",
      body: JSON.stringify({ step }),
    }),
  dismissSetup: (brandId: number) =>
    request<{ ok: boolean; dismissed: boolean }>(`/brands/${brandId}/setup/dismiss`, {
      method: "POST",
    }),
  resumeSetup: (brandId: number) =>
    request<SetupProgress>(`/brands/${brandId}/setup/resume`, {
      method: "POST",
    }),
  createCompany: (name: string, brandName?: string) =>
    request<{
      company: { id: number; name: string; slug: string };
      brand: { id: number; name: string };
    }>("/companies", {
      method: "POST",
      body: JSON.stringify({ name, brand_name: brandName || null }),
    }),
};
