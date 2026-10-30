# BrandLint Deployment & Operations Runbook

This operational guide provides production deployment instructions, backup and recovery procedures, migration workflows, security controls, and zero-downtime rollback protocols.

---

## 1. System Architecture

BrandLint operates as a single-origin SaaS application:
- **Backend API**: Python 3.11+ / FastAPI application with asynchronous request handling.
- **Frontend SPA**: React 18 + TypeScript built via Vite into `frontend/dist/` and served with strict path containment.
- **Primary Database**: PostgreSQL 15+ using `psycopg` (SQLite supported exclusively for local development and unit tests).
- **Storage**: Private tenant document storage volume (`data/storage/documents`) with least-privilege filesystem permissions.
- **Reverse Proxy**: Nginx or Caddy terminating TLS, enforcing HTTPS, and proxying headers (`X-Forwarded-For`, `X-Forwarded-Proto`).

```
+-------------------------------------------------------------+
|                      Internet / Client                       |
+-------------------------------------------------------------+
                              | HTTPS (TLS 1.3)
                              v
+-------------------------------------------------------------+
|                 Reverse Proxy (Nginx / Caddy)               |
+-------------------------------------------------------------+
                              | Reverse Proxy
                              v
+-------------------------------------------------------------+
|             BrandLint API Service (Uvicorn / FastAPI)       |
|  - Security Headers & Content-Security-Policy               |
|  - Request ID & Metadata Logging (No draft bodies)          |
|  - Rate-Limiting & Quota Management                         |
|  - Tenant-Scoped Analysis Jobs                              |
+-------------------------------------------------------------+
         |                                           |
         v (Encrypted DB Connection)                 v (Local Storage)
+-------------------------------+       +----------------------------+
|   PostgreSQL 15+ Database     |       |   Document Storage Volume  |
|  (Versioned Migrations Engine)|       |  (Tenant-partitioned PDFs) |
+-------------------------------+       +----------------------------+
```

---

## 2. Environment Configuration

Three configuration templates are provided in `config/templates/`:
- `local.env.example` — Zero-setup SQLite development environment with mock providers.
- `staging.env.example` — Staging setup mirroring production with PostgreSQL and SMTP.
- `production.env.example` — Production configuration enforcing strict security constraints.

### 2.1 Production Hardening Validation
When `APP_MODE=production`, the application performs fast startup validation (`validate_production_readiness()`):
1. **SECRET_KEY**: Rejects default secrets and requires at least 32 cryptographically secure characters.
2. **DEMO_PASSWORD**: Refuses default password `demo1234`.
3. **SEED_ON_STARTUP**: Must be set to `false` (demo data is never seeded in production).
4. **PUBLIC_BASE_URL**: Must be an `https://` origin.
5. **MAIL_PROVIDER**: Rejects `dev-outbox` (requires configured `smtp` or production mail provider).
6. **DATABASE_URL**: Rejects SQLite; requires PostgreSQL (`postgresql+psycopg://...`).
7. **CORS_ORIGINS**: Rejects wildcards (`*`).
8. **create_all()**: Strictly forbidden; schema must be managed via migrations.

---

## 3. Database Migrations

BrandLint uses a versioned migration runner ([`backend/scripts/migrate.py`](file:///Users/diptanshujamar/Documents/hackathon/backend/scripts/migrate.py)) tracking applied revisions in `schema_migrations`.

### 3.1 Migration Commands
```bash
# Check current migration status
python backend/scripts/migrate.py status

# Apply all pending migrations up to latest
python backend/scripts/migrate.py upgrade

# Apply migrations up to a specific revision
python backend/scripts/migrate.py upgrade --target 0004

# Roll back the most recently applied migration
python backend/scripts/migrate.py rollback

# Roll back down to a specific revision
python backend/scripts/migrate.py rollback --target 0002
```

---

## 4. Backups, Restores & Disaster Recovery

The utility script [`backend/scripts/backup_restore.py`](file:///Users/diptanshujamar/Documents/hackathon/backend/scripts/backup_restore.py) automates database dumps, isolated restorations, and integrity verification.

### 4.1 Creating a Backup
```bash
# Dump the configured database (or --db-url) to a single backup file
python backend/scripts/backup_restore.py backup --output data/backups/brandlint_20261030.sql
```

### 4.2 Restoring & Verifying Backup into a Separate Test Database
```bash
# Restore backup into an isolated validation database (never the live one)
python backend/scripts/backup_restore.py restore \
  --input data/backups/brandlint_20261030.sql \
  --target-db postgresql+psycopg://postgres:secret@localhost:5432/brandlint_restore_test

# Verify tables restored in the test database
python backend/scripts/backup_restore.py verify \
  --db-url postgresql+psycopg://postgres:secret@localhost:5432/brandlint_restore_test
```

> The restore drill in this repository was executed against SQLite copies. Repeat it against your managed PostgreSQL service before the pilot.

---

## 5. Security Controls & Secrets Rotation

### 5.1 Least-Privilege Credentials
- **Database User**: The application database user (`brandlint_app`) has `SELECT`, `INSERT`, `UPDATE`, `DELETE` privileges on public tables. It cannot `DROP DATABASE` or access PostgreSQL superuser catalogs.
- **Document Storage**: Directory permissions restricted to `chmod 700 data/storage/documents`.

### 5.2 Encryption
- **In Transit**: All client-to-server and server-to-database communication is encrypted via TLS 1.3 / SSL (`sslmode=require`).
- **At Rest**: PostgreSQL volume encryption (LUKS / AWS EBS Encryption with KMS) and AES-256 encrypted host volumes.
- **Passwords**: Hashed with Argon2id (`argon2-cffi`): `time_cost=2`, `memory_cost=65536` KiB (64 MiB), `parallelism=1`. Legacy PBKDF2 hashes are upgraded on next successful login.
- **Encryption in transit / at rest**: Provided by your hosting services (TLS at the proxy, `sslmode=verify-full` to PostgreSQL, encrypted managed volumes). BrandLint does not encrypt data itself.

### 5.3 Secret Rotation Procedure
1. Generate new signing key: `openssl rand -hex 32`
2. Update `SECRET_KEY` in environment management service (Vault / AWS Secrets Manager).
3. Perform rolling restart of API container instances. Existing user sessions stored in `auth_sessions` remain valid while unsigned or legacy tokens expire safely.

### 5.4 Tenant Data Retention & Deletion
- Tenant deletion triggers cascading deletion across `companies`, `company_memberships`, `brands`, `drafts`, `evidence_records`, and `analysis_jobs`.
- Stored source documents for the tenant in `data/storage/documents/{company_id}/` are unlinked and zeroed.

---

## 6. Observability & Monitoring

The application provides standardized monitoring endpoints:

- **Liveness Probe**: `GET /healthz`
  Returns process uptime, timestamp, and version `0.1.0`.
- **Readiness Probe**: `GET /readyz`
  Verifies database connectivity, pending schema migrations, storage volume writeability, and upstream LLM provider availability. Returns `200 OK` when ready, `503 Service Unavailable` if degraded.
- **Metrics**: `GET /metrics` and `GET /api/system/metrics`
  Exposes throughput, error counters, and measured request latencies (p50, p90, p99).
- **Sanitized Operator Alerts**: `GET /api/system/alerts`
  Provides actionable incident alerts (e.g. elevated error rates, provider outages). Strictly scrubs draft text, passwords, and tokens.
- **Structured Request IDs**: Every HTTP request receives an `X-Request-ID` (or adopts incoming header), propagated through application logs and error responses.

---

## 7. Release Rollback Procedure

In the event of a critical issue during a release deployment, execute this rollback procedure:

1. **Traffic Switch**:
   Immediately switch traffic at the reverse proxy / load balancer back to the previous stable release container image:
   ```bash
   # Switch upstream in reverse proxy
   sed -i 's/brandlint:v2.1.0/brandlint:v2.0.0/g' /etc/caddy/Caddyfile
   caddy reload
   ```

2. **Schema Rollback (If Required)**:
   If the new release applied non-backward-compatible database migrations:
   ```bash
   python backend/scripts/migrate.py rollback --target <PREVIOUS_REVISION_ID>
   ```

3. **Verify Health**:
   Execute readiness probe against restored instance:
   ```bash
   curl -f http://127.0.0.1:8000/readyz || exit 1
   ```

4. **Incident Audit**:
   Inspect `/api/system/alerts` and access logs using the incident's `request_id` to diagnose root cause.
