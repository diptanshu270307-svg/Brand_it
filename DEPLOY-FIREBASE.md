# Deploy BrandLint: Firebase Hosting + Cloud Run + Cloud SQL

This guide deploys the supplied appearance and functionality, with production integration fixes. The archive includes a checked frontend build, Firebase rewrites, a non-root Dockerfile, PostgreSQL-compatible migrations, and Firebase-compatible cookie sessions. **No cloud deployment has been performed.** Supply your own project, billing, credentials, database and provider configuration.

## 1. Choose the project and command environment

The commands below are **Bash commands for Google Cloud Shell**, not PowerShell. Upload/extract this project in Cloud Shell and run commands from its root, beside `firebase.json` and `Dockerfile`. Local frontend development can continue on Windows.

Use one existing Firebase/Google Cloud project with billing enabled (Firebase Blaze). The example region is `us-central1`; choose a Firebase-supported Cloud Run region, and keep it consistent across Hosting, Run, Artifact Registry and preferably Cloud SQL. Do not put keys in frontend environment variables.

```bash
set -euo pipefail
export PROJECT_ID="YOUR_REAL_PROJECT_ID"
export REGION="us-central1"
export SQL_INSTANCE="brandlint-postgres"
export DATABASE="brandlint"
export CONNECTION_NAME="${PROJECT_ID}:${REGION}:${SQL_INSTANCE}"
export BUCKET="${PROJECT_ID}-brandlint-documents"
export RUNTIME_SA="brandlint-runtime@${PROJECT_ID}.iam.gserviceaccount.com"
export MIGRATION_SA="brandlint-migrate@${PROJECT_ID}.iam.gserviceaccount.com"
export MODEL="YOUR_CURRENTLY_AVAILABLE_GEMINI_MODEL_ID"

gcloud auth login
gcloud config set project "$PROJECT_ID"
npm install --global firebase-tools
firebase login --no-localhost
firebase projects:list
```

If the Google Cloud project does not yet have Firebase enabled, add Firebase in its console or use `firebase projects:addfirebase "$PROJECT_ID"`. Confirm you selected the intended existing project.

```bash
gcloud services enable run.googleapis.com artifactregistry.googleapis.com \
  cloudbuild.googleapis.com secretmanager.googleapis.com sqladmin.googleapis.com \
  storage.googleapis.com firebasehosting.googleapis.com

npm --prefix frontend ci
npm --prefix frontend run build
node deploy/google-cloud/prepare.mjs --project "$PROJECT_ID" \
  --region "$REGION" --model "$MODEL"
```

The preparation command updates all Run rewrite regions, writes `.firebaserc` and creates `deploy/google-cloud/backend.generated.yaml`. This YAML contains configuration, **not secret values**. Add `--public-url https://your-domain.example` for a configured custom domain, or `--site YOUR_HOSTING_SITE_ID` for a non-default Firebase Hosting site.

### About `firebase init`

The included `firebase.json` already initializes Hosting configuration; initialization is not required again. If you explicitly want the interactive CLI setup, retain the generated configuration:

```bash
cp firebase.json /tmp/brandlint-firebase.json
firebase init hosting --project "$PROJECT_ID"
# Choose: existing project; public directory frontend/dist; SPA Yes.
# GitHub automation: No for now. Overwrite index.html: No.
cp /tmp/brandlint-firebase.json firebase.json
```

Restoring the provided file is important: interactive initialization may replace the API rewrite rules.

## 2. Create infrastructure, or use your existing resources

Skip creation commands for resources that already exist. Use your organization's approved database size/availability policy. This example is a small single-zone deployment; enable regional HA for a production availability requirement. Cloud SQL, storage and Run usage can incur charges.

```bash
gcloud artifacts repositories create brandlint --repository-format=docker \
  --location="$REGION" --description="BrandLint application images"

gcloud sql instances create "$SQL_INSTANCE" --database-version=POSTGRES_16 \
  --edition=ENTERPRISE --tier=db-custom-1-3840 --region="$REGION" \
  --storage-size=10GB --storage-auto-increase --backup-start-time=03:00 \
  --enable-point-in-time-recovery --deletion-protection
gcloud sql databases create "$DATABASE" --instance="$SQL_INSTANCE"

gcloud storage buckets create "gs://${BUCKET}" --location="$REGION" \
  --uniform-bucket-level-access --public-access-prevention

gcloud iam service-accounts create brandlint-runtime --display-name="BrandLint runtime"
gcloud iam service-accounts create brandlint-migrate --display-name="BrandLint migrations"
for identity in "$RUNTIME_SA" "$MIGRATION_SA"; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${identity}" --role=roles/cloudsql.client
done
gcloud storage buckets add-iam-policy-binding "gs://${BUCKET}" \
  --member="serviceAccount:${RUNTIME_SA}" --role=roles/storage.objectUser
```

Do not make the document bucket public. The application reads original files through a Cloud Storage volume mount and serves them only after company/brand authorization. Container-local document files otherwise disappear on restart.

## 3. Bootstrap least-privilege database roles

Set the instance's `postgres` administrator password in Cloud SQL if this is a new instance. Connect interactively from Cloud Shell; the command prompts for that existing password:

```bash
gcloud sql connect "$SQL_INSTANCE" --user=postgres --database="$DATABASE"
```

Inside the resulting `psql` session, run:

```text
\i deploy/google-cloud/bootstrap-database.sql
\q
```

The script creates `brandlint_migrator` and `brandlint_app`, with hidden password prompts. The migrator may create schema objects; the application gets data permissions after migrations. If these roles already exist, inspect them rather than rerunning CREATE ROLE. If you chose different database/user names, update the two SQL files accordingly.

## 4. Put secrets in Secret Manager

The helper sends secret values to `gcloud` over stdin. It does not print values, write them to files or pass passwords in command arguments. It URL-encodes database credentials and constructs a Unix-socket SQLAlchemy URL:

`postgresql+psycopg://USER:ENCODED_PASSWORD@/brandlint?host=%2Fcloudsql%2FPROJECT%3AREGION%3AINSTANCE`

```bash
python3 deploy/google-cloud/create-secret.py --project "$PROJECT_ID" \
  --name brandlint-secret-key --generate
python3 deploy/google-cloud/create-secret.py --project "$PROJECT_ID" \
  --name brandlint-database-url --connection "$CONNECTION_NAME" \
  --database "$DATABASE" --database-user brandlint_app
python3 deploy/google-cloud/create-secret.py --project "$PROJECT_ID" \
  --name brandlint-migration-database-url --connection "$CONNECTION_NAME" \
  --database "$DATABASE" --database-user brandlint_migrator
python3 deploy/google-cloud/create-secret.py --project "$PROJECT_ID" \
  --name brandlint-gemini-key

for secret in brandlint-secret-key brandlint-database-url brandlint-gemini-key; do
  gcloud secrets add-iam-policy-binding "$secret" \
    --member="serviceAccount:${RUNTIME_SA}" --role=roles/secretmanager.secretAccessor
done
gcloud secrets add-iam-policy-binding brandlint-migration-database-url \
  --member="serviceAccount:${MIGRATION_SA}" --role=roles/secretmanager.secretAccessor
```

The commands below pin version `1`. On rotation, use the helper's `--add-version` flag and update the affected service/job to the returned numeric version. Do not assume `latest` is a reproducible release.

### Configure email before inviting a company team

The generated configuration deliberately sets `MAIL_PROVIDER=none`; this does not deliver invitations or recovery emails. To enable delivery, edit `backend.generated.yaml` with your actual SMTP host/from/port and `MAIL_PROVIDER=smtp`; add SMTP username/password through Secret Manager and runtime IAM as above, then include their mappings in `--set-secrets`. Registration and first workspace creation do not require email delivery. Public registration currently does not verify address ownership; use an appropriate onboarding policy before accepting untrusted company tenants.

## 5. Build and push the container

```bash
export TAG="$(date -u +%Y%m%d-%H%M%S)"
export IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/brandlint/brandlint-backend:${TAG}"
gcloud builds submit . --tag="$IMAGE" --region="$REGION"
```

This builds the existing Dockerfile remotely; local Docker Desktop is unnecessary. The Dockerfile now uses `npm ci`, runs as an unprivileged user and honors Cloud Run's `PORT`. Its working directory is `/app`, so the requested migration path is valid.

The deployment identity needs Cloud Build submission, Artifact Registry write, Run administration, service-account impersonation (`actAs`), Secret Manager/IAM configuration and Firebase Hosting permissions. Use your organization's provisioned deployer. To identify the default builder when diagnosing a push denial:

```bash
gcloud builds get-default-service-account --region="$REGION"
# Grant that actual builder Artifact Registry writer on the brandlint repository
# if it has not already been provisioned. Do not grant project Editor as a shortcut.
```

## 6. Run versioned migrations before starting the service

```bash
gcloud run jobs deploy brandlint-migrate --image="$IMAGE" --region="$REGION" \
  --service-account="$MIGRATION_SA" --set-cloudsql-instances="$CONNECTION_NAME" \
  --set-env-vars=APP_MODE=production,SEED_ON_STARTUP=false,AUTO_MIGRATE=false \
  --set-secrets=DATABASE_URL=brandlint-migration-database-url:1 \
  --command=python --args=backend/scripts/migrate.py,upgrade \
  --tasks=1 --parallelism=1 --max-retries=0 --task-timeout=600s
gcloud run jobs execute brandlint-migrate --region="$REGION" --wait
```

This executes exactly `python backend/scripts/migrate.py upgrade` inside the image, attached to Cloud SQL. It also performs the existing legacy-company data backfill. Migrations serialize through a PostgreSQL advisory lock. **Proceed only after this job succeeds.** Production web startup now checks the schema version without attempting DDL.

After the first successful migration, connect as the schema owner:

```bash
gcloud sql connect "$SQL_INSTANCE" --user=brandlint_migrator --database="$DATABASE"
```

Inside `psql`:

```text
\i deploy/google-cloud/grant-runtime.sql
\q
```

The runtime account receives DML/table and sequence permissions, not schema creation. Its schema_migrations access is read-only. Default privileges cover tables created by later migration releases; review grants after schema changes.

## 7. Deploy the backend

```bash
gcloud run deploy brandlint-backend --image="$IMAGE" --region="$REGION" \
  --execution-environment=gen2 --service-account="$RUNTIME_SA" \
  --add-cloudsql-instances="$CONNECTION_NAME" \
  --env-vars-file=deploy/google-cloud/backend.generated.yaml \
  --set-secrets=SECRET_KEY=brandlint-secret-key:1,DATABASE_URL=brandlint-database-url:1,GEMINI_API_KEY=brandlint-gemini-key:1 \
  --add-volume="name=documents,type=cloud-storage,bucket=${BUCKET},mount-options=uid=10001;gid=10001;file-mode=660;dir-mode=770" \
  --add-volume-mount=volume=documents,mount-path=/mnt/documents \
  --port=8080 --cpu=1 --memory=1Gi --concurrency=4 \
  --min-instances=1 --max-instances=1 --no-cpu-throttling \
  --timeout=55s --ingress=all --allow-unauthenticated
```

For a later update, retain the same storage volume or use `--update-*` flags as appropriate; inspect the service configuration to avoid duplicate volume definitions. The conservative instance limit is an initial pilot profile, not a high-availability scaling claim. An always-allocated minimum instance incurs idle cost and keeps periodic cleanup available.

**Ingress and authentication:** the standard Firebase Hosting rewrite needs a reachable Cloud Run endpoint. `--ingress=all` permits Hosting traffic; it does not restrict requests exclusively to Hosting. Cloud Run IAM allows public transport, while BrandLint authenticates users and enforces CSRF, tenant membership and role permissions. Do not use `internal` or disable the default Run URL for this direct rewrite setup. CORS is not authentication. For a backend reachable exclusively through a controlled edge, design a separate load-balancer/gateway architecture.

**Sessions:** deploy with `SESSION_COOKIE_NAME=__session`; Firebase strips other incoming cookies. The session remains Secure/HttpOnly and CSRF comes from the JSON session response plus `X-CSRF-Token`, not a second cookie. Personalized API responses are private/no-store.

**Request duration:** Hosting has a 60-second limit. The example reduces model timeout and disables job retries, but current analysis routes still execute their checks within the HTTP request. They are not a durable external task queue. Long/bulk checks require a Cloud Tasks/worker design before increasing request budgets; simply raising the Cloud Run timeout does not fix Hosting timeouts. One instance also does not guarantee recovery of an interrupted in-flight analysis. Keep the pilot workload within these limits.

**Proxy trust:** the default intentionally avoids trusting arbitrary forwarded client IPs. Verify the actual trusted proxy chain in staging before customizing TRUSTED_PROXIES; never use `*` merely to bypass rate-limit errors. User/company quotas remain server-side. Treat aggregate IP throttling behavior behind your proxy as a rollout check.

## 8. Deploy the SPA to Firebase Hosting

```bash
firebase deploy --only hosting --project "$PROJECT_ID"
```

The included predeploy hook builds `frontend/dist`. `/api` and `/api/**` rewrite to `brandlint-backend` before the SPA catch-all. `/healthz` and `/readyz` also proxy to the backend. Security headers are applied to Firebase's static HTML, not only backend responses.

Open `https://PROJECT_ID.web.app`. Use **Create an account**, then **Create workspace** to create the first owner/company/brand. Existing sign-in remains available; production demo personas and reset are disabled. Configure SMTP before relying on invitations/password recovery.

## 9. Verify and retain rollback information

```bash
curl --fail --show-error "https://${PROJECT_ID}.web.app/api/health"
curl --fail --show-error "https://${PROJECT_ID}.web.app/readyz"
gcloud run services describe brandlint-backend --region="$REGION" \
  --format='value(status.latestReadyRevisionName,status.url)'
gcloud run jobs executions list --job=brandlint-migrate --region="$REGION"
```

From PowerShell (locally, with the project extracted), the supplied smoke script also checks static assets, API caching, route handling and optional cookie-only login/CSRF/logout:

```powershell
./deploy/google-cloud/smoke-test.ps1 -BaseUrl "https://YOUR_PROJECT_ID.web.app"
# Add -CheckLogin to securely prompt for a test user's login.
```

Manually verify account creation, refresh persistence, a second company cannot access the first company's data, a guideline upload survives a new Run revision, an unfamiliar claim can be checked, and author/reviewer approval gates remain enforced. Check browser console/network errors and actual SMTP delivery. Keep the image tag and successful revision ID.

For a code-only rollback to a schema-compatible revision:

```bash
gcloud run services update-traffic brandlint-backend --region="$REGION" \
  --to-revisions=PREVIOUS_READY_REVISION=100
```

Retain backward-compatible migrations and tested database backups; do not automatically roll back a production database after writes. Hosting can be rolled back in the Firebase console. Configure billing budgets/alerts, monitoring, backup-restore drills, email verification/onboarding policy, and a durable job queue according to your company's production requirements.

## Verification scope of this package

Local frontend compilation and backend test results are recorded in `CLOUD-CHANGES.md`. PostgreSQL DDL compilation is checked, and incremental migrations are exercised on SQLite. No authenticated Google Cloud deployment, real Cloud SQL migration or built Docker image can be claimed without the target project and working cloud tools. Docker Desktop's daemon and the Firebase/gcloud CLIs were unavailable in the preparation environment.

## Official references

- [Firebase Hosting with Cloud Run](https://firebase.google.com/docs/hosting/cloud-run)
- [Firebase cookie forwarding](https://firebase.google.com/docs/hosting/manage-cache#using_cookies)
- [Cloud Run ingress](https://cloud.google.com/run/docs/securing/ingress)
- [Cloud SQL connections from Run](https://cloud.google.com/sql/docs/postgres/connect-run)
- [Secret Manager with Run](https://cloud.google.com/run/docs/configuring/services/secrets)
- [Cloud Storage mounts](https://cloud.google.com/run/docs/configuring/services/cloud-storage-volume-mounts)
