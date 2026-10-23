export interface UserInfo {
  id: number;
  name: string;
  email: string;
}

export interface BrandInfo {
  id: number;
  name: string;
  description: string;
  role: "creator" | "reviewer" | "senior_reviewer" | "brand_owner";
  protected_terms: string[];
}

export interface PrivacyInfo {
  provider: string;
  hosted: boolean;
  notice: string;
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
}

export interface DraftSummary {
  id: number;
  title: string;
  channel: string;
  status: "draft" | "checked" | "in_review" | "senior_review" | "changes_requested" | "approved";
  route: "standard" | "senior" | null;
  author: string;
  author_id: number;
  seeded: boolean;
  revision: number;
  updated_at: string;
  actionable?: boolean;
}

export interface DraftDetail extends DraftSummary {
  revision_id: number;
  text: string;
  audience: string;
  purpose: string;
  cta: string;
  approved_revision_id: number | null;
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
  blockers: { code: string; finding_id?: number; message: string }[];
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

export interface GuidelineProposalItem {
  id: number;
  rule_key: string;
  current_text: string;
  proposed_text: string;
  rationale: string;
  override_count: number;
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
  overrides: number;
  accepted: number;
  decisions: number;
  override_rate: number | null;
  seeded_overrides: number;
  live_overrides: number;
  insufficient_history: boolean;
  min_sample: number;
  reasons: { reason: string; count: number }[];
  examples: { excerpt: string; reason: string; seeded: boolean }[];
  proposal: GuidelineProposalItem | null;
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

let authToken: string = localStorage.getItem("brandlint_token") || "";

export function setToken(t: string) {
  authToken = t;
  if (t) localStorage.setItem("brandlint_token", t);
  else localStorage.removeItem("brandlint_token");
}

export function getToken(): string {
  return authToken;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers || {});
  if (authToken) headers.set("Authorization", `Bearer ${authToken}`);
  if (!(init.body instanceof FormData) && init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(`/api${path}`, { ...init, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const d = data?.detail;
    const msg =
      typeof d === "string"
        ? d
        : d?.message || (Array.isArray(d) ? d.map((x: { msg?: string }) => x.msg).join("; ") : `Request failed (${res.status})`);
    throw new ApiError(res.status, msg, d);
  }
  return data as T;
}

export const api = {
  login: (email: string, password = "demo1234") =>
    request<{ token: string; user: UserInfo }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  me: () => request<{ user: UserInfo; brands: BrandInfo[]; privacy: PrivacyInfo }>("/me"),
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
    editedText?: string
  ) =>
    request<GuidelineProposalItem>(`/brands/${brandId}/proposals/${proposalId}/${decision}`, {
      method: "POST",
      body: JSON.stringify({ edited_text: editedText || null }),
    }),
  getEvaluation: (brandId: number) =>
    request<EvaluationData>(`/brands/${brandId}/evaluation`),
  resetDemo: () => request<{ status: string }>("/demo/reset", { method: "POST" }),
};
