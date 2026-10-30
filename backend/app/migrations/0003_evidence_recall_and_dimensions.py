from sqlalchemy import inspect

from .ddl import migration_text as text

REVISION = "0003"
DOWN_REVISION = "0002"
DESCRIPTION = "Add evidence recall dependencies, notifications, 5D claim dimensions, and draft validity tracking"


def upgrade(conn) -> None:
    inspector = inspect(conn)
    existing_tables = set(inspector.get_table_names())

    if "findings" in existing_tables:
        cols = [c["name"] for c in inspector.get_columns("findings")]
        if "dimensions" not in cols:
            conn.execute(text("ALTER TABLE findings ADD COLUMN dimensions JSON DEFAULT '{}'"))
        if "uncertainty" not in cols:
            conn.execute(text("ALTER TABLE findings ADD COLUMN uncertainty VARCHAR(300)"))

    if "drafts" in existing_tables:
        cols = [c["name"] for c in inspector.get_columns("drafts")]
        if "validity_status" not in cols:
            conn.execute(text("ALTER TABLE drafts ADD COLUMN validity_status VARCHAR(30) DEFAULT 'valid'"))
        if "recall_reason" not in cols:
            conn.execute(text("ALTER TABLE drafts ADD COLUMN recall_reason TEXT"))
        if "assigned_reviewer_id" not in cols:
            conn.execute(text("ALTER TABLE drafts ADD COLUMN assigned_reviewer_id INTEGER REFERENCES users(id)"))

    if "revision_dependencies" not in existing_tables:
        conn.execute(text("""
            CREATE TABLE revision_dependencies (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                brand_id INTEGER NOT NULL REFERENCES brands(id),
                draft_id INTEGER NOT NULL REFERENCES drafts(id),
                revision_id INTEGER NOT NULL REFERENCES draft_revisions(id),
                dependency_type VARCHAR(20) NOT NULL,
                evidence_id INTEGER REFERENCES evidence(id),
                rule_key VARCHAR(40),
                rule_version INTEGER,
                status VARCHAR(30) DEFAULT 'valid',
                invalidated_at TIMESTAMP,
                invalidation_reason VARCHAR(300),
                created_at TIMESTAMP NOT NULL
            )
        """))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_revision_dependencies_brand_id ON revision_dependencies(brand_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_revision_dependencies_draft_id ON revision_dependencies(draft_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_revision_dependencies_revision_id ON revision_dependencies(revision_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_revision_dependencies_evidence_id ON revision_dependencies(evidence_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_revision_dependencies_rule_key ON revision_dependencies(rule_key)"))

    if "notifications" not in existing_tables:
        conn.execute(text("""
            CREATE TABLE notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                brand_id INTEGER NOT NULL REFERENCES brands(id),
                user_id INTEGER REFERENCES users(id),
                kind VARCHAR(40) NOT NULL,
                title VARCHAR(200) NOT NULL,
                body TEXT NOT NULL,
                draft_id INTEGER REFERENCES drafts(id),
                is_read BOOLEAN DEFAULT 0,
                created_at TIMESTAMP NOT NULL
            )
        """))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_notifications_brand_id ON notifications(brand_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_notifications_user_id ON notifications(user_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_notifications_draft_id ON notifications(draft_id)"))


def downgrade(conn) -> None:
    conn.execute(text("DROP TABLE IF EXISTS notifications"))
    conn.execute(text("DROP TABLE IF EXISTS revision_dependencies"))
