import React, { useEffect, useState } from "react";
import { api, DocumentItem, Passport } from "../api";

interface Props {
  brandId: number;
  docId: number;
  initialPage?: number;
  highlightExcerpt?: string;
  passport?: Passport | null;
  claimQuote?: string;
  evidenceStatus?: string | null;
  onClose: () => void;
}

function renderHighlightedPage(text: string, excerpt?: string) {
  if (!excerpt || !excerpt.trim()) return <pre className="source-pre">{text}</pre>;
  const idx = text.toLowerCase().indexOf(excerpt.trim().toLowerCase());
  if (idx < 0) return <pre className="source-pre">{text}</pre>;
  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + excerpt.trim().length);
  const after = text.slice(idx + excerpt.trim().length);
  return (
    <pre className="source-pre">
      {before}
      <mark className="source-highlight">{match}</mark>
      {after}
    </pre>
  );
}

export const SourceModal: React.FC<Props> = ({
  brandId,
  docId,
  initialPage = 1,
  highlightExcerpt,
  passport,
  claimQuote,
  evidenceStatus,
  onClose,
}) => {
  const [doc, setDoc] = useState<DocumentItem | null>(null);
  const [page, setPage] = useState<number>(initialPage || 1);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let active = true;
    api
      .getDocument(brandId, docId)
      .then((d) => {
        if (active) {
          setDoc(d);
          setPage(Math.min(Math.max(1, initialPage || 1), d.pages || 1));
        }
      })
      .catch((e) => {
        if (active) setError(e.message || "Could not load document");
      });
    return () => {
      active = false;
    };
  }, [brandId, docId, initialPage]);

  const pages = doc?.page_text || [];
  const currentPageText = pages[page - 1] || "";

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="eyebrow">
              {passport ? `CLAIM EVIDENCE PASSPORT · ${passport.ref}` : "SOURCE OF TRUTH INSPECTOR"}
            </div>
            <h3>
              {doc ? `${doc.title} (v${doc.version})` : "Loading source..."}
            </h3>
          </div>
          <button className="btn btn-ghost" onClick={onClose}>
            Close ✕
          </button>
        </div>

        {error && <div className="banner banner-error">{error}</div>}

        {passport && (
          <div className={`passport-sheet passport-${evidenceStatus || passport.state}`}>
            <div className="passport-grid">
              <div>
                <span className="meta-label">Passport Status</span>
                <div>
                  <span className={`pill pill-ev-${evidenceStatus || passport.state}`}>
                    {(evidenceStatus || passport.state).toUpperCase()}
                  </span>
                </div>
              </div>
              <div>
                <span className="meta-label">Evidence Owner</span>
                <div className="meta-val">{passport.owner}</div>
              </div>
              <div>
                <span className="meta-label">Valid Until / Expiry</span>
                <div className="meta-val">
                  {passport.valid_until || "No expiry"}
                  {passport.state === "expired" && (
                    <span className="inline-warn"> (EXPIRED — blocks approval)</span>
                  )}
                </div>
              </div>
              <div>
                <span className="meta-label">Source Reference</span>
                <div className="meta-val">
                  {passport.document.title} v{passport.document.version}, page {passport.page}
                </div>
              </div>
            </div>
            {claimQuote && (
              <div className="passport-row">
                <span className="meta-label">Draft Claim</span>
                <div className="quote-box">“{claimQuote}”</div>
              </div>
            )}
            <div className="passport-row">
              <span className="meta-label">Approved Claim Statement</span>
              <div className="quote-box">{passport.claim_text}</div>
            </div>
            <div className="passport-row">
              <span className="meta-label">Exact Supporting Excerpt</span>
              <div className="quote-box quote-excerpt">“{passport.excerpt}”</div>
            </div>
          </div>
        )}

        {doc?.suspicious && (
          <div className="banner banner-warn">
            <strong>Untrusted Content Guardrail:</strong> This document contains instruction-like lines
            that look like prompt injection. BrandLint treats all uploaded documents strictly as data,
            never as instructions:
            <ul>
              {doc.suspicious_notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          </div>
        )}

        {doc && (
          <div className="source-page-box">
            <div className="source-page-bar">
              <span>
                Document Page {page} of {doc.pages}
                {doc.expires_on ? ` · Source expires ${doc.expires_on}` : ""}
              </span>
              {doc.pages > 1 && (
                <div className="btn-row">
                  <button
                    className="btn btn-sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    ← Prev page
                  </button>
                  <button
                    className="btn btn-sm"
                    disabled={page >= doc.pages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next page →
                  </button>
                </div>
              )}
            </div>
            {renderHighlightedPage(currentPageText, highlightExcerpt || passport?.excerpt)}
          </div>
        )}
      </div>
    </div>
  );
};
