# BrandLint: Antigravity implementation prompts

Source reviewed: the supplied `hackathon 2.zip`, 29 October 2026. Its 36 relevant source files match the original prototype previously reviewed. These are implementation instructions, not changes already made to the project.

## Review findings

Keep the existing revisions, citations, brand membership checks, creator/reviewer/owner roles, protected-change confirmation, human approval gates, audit history and provider adapters. Improve them rather than replacing the application wholesale.

The main gaps are:
- The original frontend uses technical language and demo personas rather than real company onboarding.
- `DraftReview.tsx` contains fixed success metrics and an unconditional preservation badge.
- `api.py` permits any authenticated user to call the global demo reset, whose seed routine drops and recreates tables.
- Known development signing secrets, seeded accounts and automatic seeding are defaults.
- The browser stores long-lived bearer tokens in localStorage, without a server-side logout/revocation mechanism.
- File uploads are fully read before PDF byte limits are checked; expensive checks and benchmark requests need resource controls.
- The public SPA handler joins requested paths to the build directory without explicit containment validation. This is a potential file-disclosure risk; no exploit was run.
- Claim verification, persisted evidence recall and executable guideline evolution need backend improvements, not merely new UI panels.

## How to use

Open the extracted project folder in Antigravity. Send prompt 00 once, then prompts 01–12 individually, in order, in the same project conversation. After each step, inspect its changes and test results before moving on. Retain a version-control checkpoint after each successful step. Do not paste the entire implementation sequence as one task.

## Prompt 00 — Working rules for every step

You are improving the existing BrandLint React/TypeScript and FastAPI/SQLAlchemy project into a user-friendly SaaS product for company teams. Read the actual repository before editing. Reuse working features and the installed design system; do not migrate frameworks or rebuild unrelated screens. Preserve brand/source citations, revision history, protected edits, human sign-off, existing tenant checks and audit logging.

For each subsequent prompt, implement only that step. Complete frontend, backend, database migrations and meaningful tests where that step requires them. Update API types and consumers together when a contract changes. Never fake metrics, progress, factual support, customer logos, security certifications or successful actions. Keep the configured demo/AI processing mode visible. Never print secret values or put credentials in frontend code. Preserve `frontend/src/components/Loader.tsx` and `.bl-loader*` styles exactly. Do not reset existing data or automatically deploy. Finish with changed files, resulting behavior, actual checks run, configuration still needed and remaining limitations.

## Prompt 01 — Make demo behavior safe before other work

Inspect `backend/app/config.py`, `api.py`, `seed.py`, `main.py`, and the startup scripts. Add explicit development, isolated-demo and production modes. In production, refuse missing/default signing or session secrets; disable automatic demo seeding, shared demo credentials, automatic demo login and persona switching. Remove the global reset route from production. A permitted reset must be limited to an isolated demo database and unavailable to ordinary company users.

Resolve and validate every public static-file path against the frontend build directory, including symlink containment; preserve SPA deep links without returning files outside that directory. Remove `.env`, runtime databases and credentials from release archives; retain a placeholder-only `.env.example`. Do not inspect or print private key values.

Acceptance: missing production secrets prevent startup; reset cannot affect another tenant or a production database; harmless canary files outside the build directory cannot be downloaded, including through encoded traversal variants. Keep local demo startup working. Record the existing build/test baseline without deleting data.

## Prompt 02 — Real sign-in and secure sessions

Replace production demo auto-login with real sign-in, sign-out, expired-session recovery and account recovery. Use revocable server-stored sessions with HttpOnly cookies, Secure in production, an appropriate SameSite policy, idle/absolute expiry and CSRF protection for unsafe requests. Update the frontend API client accordingly; remove authentication credentials from localStorage. Keep a deliberate, local-development cookie configuration separate from production.

Use a maintained Argon2id password implementation, and upgrade existing valid password hashes on successful login. Add generic authentication/recovery errors, configurable throttling, session invalidation after password reset and logout, and short-lived single-use hashed recovery tokens. Use a mail adapter with a safe development implementation; document production mail configuration without claiming delivery is configured.

Acceptance: invalid, expired and revoked sessions fail; logout invalidates the session server-side; CSRF attempts fail; malformed stored hashes do not cause server errors; credentials never appear in URLs or logs. Preserve server-side approval permissions. Follow OWASP session and password-storage guidance.

## Prompt 03 — Company workspaces, invitations and isolation

Implement real company settings, team invitations and membership administration. Make the company the tenant boundary; brands belong to a company. Migrate existing brands safely, initially placing each existing brand in its own company unless an explicit mapping is supplied. Preserve current roles and explain their permissions in plain language. Add an authenticated workspace switcher instead of production persona impersonation.

Invitations must be company-scoped, single-use, expiring and revocable. Only authorized owners/admins can invite, change roles or remove members. Prevent removal of the final owner. Membership removal and permission changes must take effect for existing sessions.

Enforce company/brand/object access at every server entry point, including nested documents, evidence, histories, exports, metrics, jobs, storage and caches. Never trust a company ID merely because the browser supplies it. Propagate verified tenant context into background work.

Acceptance: integration tests with two companies reject cross-company reads and mutations, guessed resource IDs, role escalation and invitation replay. Add migrations and update API types. Retain existing self-approval prevention.

## Prompt 04 — Safe documents, AI requests and abuse controls

Harden `api.py`, `library.py`, provider adapters and expensive API endpoints. Enforce configurable request and upload limits during bounded reads, before entire files enter memory. Explicitly support text PDFs and UTF-8 text; verify signatures and supported types. Bound page count, extracted text, parsing time, pasted text and model context. Reject oversize/invalid input clearly without saving partial records. Run untrusted parsing with resource limits and store original documents privately with tenant authorization.

Treat drafts, PDFs and retrieved text as untrusted data. Keep schema, source-ID, quote/span and server-side permission checks independent of model output. A model must never grant approval, execute instructions from a document or access credentials. Add login throttling and per-user/company quotas, bounded concurrency, model timeouts and cost limits. Replace the expensive benchmark GET with a restricted explicit job action and a separate cached-result read.

Acceptance: test oversized inputs, malformed PDFs, instruction-bearing sources, invented citations, rate-limit responses, tenant-independent quotas and provider failures. Provide request IDs and useful errors without logging confidential content. Follow OWASP upload and LLM-injection guidance.

## Prompt 05 — A plain-language SaaS interface

Refactor the existing frontend around a first-time nontechnical employee. Use navigation labels such as Home, Check content, Approved facts, Approvals, Brand rules and Insights; put account/team settings separately. Explain an Evidence Passport as "the approved source behind this claim" and Guideline Health as "rules your team finds unclear." Keep technical IDs, rule versions and model details available under expandable details.

Create reusable navigation, buttons, fields, status badges, cards, empty/error states and accessible dialogs. Retain a restrained BrandLint aesthetic and dark/Daylight support where present. Give each screen one clear primary action. Keep Must fix, Needs review and Suggestion visibly distinct without replacing actual backend severity or approval rules. Use helpful recovery actions and prevent duplicate submissions.

Acceptance: responsive phone/tablet/desktop layouts, readable contrast, keyboard operation, visible focus and screen-reader labels. A new creator can find where to paste content, start a check, understand an issue and request approval without documentation. Remove invented logos and performance claims.

## Prompt 06 — Guided setup and a useful home screen

Build a resumable, role-aware setup flow: create the company/brand, upload guidelines, inspect and approve extracted rules, register an approved fact with its source, invite a teammate, and check the first draft. Reuse the existing ingestion and source-validation services. Save progress server-side; do not auto-activate AI-extracted rules or bypass owner permissions. Creators should see the next task available to their role rather than owner-only controls.

Create a home screen showing the user's recent drafts, pending approvals, setup progress and evidence needing attention, all from real APIs. Include a clearly separated sample workspace for demonstrations. Empty states should explain what to do next. Show progress only for operations the server actually reports; use indeterminate feedback where no percentage is known.

Acceptance: setup survives refresh, permissions remain enforced, uploading a source does not automatically approve its contents, and a teammate can complete the first content review from the home screen. The user can skip optional invitations and resume unfinished setup later.

## Prompt 07 — Accurate content checking and explained rewrites

Improve `analysis/pipeline.py`, provider schemas, the offline verifier and Draft Review together. Supplement fixed claim triggers with structured claim extraction, validating the returned spans against the saved draft. For each claim compare Product, Metric, Population, Timeframe and Qualifiers against approved evidence. Persist the source reference, dimension findings and uncertainty. Matching a number or finding a quotation is not enough to establish support.

Retain deterministic terminology checks and deterministic evidence validity gates. Provider initialization/errors must degrade safely to needs-review without discarding usable deterministic results. In offline mode, do not simulate semantic proof from token overlap; limit support to explicitly approved equivalent wording and otherwise require review.

Remove fixed scores, hardcoded evidence IDs and automatic "Preserved" badges. Derive displayed counts and measured coverage from the checked revision, with sample size and formula. Separate saved text from proposed edits, preserve protected names/numbers/disclaimers/CTAs and recheck accepted changes. Never show unsupported dimensions as measured.

Acceptance: test unfamiliar factual claims, wrong-metric same-number evidence, missing qualifiers, outdated sources, invented citations, provider failures and stale asynchronous results.

## Prompt 08 — Simple approvals and persisted Evidence Recall

Improve the creator-to-reviewer journey using the existing review states. Show why approval is blocked, who can resolve it and what happens next. Choose an eligible independent reviewer for demo handoffs; production assignments must use real company membership. Submission must never look like approval. Require decision reasons, preserve comments/history and refresh findings after a denied approval that reruns checks.

Implement persisted evidence dependencies from approved revisions to cited evidence/rule versions. On evidence revocation, expiry or relevant rule changes, identify known affected approved content and mark its current validity as Needs revalidation. Preserve the historical approval decision. Provide an auditable reopen, recheck and human reapproval workflow with notifications inside the application. A browser scan alone is not a persisted recall system.

Acceptance: authors cannot self-approve; sensitive content requires the correct reviewer; outdated revisions cannot be approved; revoked evidence cannot support approval even during concurrent requests. Use a controllable clock to test expiry. Repeated recall processing is idempotent, tenant-scoped and does not claim to find undetected claims.

## Prompt 09 — Guideline Health that changes behavior

Improve `insights.py`, rule models, matchers and the Insights screen. Store and display review outcomes by rule version and content channel; separate seeded examples from live outcomes. Show review sample size, override count/rate and uncertainty rather than claiming a rule is bad from a few disagreements.

Allow owners to draft explicit channel conditions, such as casual greetings allowed on Instagram but restricted in investor copy. Represent conditions as validated data, not executable code. A new policy version must include both its wording and the executable conditions/matchers; do not silently copy unchanged matching logic when the intended behavior changes.

Before publishing, evaluate the proposed rule against real saved drafts and show actual changed findings, sample size and unchanged cases. Require owner approval, preserve old versions and route impacted approvals into the revalidation workflow.

Acceptance: v1/v2 statistics remain separate, channel-specific behavior changes as previewed, insufficient history is labelled, proposal publication is permission-checked, and prior analyses retain their historical version pins. Never auto-publish a model's policy suggestion.

## Prompt 10 — Professional motion and accessibility

Create one shared motion system for workspace screens. Keep `Loader.tsx` and all `.bl-loader*` styles exactly unchanged. Use subtle opacity/transform transitions: roughly 120–160 ms for hover/focus feedback, 180–240 ms for drawers/dialogs, and 200–280 ms for workspace changes. Use small movement, restrained easing and short capped list staggers. Apply motion to navigation, source inspectors, issue expansion, rewrite diffs, review-state changes and confirmations only after server success.

Do not delay clicks, manufacture loading progress, animate unmeasured KPI counters, hide critical errors, or add continuous decorative 3D effects to workspaces. Respect prefers-reduced-motion, preserve keyboard focus, announce meaningful async status changes and make every hover action available to keyboard and touch users. Use existing animation tooling or lightweight CSS unless a justified shared dependency is needed. Bundle/pin supporting libraries rather than loading unversioned production scripts, while preserving the protected loader's behavior.

Acceptance: inspect real screens at narrow and wide sizes, reduced-motion mode, slow requests and keyboard-only use. Check animation performance in browser tools; report observations instead of claiming an unmeasured frame rate.

## Prompt 11 — Reliable SaaS operations

Prepare a maintainable company pilot without unnecessary infrastructure rewrites. Use PostgreSQL with versioned migrations instead of production create_all-based schema management. Add durable, tenant-scoped analysis jobs with bounded retries, idempotency, cancellation and real progress/status APIs. Preserve immutable revision/source snapshots and prevent stale results from replacing current results. Add workspace usage limits and server-side usage accounting.

Add readiness/liveness checks, structured request/job logs, request IDs, measured latency/error metrics and actionable operator alerts without draft text or secrets. Document encrypted transport/storage through the selected hosting services, tested backups/restores, tenant-aware retention/deletion, least-privilege database/container credentials and secret rotation. Restrict CORS and add appropriate browser security headers/CSP; resolve third-party script needs without breaking the existing loader.

Acceptance: demonstrate recovery from worker/provider failure, safe duplicate requests, a migration on a copy of seeded data and a real backup restore into a separate test database. Provide local/staging/production configuration templates and a release rollback procedure. Do not add billing, SSO or integrations merely to increase the feature list.

## Prompt 12 — Verify the product and package a release

Run the existing backend suite and add meaningful integration/end-to-end coverage for new behavior. Cover signup/sign-in/session expiry/logout, CSRF, throttling, role changes, expired invitations, two-company isolation, invalid uploads, untrusted source instructions, unfamiliar claims, misleading evidence pairs, protected rewrites, author/reviewer separation, stale approvals, evidence recall and rule-version evolution. Use isolated test data; never reset a real database.

Run `npm --prefix frontend run build` and the backend tests, and fix failures. Inspect the actual UI on phone/tablet/desktop, keyboard-only navigation and reduced-motion mode. Review dependencies against maintained advisories, make builds reproducible and check production configuration refuses demo settings. Report any checks that cannot be executed.

Deliver a concise nontechnical quick start, administrator permissions guide, deployment/runbook, release checklist and a ZIP containing source, migrations, lockfiles and the built frontend. Exclude `.env`, secrets, runtime databases, dependency directories and caches. Report Completed, Configuration needed and Known limitations separately; do not claim enterprise certification or measured reliability without evidence.

## Reference guidance

- OWASP: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
- OWASP: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
- OWASP: https://cheatsheetseries.owasp.org/cheatsheets/Multi_Tenant_Security_Cheat_Sheet.html
- OWASP: https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html
- OWASP: https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html
- MDN: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion
- web.dev: https://web.dev/articles/animations-guide
