from sqlalchemy import inspect

from .ddl import migration_text as text

REVISION = "0005"
DOWN_REVISION = "0004"
DESCRIPTION = "Add durable tenant-scoped analysis jobs and workspace usage accounting"


def upgrade(conn) -> None:
    inspector = inspect(conn)
    existing_tables = set(inspector.get_table_names())

    if "analysis_jobs" not in existing_tables:
        conn.execute(text("""
            CREATE TABLE analysis_jobs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                job_id VARCHAR(36) NOT NULL UNIQUE,
                brand_id INTEGER NOT NULL REFERENCES brands(id),
                company_id INTEGER REFERENCES companies(id),
                draft_id INTEGER NOT NULL REFERENCES drafts(id),
                revision_id INTEGER NOT NULL REFERENCES draft_revisions(id),
                user_id INTEGER REFERENCES users(id),
                status VARCHAR(30) DEFAULT 'pending',
                stage VARCHAR(60) DEFAULT 'queued',
                progress_pct INTEGER DEFAULT 0,
                idempotency_key VARCHAR(120),
                retry_count INTEGER DEFAULT 0,
                max_retries INTEGER DEFAULT 3,
                error_message TEXT,
                error_code VARCHAR(60),
                analysis_id INTEGER REFERENCES analyses(id),
                stale_result_prevented BOOLEAN DEFAULT 0,
                created_at TIMESTAMP NOT NULL,
                started_at TIMESTAMP,
                completed_at TIMESTAMP,
                cancelled_at TIMESTAMP,
                meta JSON DEFAULT '{}'
            )
        """))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_analysis_jobs_job_id ON analysis_jobs(job_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_analysis_jobs_brand_id ON analysis_jobs(brand_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_analysis_jobs_company_id ON analysis_jobs(company_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_analysis_jobs_draft_id ON analysis_jobs(draft_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_analysis_jobs_revision_id ON analysis_jobs(revision_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_analysis_jobs_status ON analysis_jobs(status)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_analysis_jobs_idempotency_key ON analysis_jobs(idempotency_key)"))

    if "workspace_usage" not in existing_tables:
        conn.execute(text("""
            CREATE TABLE workspace_usage (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                company_id INTEGER NOT NULL REFERENCES companies(id),
                period VARCHAR(7) NOT NULL,
                drafts_created INTEGER DEFAULT 0,
                checks_run INTEGER DEFAULT 0,
                storage_bytes INTEGER DEFAULT 0,
                last_updated_at TIMESTAMP NOT NULL,
                UNIQUE(company_id, period)
            )
        """))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_workspace_usage_company_id ON workspace_usage(company_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_workspace_usage_period ON workspace_usage(period)"))


def downgrade(conn) -> None:
    conn.execute(text("DROP TABLE IF EXISTS workspace_usage"))
    conn.execute(text("DROP TABLE IF EXISTS analysis_jobs"))
