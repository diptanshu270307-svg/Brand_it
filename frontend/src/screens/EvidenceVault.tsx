import React, { useEffect, useState } from "react";
import { api, DocumentItem, DraftDetail, Passport } from "../api";
import { SourceModal } from "../components/SourceModal";
import { Badge, Button, Empty, Icon, Metric, Modal, Notice, PageHeading, Panel, errorText, formatDate } from "../components/ui";

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
      setScanNote(`${approved.length - unavailable} of ${approved.length} visible approved drafts inspected.${unavailable ? ` ${unavailable} could not be retrieved; results are incomplete.` : ""}`);
    } catch (e) { setScannedAt(null); setError(errorText(e)); }
    finally { setScanning(false); }
  };
  const decide = async (record: Passport, decision: "approve" | "reject") => {
    setBusyId(record.id); setError("");
    try { await api.decideEvidence(brandId, record.id, decision); await load(); await scan(); }
    catch (e) { setError(errorText(e)); } finally { setBusyId(null); }
  };
  const add = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError("");
    try {
      await api.addEvidence(brandId, { claim_text: form.claim, excerpt: form.excerpt, document_id: form.docId, page: form.page, owner: form.owner, valid_from: form.from || null, valid_until: form.until || null, keywords: form.keywords.split(",").map(k => k.trim()).filter(Boolean) });
      await load(); setShowAdd(false); setForm(f => ({ ...f, claim: "", excerpt: "", owner: "", from: "", until: "", keywords: "" }));
    } catch (e) { setError(errorText(e)); } finally { setSaving(false); }
  };
  const expired = records.filter(r => r.state === "expired" || r.state === "rejected").length;
  const filtered = records.filter(r => filter === "all" || filter === r.state || filter === "unavailable" && isInvalid(r));
  return <div>
    <PageHeading eyebrow="EVIDENCE OPERATIONS / SOURCE OF TRUTH" title="Evidence Vault & Recall" description="Keep every claim connected to its proof. Find approved content whose supporting evidence has changed." action={canCreate && <Button variant="primary" onClick={() => setShowAdd(true)}><Icon name="plus"/>Register evidence</Button>}/>
    {error && <Notice tone="danger" className="mb-5">{error}</Notice>}
    <Panel className="relative mb-8 overflow-hidden p-6 md:p-8">
      <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-fuchsia-500/10 blur-3xl"/>
      <div className="relative flex flex-wrap items-start justify-between gap-5"><div><div className="lv-eyebrow mb-3 flex items-center gap-2"><Icon name="radar"/>EVIDENCE RECALL RADAR</div><h2 className="font-display text-2xl font-medium tracking-tight">Approval has a shelf life.</h2><p className="lv-muted mt-3 max-w-2xl text-sm leading-6">Inspect evidence dependencies of approved drafts visible to your role. Revoked, expired or unapproved proof needs another human review.</p></div><Button variant="primary" disabled={scanning || loading || busyId !== null} onClick={scan}><Icon name={scanning ? "refresh" : "radar"}/>{scanning ? "Inspecting dependencies…" : "Check Affected Content"}</Button></div>
      <div className="relative my-6 grid gap-4 sm:grid-cols-3"><Metric label="Active Passports" value={loading ? "—" : records.filter(r => r.state === "current").length} note="Approved and current" tone="success"/><Metric label="Revoked / Expired" value={loading ? "—" : expired} note="Evidence requiring attention" tone="danger"/><Metric label="Approved Drafts Flagged" value={scannedAt ? affected.length : "—"} note={scannedAt ? `Checked ${new Date(scannedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Run a dependency scan"} tone={affected.length ? "danger" : "neutral"}/></div>
      <Notice><p className="text-xs leading-5">This is a live dependency inspection, not a persisted recall action. The supplied backend retains historical approvals; opening a draft does not change its status. Create a new revision in Draft Review to invalidate approval and run fresh checks.</p></Notice>
      {scanNote && <p className="lv-muted mt-4 font-mono text-xs">{scanNote}</p>}
      {scannedAt && affected.length === 0 && <div className="mt-5"><Empty title="No affected drafts found in this scan">Only linked passports on the latest stored analysis were inspected. This does not measure claims that were never detected.</Empty></div>}
      <div className="mt-5 space-y-3">{affected.map(({ draft, proofs }) => <div key={draft.id} className="rounded-2xl border border-rose-400/25 bg-rose-400/[0.07] p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><Badge tone="danger">Needs revalidation</Badge><h3 className="mt-3 font-display text-lg font-medium">{draft.title.replace(/\[SEEDED SAMPLE\]/gi, "").trim()}</h3><p className="lv-muted mt-2 text-xs">Approved revision {draft.revision} · {draft.channel || "Channel not set"}{draft.seeded ? " · Sample history" : ""}</p></div>{onOpenDraft && <Button onClick={() => onOpenDraft(draft.id)}>Reopen in Review Desk<Icon name="arrow"/></Button>}</div><ul className="mt-4 space-y-2 text-sm">{proofs.map(p => <li key={p.id} className="flex items-start gap-2"><Icon name="alert" className="lv-text-danger mt-0.5" size={15}/><span><span className="font-mono text-xs">{p.ref}</span> is {p.state === "rejected" ? "revoked" : p.state.replace(/_/g, " ")} · {p.document.title}{p.valid_until ? ` · Valid until ${formatDate(p.valid_until)}` : ""}</span></li>)}</ul></div>)}</div>
    </Panel>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-4"><div><div className="lv-eyebrow mb-2">THE EVIDENCE COLLECTION</div><h2 className="font-display text-xl font-medium">Claim passports</h2></div><div className="flex flex-wrap gap-2">{[["all", "All"], ["current", "Current"], ["pending", "Pending"], ["unavailable", "Needs attention"]].map(([key, label]) => <Button key={key} variant={filter === key ? "primary" : "secondary"} onClick={() => setFilter(key)} aria-pressed={filter === key}>{label}</Button>)}</div></div>
    {loading ? <Empty title="Loading Evidence Vault…"/> : filtered.length === 0 ? <Empty title="No passports in this view">Register evidence or choose another filter.</Empty> : <div className="grid gap-5 lg:grid-cols-2">{filtered.map(ev => <Panel key={ev.id} className="flex flex-col p-6"><div className="mb-5 flex items-center justify-between gap-3"><span className="font-mono text-xs tracking-wider">{ev.ref}</span><Badge tone={ev.state === "current" ? "success" : ev.state === "pending" || ev.state === "not_yet_valid" ? "warning" : "danger"}>{ev.state === "rejected" ? "Revoked" : ev.state.replace(/_/g, " ")}</Badge></div><div className="lv-label mb-2">Registered claim</div><h3 className="font-display text-lg font-medium leading-7">{ev.claim_text}</h3><blockquote className="lv-well my-5 flex-1 p-4 text-sm leading-7">“{ev.excerpt}”</blockquote><div className="mb-5 grid gap-4 text-xs sm:grid-cols-2"><div><div className="lv-label mb-1">Source</div><p className="leading-5">{ev.document.title}<br/><span className="lv-muted font-mono">v{ev.document.version} · p.{ev.page}</span></p></div><div><div className="lv-label mb-1">Owner / expiry</div><p className="leading-5">{ev.owner}<br/><span className="lv-muted">{ev.valid_until ? formatDate(ev.valid_until) : "No expiry recorded"}</span></p></div></div><div className="lv-divider flex flex-wrap gap-2 border-t pt-4"><Button onClick={() => setInspected(ev)}><Icon name="file"/>Inspect source</Button>{owner && <Button variant={ev.approval_status === "approved" ? "danger" : "secondary"} disabled={busyId !== null || scanning} onClick={() => decide(ev, ev.approval_status === "approved" ? "reject" : "approve")}>{busyId === ev.id ? "Updating…" : ev.approval_status === "approved" ? "Revoke" : ev.approval_status === "rejected" ? "Restore approval" : "Approve"}</Button>}</div>{!owner && ev.approval_status !== "approved" && <p className="lv-muted mt-3 text-xs">A brand owner must approve this passport.</p>}{ev.state === "expired" && <p className="lv-text-danger mt-3 text-xs">Approval cannot extend an expired evidence window.</p>}</Panel>)}</div>}
    {showAdd && <Modal title="Register evidence passport" onClose={() => { if (!saving) setShowAdd(false); }} wide><form onSubmit={add} className="space-y-5"><p className="lv-muted text-sm leading-6">New evidence starts pending. The source excerpt must occur on the selected page; the server verifies it before saving.</p><div className="grid gap-4 sm:grid-cols-2"><label className="lv-label">Source document<select className="lv-input mt-2" value={form.docId} required onChange={e => setForm(f => ({ ...f, docId: Number(e.target.value), page: 1 }))}><option value={0} disabled>Select a document</option>{docs.map(d => <option key={d.id} value={d.id}>{d.title} · v{d.version}</option>)}</select></label><label className="lv-label">Page number<input className="lv-input mt-2" type="number" min={1} max={docs.find(d => d.id === form.docId)?.pages} value={form.page} required onChange={e => setForm(f => ({ ...f, page: Number(e.target.value) }))}/></label></div><label className="lv-label block">Claim statement<input className="lv-input mt-2" required value={form.claim} onChange={e => setForm(f => ({ ...f, claim: e.target.value }))}/></label><label className="lv-label block">Verbatim supporting excerpt<textarea className="lv-input mt-2" rows={4} required value={form.excerpt} onChange={e => setForm(f => ({ ...f, excerpt: e.target.value }))}/></label><div className="grid gap-4 sm:grid-cols-3"><label className="lv-label">Evidence owner<input className="lv-input mt-2" required value={form.owner} onChange={e => setForm(f => ({ ...f, owner: e.target.value }))}/></label><label className="lv-label">Valid from<input className="lv-input mt-2" type="date" value={form.from} onChange={e => setForm(f => ({ ...f, from: e.target.value }))}/></label><label className="lv-label">Valid until<input className="lv-input mt-2" type="date" min={form.from || undefined} value={form.until} onChange={e => setForm(f => ({ ...f, until: e.target.value }))}/></label></div><label className="lv-label block">Retrieval keywords<input className="lv-input mt-2" value={form.keywords} placeholder="performance, throughput" onChange={e => setForm(f => ({ ...f, keywords: e.target.value }))}/></label>{error && <Notice tone="danger">{error}</Notice>}<Button type="submit" variant="primary" disabled={saving || !form.docId}>{saving ? "Verifying excerpt…" : "Save as pending evidence"}<Icon name="arrow"/></Button></form></Modal>}
    {inspected && <SourceModal brandId={brandId} docId={inspected.document.id} initialPage={inspected.page} highlightExcerpt={inspected.excerpt} passport={inspected} onClose={() => setInspected(null)}/>}
  </div>;
};

