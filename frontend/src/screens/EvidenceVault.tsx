import React, { useEffect, useState } from "react";
import { api, DocumentItem, Passport } from "../api";
import { SourceModal } from "../components/SourceModal";
import { EvidenceTimelineGraph, EvidenceVaultFlowchart } from "../components/Flowcharts";

interface Props {
  brandId: number;
  role: string;
}

export const EvidenceVault: React.FC<Props> = ({ brandId, role }) => {
  const [records, setRecords] = useState<Passport[]>([]);
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stateFilter, setStateFilter] = useState<string>("all");

  // New evidence form
  const [showAdd, setShowAdd] = useState(false);
  const [claimText, setClaimText] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [docId, setDocId] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [owner, setOwner] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [keywords, setKeywords] = useState("");
  const [busy, setBusy] = useState(false);

  // Source modal
  const [inspectPassport, setInspectPassport] = useState<Passport | null>(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [ev, lib] = await Promise.all([api.listEvidence(brandId), api.library(brandId)]);
      setRecords(ev);
      setDocs(lib.documents);
      if (lib.documents.length > 0 && !docId) {
        const evDoc = lib.documents.find((d) => d.kind === "evidence") || lib.documents[0];
        setDocId(evDoc.id);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load Evidence Vault");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [brandId]);

  const handleDecision = async (id: number, decision: "approve" | "reject") => {
    setError("");
    try {
      await api.decideEvidence(brandId, id, decision);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to update evidence status");
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.addEvidence(brandId, {
        claim_text: claimText,
        excerpt,
        document_id: docId,
        page,
        owner,
        valid_until: validUntil || null,
        keywords: keywords
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      });
      setShowAdd(false);
      setClaimText("");
      setExcerpt("");
      setOwner("");
      setValidUntil("");
      setKeywords("");
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to add evidence");
    } finally {
      setBusy(false);
    }
  };

  const filtered = records.filter((r) => (stateFilter === "all" ? true : r.state === stateFilter));
  const isOwner = role === "brand_owner";
  const canCreate = role === "brand_owner" || role === "senior_reviewer" || role === "reviewer";

  return (
    <div className="screen-container">
      <div className="screen-header">
        <div>
          <div className="eyebrow">CLAIM EVIDENCE PASSPORTS</div>
          <h2>Evidence Vault</h2>
          <p className="subtitle">
            Cryptographically verified promotional claims linked to research source documents, owners, and expiration dates.
          </p>
        </div>
        <div className="btn-row">
          {canCreate && (
            <button className="btn btn-primary" onClick={() => setShowAdd(!showAdd)}>
              {showAdd ? "Close Form" : "+ Register Evidence Record"}
            </button>
          )}
        </div>
      </div>

      {/* 4 KPI Metrics */}
      <div className="metrics-grid-4">
        <div className="metric-box" onClick={() => setStateFilter("all")}>
          <div className="metric-value-row">
            <span className="metric-large-number">{records.length}</span>
            <span className="pill pill-status-approved">Catalog</span>
          </div>
          <div className="metric-title">Total Passports</div>
          <div className="metric-desc">Registered promotional claims</div>
        </div>

        <div className="metric-box" onClick={() => setStateFilter("current")}>
          <div className="metric-value-row">
            <span className="metric-large-number" style={{ color: "var(--ok)" }}>
              {records.filter((r) => r.state === "current").length}
            </span>
            <span className="pill pill-ok">Valid</span>
          </div>
          <div className="metric-title">Approved & Current</div>
          <div className="metric-desc">Unlocks human approval gates</div>
        </div>

        <div className="metric-box metric-highlight-danger" onClick={() => setStateFilter("expired")}>
          <div className="metric-value-row">
            <span className="metric-large-number" style={{ color: "var(--danger)" }}>
              {records.filter((r) => r.state === "expired").length}
            </span>
            <span className="pill pill-danger">Blocks Sign-Off</span>
          </div>
          <div className="metric-title">Expired Proof</div>
          <div className="metric-desc">Stops publication on backend</div>
        </div>

        <div className="metric-box" onClick={() => setStateFilter("pending")}>
          <div className="metric-value-row">
            <span className="metric-large-number" style={{ color: "var(--warn)" }}>
              {records.filter((r) => r.state === "pending").length}
            </span>
            <span className="pill pill-warn">Sign-Off Req.</span>
          </div>
          <div className="metric-title">Pending Owner</div>
          <div className="metric-desc">Awaiting human verification</div>
        </div>
      </div>

      {/* Visual Passport Lifecycle Flowchart */}
      <EvidenceVaultFlowchart />

      {/* Evidence Passport Validity Timeline Graph */}
      <EvidenceTimelineGraph
        passports={records.map((r) => ({
          id: r.id,
          claim: r.claim_text,
          owner: r.owner,
          validUntil: r.valid_until,
          state: (r.state === "current" || r.state === "expired" || r.state === "pending" || r.state === "rejected")
            ? r.state
            : "pending",
          sourceDoc: r.document ? `${r.document.title}, p.${r.page}` : `Page ${r.page}`,
        }))}
        onSelectPassport={(id) => {
          const found = records.find((r) => r.id === id);
          if (found) setInspectPassport(found);
        }}
      />

      {error && <div className="banner banner-error">{error}</div>}

      <div className="filter-bar" style={{ marginBottom: 16 }}>
        {[
          { key: "all", label: `All Passports (${records.length})` },
          {
            key: "current",
            label: `Current & Approved (${records.filter((r) => r.state === "current").length})`,
          },
          {
            key: "expired",
            label: `Expired — Blocks Approval (${records.filter((r) => r.state === "expired").length})`,
          },
          {
            key: "pending",
            label: `Pending Owner Approval (${records.filter((r) => r.state === "pending").length})`,
          },
        ].map((t) => (
          <button
            key={t.key}
            className={`filter-pill ${stateFilter === t.key ? "active" : ""}`}
            onClick={() => setStateFilter(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {showAdd && (
        <div className="card card-accent" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <div>
              <div className="eyebrow">VERBATIM EXCERPT VERIFICATION</div>
              <h3>Register New Claim Evidence Record</h3>
            </div>
          </div>
          <form onSubmit={handleAdd} className="form-stack">
            <div className="form-row">
              <label>
                Source Document
                <select value={docId} onChange={(e) => setDocId(Number(e.target.value))}>
                  {docs.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title} (v{d.version}, {d.pages}p)
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Page Number
                <input
                  type="number"
                  min={1}
                  value={page}
                  onChange={(e) => setPage(Number(e.target.value))}
                  required
                />
              </label>
              <label>
                Evidence Owner
                <input
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                  placeholder="e.g. Priya Nair (Research)"
                  required
                />
              </label>
              <label>
                Valid Until (Expiry Date)
                <input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                />
              </label>
            </div>
            <label>
              Approved Claim Statement (what marketing is allowed to say)
              <input
                value={claimText}
                onChange={(e) => setClaimText(e.target.value)}
                placeholder="e.g. Teams using Lumina Flow reported 18% higher task throughput after 90 days."
                required
              />
            </label>
            <label>
              Exact Supporting Excerpt (must occur verbatim on the selected page of the source
              document — validated by the backend)
              <textarea
                rows={3}
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                placeholder="Copy the exact supporting sentence from the source page..."
                required
              />
            </label>
            <label>
              Retrieval Keywords (comma-separated)
              <input
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="productivity, throughput, performance"
              />
            </label>
            <div className="btn-row">
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? "Verifying Excerpt & Saving..." : "Save Evidence (Starts as Pending)"}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="card">Loading Evidence Vault...</div>
      ) : (
        <div className="vault-grid">
          {filtered.map((ev) => (
            <div key={ev.id} className={`vault-card vault-state-${ev.state}`}>
              <div className="vault-top">
                <div className="btn-row">
                  <span className="rule-key">{ev.ref}</span>
                  <span
                    className={`pill ${
                      ev.state === "current"
                        ? "pill-ev-supported"
                        : ev.state === "expired"
                        ? "pill-ev-expired"
                        : "pill-warn"
                    }`}
                  >
                    {ev.state.toUpperCase()}
                  </span>
                  <span className="pill">Approval: {ev.approval_status}</span>
                </div>
                <button className="btn btn-sm" onClick={() => setInspectPassport(ev)}>
                  Inspect Proof in Source ↗
                </button>
              </div>

              <div className="vault-section">
                <span className="meta-label">APPROVED CLAIM WORDING</span>
                <div className="vault-claim">{ev.claim_text}</div>
              </div>

              <div className="vault-section">
                <span className="meta-label">EXACT SUPPORTING EXCERPT (VERIFIED IN SOURCE)</span>
                <div className="vault-excerpt">“{ev.excerpt}”</div>
              </div>

              <div className="vault-meta-grid">
                <div>
                  <span className="meta-label">SOURCE DOCUMENT & PAGE</span>
                  <div>
                    <strong>
                      {ev.document.title} v{ev.document.version}
                    </strong>
                    , page {ev.page}
                  </div>
                </div>
                <div>
                  <span className="meta-label">EVIDENCE OWNER</span>
                  <div>{ev.owner}</div>
                </div>
                <div>
                  <span className="meta-label">VALIDITY WINDOW</span>
                  <div>
                    {ev.valid_from || "—"} → <strong>{ev.valid_until || "No expiry"}</strong>
                    {ev.state === "expired" && (
                      <span className="inline-warn"> (EXPIRED — blocks claim approval)</span>
                    )}
                  </div>
                </div>
              </div>

              {ev.approval_status === "pending" && (
                <div className="vault-actions">
                  {isOwner ? (
                    <div className="btn-row">
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleDecision(ev.id, "approve")}
                      >
                        ✓ Approve Evidence Passport
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDecision(ev.id, "reject")}
                      >
                        ✕ Reject
                      </button>
                    </div>
                  ) : (
                    <span className="muted-sm">
                      Awaiting Brand Owner approval (switch to Olivia Brooks to approve{" "}
                      <code>{ev.ref}</code>).
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {inspectPassport && (
        <SourceModal
          brandId={brandId}
          docId={inspectPassport.document.id}
          initialPage={inspectPassport.page}
          highlightExcerpt={inspectPassport.excerpt}
          passport={inspectPassport}
          evidenceStatus={
            inspectPassport.state === "current" ? "supported" : inspectPassport.state
          }
          onClose={() => setInspectPassport(null)}
        />
      )}
    </div>
  );
};
