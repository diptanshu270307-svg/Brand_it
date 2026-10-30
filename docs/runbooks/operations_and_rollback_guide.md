# BrandLint Pilot Operations & Release Rollback Runbook

This runbook defines operational procedures for reliable, secure SaaS execution of BrandLint pilot workspaces, covering infrastructure, data protection, schema migrations, and release rollback.

---

## 1. Release Deployment & Rollback Procedures

### Standard Deployment Flow
1. **Pre-flight verification**: Ensure CI/CD tests pass (`pytest backend/tests/` and `npm --prefix frontend run build`).
2. **Database migration**: Run versioned migration forward:
   ```bash
   python backend/scripts/migrate.py upgrade --target head
   ```
3. **Container rollout**: Deploy updated container image with rolling update strategy (zero-downtime healthcheck verification via `/readyz`).
4. **Post-deployment check**: Verify telemetry and readiness probes:
   ```bash
   curl -f https://app.brandlint.com/readyz
   curl -f https://app.brandlint.com/metrics
   ```

### Emergency Release Rollback Flow
If post-deployment monitoring detects an elevated error rate, broken API contract, or unrecoverable worker failure:

1. **Step 1: Traffic Redirection / Container Rollback**
   - Point load balancer / Kubernetes deployment back to the previous stable release tag:
     ```bash
     kubectl rollout undo deployment/brandlint-api
     ```
2. **Step 2: Schema Migration Rollback (if applicable)**
   - If the new release applied a schema migration that is incompatible with the previous version, roll back the schema step:
     ```bash
     python backend/scripts/migrate.py rollback
     ```
   - Verify current migration level:
     ```bash
     python backend/scripts/migrate.py status
     ```
3. **Step 3: Verification**
   - Confirm liveness probe (`GET /healthz`) and readiness probe (`GET /readyz`) return HTTP 200.
   - Inspect operator alerts: `GET /api/system/alerts`.
4. **Step 4: Operator Notification & Post-Mortem**
   - Notify incident response channel; draft blameless post-mortem with request ID traces.

---

## 2. Encrypted Transport & Storage at Rest

### Transport Encryption (In-Transit)
- **External Web Traffic**: TLS 1.3 enforced with modern cipher suites. HSTS enabled with `max-age=31536000; includeSubDomains; preload`.
- **Database Transport**: PostgreSQL connections require TLS via `sslmode=require` (or `verify-full` with pinned CA bundle). Unencrypted connections are rejected at the database pg_hba level.
- **Cache & Redis**: In-transit TLS enabled (`rediss://`).

### Storage Encryption (At-Rest)
- **Database Volumes**: Cloud-managed PostgreSQL (AWS RDS or GCP Cloud SQL) runs on storage volumes encrypted with AES-256 (KMS-managed keys).
- **Document & Artifact Storage**: Document storage directory (`data/storage/documents` or cloud S3/GCS buckets) uses server-side encryption with KMS keys (SSE-KMS).
- **Temporary & Swap Volumes**: Container root filesystems and temp directories are ephemeral and host-encrypted.

---

## 3. Backup, Verification & Restore Runbook

### Backup Schedule & Retention
- **Automated Snapshots**: Daily full snapshots with 35-day retention.
- **Continuous Archiving**: Write-Ahead Logging (WAL) archiving for Point-In-Time Recovery (PITR) up to the minute.
- **RTO / RPO Targets**:
  - Recovery Time Objective (RTO): < 30 minutes.
  - Recovery Point Objective (RPO): < 5 minutes.

### Verified Backup Command
```bash
python backend/scripts/backup_restore.py backup --output /var/backups/brandlint_$(date +%Y%m%d_%H%M%S).db
```

### Disaster Recovery Restore into Isolated Test Database
```bash
python backend/scripts/backup_restore.py restore \
  --input /var/backups/brandlint_snapshot.db \
  --target-db postgresql+psycopg://brandlint_dr:PASS@dr-db.internal:5432/brandlint_dr

python backend/scripts/backup_restore.py verify \
  --db-url postgresql+psycopg://brandlint_dr:PASS@dr-db.internal:5432/brandlint_dr
```

---

## 4. Tenant-Aware Data Retention & Deletion

- **Session Cleanup**: Expired and revoked sessions are purged periodically every 6 hours by background daemon task.
- **Audit Log Retention**: Audit events retain tenant-scoped historical records for 365 days; content text is never stored in audit logs.
- **Tenant Deletion / Customer Offboarding**:
  - Offboarding script executes cascading deletion within the company tenant scope (`companies.id` -> `brands` -> `rules`, `evidence`, `source_documents`, `drafts`).
  - Encrypted document storage objects matching `storage_path` are deleted synchronously from the filesystem/bucket.

---

## 5. Least-Privilege Credentials & Access Control

1. **Runtime Application Database User (`brandlint_app`)**:
   - Granted ONLY: `SELECT`, `INSERT`, `UPDATE`, `DELETE` on application tables.
   - Strictly DENIED: `CREATE`, `DROP`, `ALTER`, `TRUNCATE`, `SUPERUSER`.
2. **Migration Database User (`brandlint_migrator`)**:
   - Used exclusively by deployment pipeline during migration execution (`migrate.py upgrade`).
   - Granted DDL permissions (`CREATE TABLE`, `ALTER TABLE`, `CREATE INDEX`).
3. **Container Security**:
   - Runs as non-root user (`USER brandlint` UID 10001).
   - Read-only root filesystem (`readOnlyRootFilesystem: true`), with tmpfs mounts for `/tmp`.
   - Security capabilities dropped: `ALL`.

---

## 6. Secret Rotation Procedure

- **`SECRET_KEY` Rotation**:
  - Generated via cryptographically secure RNG: `openssl rand -hex 32`.
  - Application supports dual-key transition window: previous key remains valid for session verification during a 24-hour grace window while new sessions sign with the primary key.
- **Database & Redis Password Rotation**:
  - AWS Secrets Manager / Vault rotates credentials automatically every 90 days.
  - Connection pool (`pool_pre_ping=True`, `pool_recycle=1800`) gracefully reconnects with updated credentials without service interruption.
