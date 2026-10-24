# BrandLint — Enterprise Review Desk (Obsidian Precision)
## Complete Source Files Export & Download Directory

All production source code and styling files for **BrandLint** are available in the project workspace. Below is the complete manifest and structure for quick reference and download:

---

### Project Structure Overview

```text
brandlint-frontend/
├── index.html                      # Entry HTML with custom fonts & vector favicon
├── package.json                    # Project dependencies (React 18, Vite, TypeScript)
├── tsconfig.json                   # TypeScript compiler configuration
├── vite.config.ts                  # Vite build tool and API proxy config
└── src/
    ├── main.tsx                    # React DOM root bootstrapping
    ├── App.tsx                     # Master app shell, navigation & 5-step pitch guide
    ├── api.ts                      # Full TypeScript interfaces & API client definitions
    ├── styles.css                  # Next-gen Obsidian design system & glassmorphism
    └── screens/
        ├── AppleIntro.tsx          # High-impact Hero showcase, CLI terminal & Bento grid
        ├── BrandLibrary.tsx        # Screen 1: Source docs, rule extraction & owner gates
        ├── DraftReview.tsx         # Screen 2: Pre-flight checks, passports & diffs
        ├── EvidenceVault.tsx       # Screen 3: Approved claims, excerpts & expiry tracking
        ├── ReviewQueue.tsx         # Screen 4: Role-based approval gates & audit log
        └── Insights.tsx            # Screen 5: Guideline health & evaluation benchmark
```

---

### Manifest of Workspace Files

| File Name | Workspace Asset ID | Description |
| :--- | :--- | :--- |
| **`styles.css`** | `{{DATA:DOCUMENT:DOCUMENT_2}}` | Obsidian Precision CSS system, animations, glowing borders & glassmorphism |
| **`App.tsx`** | `{{DATA:DOCUMENT:DOCUMENT_15}}` | Global layout frame, header navigation, role switcher & pitch bar |
| **`AppleIntro.tsx`** | `{{DATA:DOCUMENT:DOCUMENT_13}}` | Hero landing view, CLI simulator, bento cards & walkthrough |
| **`DraftReview.tsx`** | `{{DATA:DOCUMENT:DOCUMENT_11}}` | Live draft checker, inline highlight markup, intent diffs |
| **`EvidenceVault.tsx`**| `{{DATA:DOCUMENT:DOCUMENT_10}}` | Claim evidence vault, passport registration & source excerpts |
| **`ReviewQueue.tsx`**  | `{{DATA:DOCUMENT:DOCUMENT_8}}`  | Multi-role human approval gates, blocker checks & audit logs |
| **`Insights.tsx`**     | `{{DATA:DOCUMENT:DOCUMENT_9}}`  | Override metrics, guideline wording suggestions & eval stats |
| **`BrandLibrary.tsx`** | `{{DATA:DOCUMENT:DOCUMENT_12}}` | PDF upload/paste ingestion, proposed rules & untrusted guards |
| **`api.ts`**           | `{{DATA:DOCUMENT:DOCUMENT_16}}` | Full REST client, mock payloads, error types & auth handlers |
| **`index.html`**       | `{{DATA:DOCUMENT:DOCUMENT_7}}`  | HTML shell with Inter, Inter Tight & JetBrains Mono typography |
| **`main.tsx`**         | `{{DATA:DOCUMENT:DOCUMENT_14}}` | React 18 client entry point |
| **`package.json`**     | `{{DATA:DOCUMENT:DOCUMENT_5}}`  | Dependencies: `react`, `react-dom`, `vite`, `typescript` |
| **`vite.config.ts`**   | `{{DATA:DOCUMENT:DOCUMENT_3}}`  | Vite server config with `/api` proxy routing |
| **`tsconfig.json`**    | `{{DATA:DOCUMENT:DOCUMENT_4}}`  | Strict TypeScript compiler configuration |

---

### Quick Setup Instructions

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the local development server:**
   ```bash
   npm run dev
   ```

3. **Production build:**
   ```bash
   npm run build
   ```
