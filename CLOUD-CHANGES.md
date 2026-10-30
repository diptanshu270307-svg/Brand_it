# Cloud deployment preparation

The current appearance and protected loader are retained. Changes include Firebase SPA/API rewrites and static security headers; configurable Firebase __session cookies with server-bound CSRF; protected logout; production password limits and registration throttling; create-account and first-workspace UI; private/no-store API caching and unknown-API JSON 404s; PostgreSQL migration DDL compatibility, migration locking and read-only production startup checks; a non-root Cloud Run container; private document-storage setup; and deployment/secret/smoke-test utilities.

Read DEPLOY-FIREBASE.md for the complete step-by-step CLI sequence. Supply a real Firebase/Google Cloud project, supported Gemini model, Cloud SQL credentials and billing. No cloud account was accessed and no deployment was performed.

## Checks performed

- Frontend production build completed successfully (TypeScript + Vite).
- Initial complete backend run: 151 tests passed; one existing combined file-path/symlink test was blocked by Windows symbolic-link permission (WinError 1314).
- That test was separated so traversal protection runs independently; the symlink-only case skips explicitly on Windows without the privilege. A subsequent run confirmed the traversal case and the platform skip, but the full rerun was interrupted to honor the user's usage limit.
- PostgreSQL DDL compilation and real SQLite incremental migration/retention checks were exercised. Live PostgreSQL/Cloud SQL execution has not been verified.
- Firebase JSON, preparation-script syntax and PowerShell smoke-script syntax checked.
- Docker image build, browser checks and live Firebase/Cloud Run smoke tests were not performed: cloud credentials/project ID were not provided, Firebase/gcloud CLIs were absent, and Docker Desktop's daemon was not running.

## Rollout limits

This is deployment preparation, not a certification of company-wide production readiness. Follow the guide's limits: configure SMTP for invitations/recovery, select an email-verification/onboarding policy, retain the Hosting-compatible __session setting, mount persistent storage, run migrations with the migration identity first, and grant runtime DML permissions separately. Current analysis routes execute inside their HTTP requests; long or bulk processing needs a durable external task queue. Firebase Hosting has a 60-second request limit. The guide uses a conservative single-instance pilot profile, with its availability/cost tradeoff disclosed.

No secrets, runtime databases, development mail outboxes, user-uploaded documents, dependency folders or original nested release archives belong in the release ZIP.
