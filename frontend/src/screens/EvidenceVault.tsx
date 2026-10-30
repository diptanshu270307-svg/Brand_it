import React, { useEffect, useState } from "react";
import { api, DocumentItem, DraftDetail, Passport } from "../api";
import { SourceModal } from "../components/SourceModal";
import {
  Badge,
  Button,
  Empty,
  ExpandableDetails,
  Icon,
  Metric,
  Modal,
  Notice,
  PageHeading,
  Panel,
  StatusAnnouncer,
  errorText,
  formatDate,
} from "../components/ui";

interface Props { brandId: number; role: string; onOpenDraft?: (id: number) => void }
interface Affected { draft: DraftDetail; proofs: Passport[] }
const isInvalid = (p: Passport) => p.state !== "current";

export const EvidenceVault: React.FC<Props> = ({ brandId, role, onOpenDraft }) => {
  const [records, setRecords] = useState<Passport[]>([]);
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [inspected, setInspected] = useState<Passport | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [affected, setAffected] = useState<Affected[]>([]);
  const [scannedAt, setScannedAt] = useState<string | null>(null);
  const [scanNote, setScanNote] = useState("");
  const [form, setForm] = useState({ claim: "", excerpt: "", docId: 0, page: 1, owner: "", from: "", until: "", keywords: "" });
  const owner = role === "brand_owner";
  const canCreate = ["brand_owner", "senior_reviewer", "reviewer"].includes(role);

  const load = async () => {
    const [evidence, library] = await Promise.all([api.listEvidence(brandId), api.library(brandId)]);
    setRecords(evidence); setDocs(library.documents);
    setForm(f => ({ ...f, docId: library.documents.some(d => d.id === f.docId) ? f.docId : (library.documents.find(d => d.kind === "evidence") || library.documents[0])?.id || 0 }));
  };

  useEffect(() => {
    let active = true; setLoading(true); setError(""); setAffected([]); setScannedAt(null);
    Promise.all([api.listEvidence(brandId), api.library(brandId)]).then(([evidence, library]) => {
      if (!active) return;
      setRecords(evidence); setDocs(library.documents);
      setForm(f => ({ ...f, docId: (library.documents.find(d => d.kind === "evidence") || library.documents[0])?.id || 0 }));
    }).catch(e => { if (active) setError(errorText(e)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [brandId, role]);

  const scan = async () => {
    if (scanning) return;
    setScanning(true); setError(""); setScanNote(""); setAffected([]); setScannedAt(null);
    try {
      const list = await api.listDrafts(brandId);
      const approved = list.filter(d => d.status === "approved");
      const results = await Promise.allSettled(approved.map(d => api.getDraft(brandId, d.id)));
      const found: Affected[] = []; let unavailable = 0;
      for (const result of results) {
        if (result.status === "rejected") { unavailable++; continue; }
        const proofs = Array.from(new Map(result.value.findings.flatMap(f => f.passport && isInvalid(f.passport) ? [[f.passport.id, f.passport] as const] : [])).values());
        if (proofs.length) found.push({ draft: result.value, proofs });
      }
      setAffected(found); setScannedAt(new Date().toISOString());
      setScanNote(`${approved.length - unavailable} of ${approved.length} approved drafts inspected.${unavailable ? ` ${unavailable} could not be retrieved; results are partial.` : ""}`);
    } catch (e) { setScannedAt(null); setError(errorText(e)); }
    finally { setScanning(false); }
  };

  const decide = async (record: Passport, decision: "approve" | "reject") => {
    setBusyId(record.id); setError("");
    try { await api.decideEvidence(brandId, record.id, decision); await load(); await scan(); }
    catch (e) { setError(errorText(e)); } finally { setBusyId(null); }
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true); setError("");
    try {
      await api.addEvidence(brandId, {
        claim_text: form.claim,
        excerpt: form.excerpt,
        document_id: form.docId,
        page: form.page,
        owner: form.owner,
        valid_from: form.from || null,
        valid_until: form.until || null,
        keywords: form.keywords.split(",").map(k => k.trim()).filter(Boolean),
      });
      await load(); setShowAdd(false); setForm(f => ({ ...f, claim: "", excerpt: "", owner: "", from: "", until: "", keywords: "" }));
    } catch (e) { setError(errorText(e)); } finally { setSaving(false); }
  };

  const expired = records.filter(r => r.state === "expired" || r.state === "rejected").length;
  const filtered = records.filter(r => filter === "all" || filter === r.state || filter === "unavailable" && isInvalid(r));

  return <div>
    <StatusAnnouncer message={error || (scanning ? "Scanning approved drafts…" : null)} />
    <PageHeading
      eyebrow="Evidence Repository"
      title="Approved facts"
      description="The approved sources behind your team's promotional claims. Review, inspect, or recall facts when they expire or change."
      action={canCreate && (
        <Button variant="secondary" onClick={() => setShowAdd(true)}>
          <Icon name="plus" size={14}/> Add approved fact
        </Button>
      )}
    />
    {error && <Notice tone="danger" className="mb-5">{error}</Notice>}

    <Panel className="relative mb-8 overflow-hidden p-6 md:p-8">
      <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-fuchsia-500/10 blur-3xl"/>
      <div className="relative flex flex-wrap items-start justify-between gap-5">
        <div>
          <div className="lv-eyebrow mb-2 flex items-center gap-2">
            <Icon name="radar" size={14}/> OUTDATED CLAIM SCANNER
          </div>
          <h2 className="font-display text-2xl font-medium tracking-tight">Ensure approved content stays valid.</h2>
          <p className="lv-muted mt-2 max-w-2xl text-sm leading-6">
            Scans all published and approved content to identify claims whose evidence has expired, changed, or been revoked.
          </p>
        </div>
        <Button variant="primary" disabled={scanning || loading || busyId !== null} onClick={scan} className="!px-5 !py-2.5">
          <Icon name={scanning ? "refresh" : "radar"} size={16}/>
          {scanning ? "Scanning approved drafts…" : "Scan for outdated claims"}
        </Button>
      </div>

      <div className="relative my-6 grid gap-4 sm:grid-cols-3">
        <Metric label="Current approved facts" value={loading ? "—" : records.filter(r => r.state === "current").length} note="Active sources behind live claims" tone="success"/>
        <Metric label="Expired / Needs attention" value={loading ? "—" : expired} note="Facts requiring renewal or update" tone="danger"/>
        <Metric label="Flagged published drafts" value={scannedAt ? affected.length : "—"} note={scannedAt ? `Checked ${new Date(scannedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Run scan to detect affected drafts"} tone={affected.length ? "danger" : "neutral"}/>
      </div>

      <Notice>
        <p className="text-xs leading-5">
          <strong>How this works:</strong> This live scan inspects approved drafts for outdated or revoked evidence. If a supporting source expires, the draft is flagged so your team can create a revised draft in Check Content.
        </p>
      </Notice>
      {scanNote && <p className="lv-muted mt-3 font-mono text-xs">{scanNote}</p>}

      {scannedAt && affected.length === 0 && (
        <div className="mt-5">
          <Empty title="All published drafts are backed by current facts">
            No approved drafts have expired evidence dependencies.
          </Empty>
        </div>
      )}

      <div className="mt-5 space-y-3">
        {affected.map(({ draft, proofs }) => (
          <div key={draft.id} className="rounded-2xl border border-rose-400/25 bg-rose-400/[0.07] p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <Badge tone="danger">Needs revision</Badge>
                <h3 className="mt-2.5 font-display text-lg font-medium text-ink">{draft.title.replace(/\[SEEDED SAMPLE\]/gi, "").trim()}</h3>
                <p className="lv-muted mt-1 text-xs">Approved revision {draft.revision} · {draft.channel || "General"}{draft.seeded ? " · Sample history" : ""}</p>
              </div>
              {onOpenDraft && (
                <Button onClick={() => onOpenDraft(draft.id)} variant="primary">
                  Open in Check Content <Icon name="arrow" size={14}/>
                </Button>
              )}
            </div>
            <ul className="mt-3.5 space-y-2 text-xs">
              {proofs.map(p => (
                <li key={p.id} className="flex items-start gap-2">
                  <Icon name="alert" className="lv-text-danger mt-0.5 shrink-0" size={14}/>
                  <span>
                    <strong>{p.ref}</strong> is {p.state === "rejected" ? "revoked" : p.state.replace(/_/g, " ")} · Source: {p.document.title}{p.valid_until ? ` · Expired on ${formatDate(p.valid_until)}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Panel>

    <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
      <div>
        <div className="lv-eyebrow mb-1">APPROVED SOURCES</div>
        <h2 className="font-display text-xl font-medium">Claim facts &amp; sources</h2>
      </div>
      <div className="flex flex-wrap gap-2">
        {[["all", "All"], ["current", "Current"], ["pending", "Pending review"], ["unavailable", "Needs attention"]].map(([key, label]) => (
          <Button key={key} variant={filter === key ? "primary" : "secondary"} onClick={() => setFilter(key)} aria-pressed={filter === key}>
            {label}
          </Button>
        ))}
      </div>
    </div>

    {loading ? (
      <Empty title="Loading approved facts…"/>
    ) : filtered.length === 0 ? (
      <Empty title="No facts found in this filter">
        Click "Add approved fact" to register supporting evidence for promotional claims.
      </Empty>
    ) : (
      <div className="grid gap-5 lg:grid-cols-2 motion-stagger">
        {filtered.map(ev => (
          <Panel key={ev.id} className="flex flex-col p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <span className="text-xs font-semibold text-ink block">Evidence Passport</span>
                <span className="text-[11px] text-muted">The approved source behind this claim</span>
              </div>
              <Badge tone={ev.state === "current" ? "success" : ev.state === "pending" || ev.state === "not_yet_valid" ? "warning" : "danger"}>
                {ev.state === "rejected" ? "Revoked" : ev.state.replace(/_/g, " ")}
              </Badge>
            </div>

            <div className="lv-label mb-1 text-[11px]">Approved Claim Statement</div>
            <h3 className="font-display text-lg font-medium leading-7 text-ink">{ev.claim_text}</h3>

            <div className="lv-label mb-1 mt-4 text-[11px]">Verbatim Source Excerpt</div>
            <blockquote className="lv-well mb-4 flex-1 p-3.5 text-sm leading-6 rounded-xl italic text-muted">
              “{ev.excerpt}”
            </blockquote>

            <div className="mb-4 grid gap-3 text-xs sm:grid-cols-2">
              <div>
                <div className="lv-label mb-1">Source document</div>
                <p className="leading-5 text-ink">{ev.document.title}<br/><span className="lv-muted font-mono text-[11px]">v{ev.document.version} · page {ev.page}</span></p>
              </div>
              <div>
                <div className="lv-label mb-1">Owner &amp; validity</div>
                <p className="leading-5 text-ink">{ev.owner}<br/><span className="lv-muted text-[11px]">{ev.valid_until ? `Valid until ${formatDate(ev.valid_until)}` : "No expiry set"}</span></p>
              </div>
            </div>

            {/* Expandable Technical ID audit */}
            <div className="mb-4">
              <ExpandableDetails title="Technical details">
                <div>Passport Ref: <code className="text-ink">{ev.ref}</code></div>
                <div>Document ID: <span>{ev.document.id}</span></div>
                <div>Approval Status: <span className="capitalize">{ev.approval_status}</span></div>
                {ev.keywords && ev.keywords.length > 0 && <div>Keywords: <span>{ev.keywords.join(", ")}</span></div>}
              </ExpandableDetails>
            </div>

            <div className="lv-divider flex flex-wrap gap-2 border-t pt-4">
              <Button onClick={() => setInspected(ev)}>
                <Icon name="file" size={14}/> Inspect source document
              </Button>
              {owner && (
                <Button
                  variant={ev.approval_status === "approved" ? "danger" : "secondary"}
                  disabled={busyId !== null || scanning}
                  onClick={() => decide(ev, ev.approval_status === "approved" ? "reject" : "approve")}
                >
                  {busyId === ev.id ? "Updating…" : ev.approval_status === "approved" ? "Revoke source" : ev.approval_status === "rejected" ? "Restore approval" : "Approve fact"}
                </Button>
              )}
            </div>
            {!owner && ev.approval_status !== "approved" && (
              <p className="lv-muted mt-2.5 text-xs">A Brand Owner must approve this fact before it can verify claims.</p>
            )}
            {ev.state === "expired" && (
              <p className="lv-text-danger mt-2 text-xs">Approval cannot extend an expired evidence date window.</p>
            )}
          </Panel>
        ))}
      </div>
    )}

    {showAdd && (
      <Modal title="Register approved fact" onClose={() => { if (!saving) setShowAdd(false); }} wide>
        <form onSubmit={add} className="space-y-4">
          <p className="lv-muted text-xs leading-5">
            Register supporting proof for a promotional claim. The source excerpt must match text on the specified page.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="lv-label">
              Source document
              <select className="lv-input mt-1.5" value={form.docId} required onChange={e => setForm(f => ({ ...f, docId: Number(e.target.value), page: 1 }))}>
                <option value={0} disabled>Select a document</option>
                {docs.map(d => (
                  <option key={d.id} value={d.id}>{d.title} · v{d.version}</option>
                ))}
              </select>
            </label>
            <label className="lv-label">
              Page number
              <input className="lv-input mt-1.5" type="number" min={1} max={docs.find(d => d.id === form.docId)?.pages} value={form.page} required onChange={e => setForm(f => ({ ...f, page: Number(e.target.value) }))}/>
            </label>
          </div>
          <label className="lv-label block">
            Promotional claim statement
            <input className="lv-input mt-1.5" required placeholder="e.g. Reduces data ingestion latency by 40%" value={form.claim} onChange={e => setForm(f => ({ ...f, claim: e.target.value }))}/>
          </label>
          <label className="lv-label block">
            Verbatim supporting excerpt from document
            <textarea className="lv-input mt-1.5" rows={3} required placeholder="Exact quote from the document..." value={form.excerpt} onChange={e => setForm(f => ({ ...f, excerpt: e.target.value }))}/>
          </label>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="lv-label">
              Fact owner / Author
              <input className="lv-input mt-1.5" required placeholder="e.g. Legal Team" value={form.owner} onChange={e => setForm(f => ({ ...f, owner: e.target.value }))}/>
            </label>
            <label className="lv-label">
              Valid from
              <input className="lv-input mt-1.5" type="date" value={form.from} onChange={e => setForm(f => ({ ...f, from: e.target.value }))}/>
            </label>
            <label className="lv-label">
              Valid until (expiry)
              <input className="lv-input mt-1.5" type="date" min={form.from || undefined} value={form.until} onChange={e => setForm(f => ({ ...f, until: e.target.value }))}/>
            </label>
          </div>
          <label className="lv-label block">
            Matching keywords (comma-separated)
            <input className="lv-input mt-1.5" value={form.keywords} placeholder="latency, speed, performance" onChange={e => setForm(f => ({ ...f, keywords: e.target.value }))}/>
          </label>
          {error && <Notice tone="danger">{error}</Notice>}
          <div className="flex justify-end gap-2 pt-2 border-t border-line/40">
            <Button disabled={saving} onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={saving || !form.docId}>
              {saving ? "Verifying excerpt against page…" : "Save approved fact"}
            </Button>
          </div>
        </form>
      </Modal>
    )}
    {inspected && (
      <SourceModal
        brandId={brandId}
        docId={inspected.document.id}
        initialPage={inspected.page}
        highlightExcerpt={inspected.excerpt}
        passport={inspected}
        onClose={() => setInspected(null)}
      />
    )}
  </div>;
};

