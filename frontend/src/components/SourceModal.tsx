import React, { useEffect, useState } from "react";
import { api, DocumentItem, Passport } from "../api";
import { Badge, Button, Empty, Icon, Modal, Notice, errorText, formatDate } from "./ui";

interface Props {
  brandId: number; docId: number; initialPage?: number; highlightExcerpt?: string;
  passport?: Passport | null; claimQuote?: string; evidenceStatus?: string | null; onClose: () => void;
}
export const SourceModal: React.FC<Props> = ({ brandId, docId, initialPage = 1, highlightExcerpt, passport, claimQuote, evidenceStatus, onClose }) => {
  const [doc, setDoc] = useState<DocumentItem | null>(null);
  const [page, setPage] = useState(initialPage);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setDoc(null); setError("");
    api.getDocument(brandId, docId).then(d => {
      if (!active) return;
      setDoc(d); setPage(Math.max(1, Math.min(initialPage, d.pages || 1)));
    }).catch(e => { if (active) setError(errorText(e)); });
    return () => { active = false; };
  }, [brandId, docId, initialPage]);
  const text = doc?.page_text?.[page - 1] || "";
  const excerpt = (highlightExcerpt || passport?.excerpt || "").trim();
  const index = excerpt ? text.toLowerCase().indexOf(excerpt.toLowerCase()) : -1;
  const state = passport?.state;
  return <Modal title="Source proof inspector" onClose={onClose} wide>
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div><div className="lv-eyebrow mb-2">{passport ? `EVIDENCE PASSPORT / ${passport.ref}` : "VERSIONED SOURCE"}</div><h3 className="font-display text-xl font-medium">{doc ? doc.title : "Loading source…"}</h3></div>
      <div className="flex flex-wrap gap-2">{doc && <Badge>v{doc.version} · {doc.pages} pages</Badge>}{passport && <Badge tone={state === "current" ? "success" : state === "pending" || state === "not_yet_valid" ? "warning" : "danger"}>{state === "rejected" ? "Revoked" : state?.replace(/_/g, " ")}</Badge>}</div>
    </div>
    {error && <Notice tone="danger" className="mb-5">{error}</Notice>}
    {passport && <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_1.3fr]">
      <div className="lv-well space-y-5 p-5">
        <div><div className="lv-label">Evidence owner</div><p className="mt-1 text-sm">{passport.owner || "Not recorded"}</p></div>
        <div><div className="lv-label">Validity window</div><p className="mt-1 font-mono text-xs">{formatDate(passport.valid_from)} → {passport.valid_until ? formatDate(passport.valid_until) : "No expiry recorded"}</p></div>
        <div><div className="lv-label">Pinned source reference</div><p className="mt-1 text-sm leading-6">{passport.document.title}<br/><span className="lv-muted font-mono text-xs">v{passport.document.version} · page {passport.page}</span></p></div>
        {evidenceStatus && <div><div className="lv-label">Claim check result</div><p className="mt-1 text-sm">{evidenceStatus.replace(/_/g, " ")}</p><p className="lv-muted mt-2 text-xs leading-5">A current passport and a supported claim are separate checks.</p></div>}
      </div>
      <div className="space-y-4">
        {claimQuote && <div><div className="lv-label mb-2">Draft claim</div><blockquote className="lv-well p-4 text-sm leading-7">“{claimQuote}”</blockquote></div>}
        <div><div className="lv-label mb-2">Registered claim statement</div><p className="text-sm leading-7">{passport.claim_text}</p></div>
        <div><div className="lv-label mb-2">Exact supporting excerpt</div><blockquote className="lv-well border-l-2 border-l-indigo-400 p-4 text-sm leading-7">“{passport.excerpt}”</blockquote></div>
      </div>
    </div>}
    {doc?.suspicious && <Notice tone="warning" className="mb-5"><div className="mb-2 flex items-center gap-2 font-semibold"><Icon name="shield"/>Untrusted document content</div><p className="text-sm">Instruction-like text was detected. Uploaded text is source data, not an instruction to the reviewer.</p><ul className="mt-2 list-disc space-y-1 pl-5 text-xs">{doc.suspicious_notes.map((note, i) => <li key={i}>{note}</li>)}</ul></Notice>}
    {doc ? <section className="lv-well overflow-hidden" aria-label="Source page">
      <div className="lv-divider flex flex-wrap items-center justify-between gap-3 border-b p-4"><div className="font-mono text-xs">PAGE {page} / {doc.pages}{doc.expires_on && <span className="lv-muted"> · Expires {formatDate(doc.expires_on)}</span>}</div><div className="flex gap-2"><Button variant="ghost" disabled={page <= 1} onClick={() => setPage(p => p - 1)} aria-label="Previous source page">← Previous</Button><Button variant="ghost" disabled={page >= doc.pages} onClick={() => setPage(p => p + 1)} aria-label="Next source page">Next →</Button></div></div>
      <pre className="max-h-[45vh] overflow-auto whitespace-pre-wrap break-words p-6 font-sans text-sm leading-8">{index >= 0 ? <>{text.slice(0, index)}<mark className="rounded bg-indigo-400/20 px-1 text-inherit ring-1 ring-indigo-400/30">{text.slice(index, index + excerpt.length)}</mark>{text.slice(index + excerpt.length)}</> : text || "No text returned for this page."}</pre>
      {excerpt && index < 0 && <div className="lv-muted px-6 pb-5 text-xs">The selected excerpt is not located on this displayed page. Check the pinned page reference.</div>}
    </section> : !error && <Empty title="Retrieving the original source">Loading document text and its version reference.</Empty>}
  </Modal>;
};

