from sqlalchemy import inspect

from .ddl import migration_text as text

REVISION = "0004"
DOWN_REVISION = "0003"
DESCRIPTION = "Add guideline proposals, explicit channel conditions, and channel-segmented rule event history"


def upgrade(conn) -> None:
    inspector = inspect(conn)
    existing_tables = set(inspector.get_table_names())

    if "rules" in existing_tables:
        cols = [c["name"] for c in inspector.get_columns("rules")]
        if "exempt_channels" not in cols:
            conn.execute(text("ALTER TABLE rules ADD COLUMN exempt_channels JSON DEFAULT '[]'"))
        if "channel_conditions" not in cols:
            conn.execute(text("ALTER TABLE rules ADD COLUMN channel_conditions JSON DEFAULT '[]'"))

    if "rule_events" in existing_tables:
        cols = [c["name"] for c in inspector.get_columns("rule_events")]
        if "channel" not in cols:
            conn.execute(text("ALTER TABLE rule_events ADD COLUMN channel VARCHAR(60)"))

    if "guideline_proposals" not in existing_tables:
        conn.execute(text("""
            CREATE TABLE guideline_proposals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                brand_id INTEGER NOT NULL REFERENCES brands(id),
                rule_id INTEGER NOT NULL REFERENCES rules(id),
                rule_key VARCHAR(40) NOT NULL,
                current_text TEXT NOT NULL,
                proposed_text TEXT NOT NULL,
                rationale TEXT DEFAULT '',
                override_count INTEGER DEFAULT 0,
                channel_conditions JSON DEFAULT '[]',
                proposed_matchers JSON DEFAULT '[]',
                status VARCHAR(20) DEFAULT 'pending',
                created_at TIMESTAMP NOT NULL,
                decided_by INTEGER REFERENCES users(id),
                decided_at TIMESTAMP,
                new_rule_id INTEGER
            )
        """))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_guideline_proposals_brand_id ON guideline_proposals(brand_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_guideline_proposals_rule_key ON guideline_proposals(rule_key)"))


def downgrade(conn) -> None:
    conn.execute(text("DROP TABLE IF EXISTS guideline_proposals"))
