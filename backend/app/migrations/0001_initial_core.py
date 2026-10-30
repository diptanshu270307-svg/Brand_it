from sqlalchemy import inspect

from .ddl import migration_text as text

REVISION = "0001"
DOWN_REVISION = None
DESCRIPTION = "Initial core tables for users, brands, rules, evidence, drafts, and reviews"


def upgrade(conn) -> None:
    inspector = inspect(conn)
    existing_tables = set(inspector.get_table_names())

    if "users" not in existing_tables:
        conn.execute(text("""
            CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email VARCHAR(200) NOT NULL UNIQUE,
                name VARCHAR(120) NOT NULL,
                password_hash VARCHAR(300) NOT NULL
            )
        """))

    if "auth_sessions" not in existing_tables:
        conn.execute(text("""
            CREATE TABLE auth_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL REFERENCES users(id),
                token_hash VARCHAR(64) NOT NULL UNIQUE,
                created_at TIMESTAMP NOT NULL,
                last_seen_at TIMESTAMP NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                revoked_at TIMESTAMP,
                revoked_reason VARCHAR(30)
            )
        """))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_auth_sessions_user_id ON auth_sessions(user_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_auth_sessions_token_hash ON auth_sessions(token_hash)"))

    if "password_reset_tokens" not in existing_tables:
        conn.execute(text("""
            CREATE TABLE password_reset_tokens (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL REFERENCES users(id),
                token_hash VARCHAR(64) NOT NULL UNIQUE,
                created_at TIMESTAMP NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                used_at TIMESTAMP
            )
        """))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_password_reset_tokens_user_id ON password_reset_tokens(user_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_password_reset_tokens_token_hash ON password_reset_tokens(token_hash)"))

    if "rate_limit_events" not in existing_tables:
        conn.execute(text("""
            CREATE TABLE rate_limit_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                key VARCHAR(120) NOT NULL,
                created_at TIMESTAMP NOT NULL
            )
        """))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_rate_limit_events_key ON rate_limit_events(key)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_rate_limit_events_created_at ON rate_limit_events(created_at)"))

    if "brands" not in existing_tables:
        conn.execute(text("""
            CREATE TABLE brands (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name VARCHAR(200) NOT NULL,
                description TEXT DEFAULT '',
                protected_terms JSON DEFAULT '[]',
                competitors JSON DEFAULT '[]'
            )
        """))

    if "memberships" not in existing_tables:
        conn.execute(text("""
            CREATE TABLE memberships (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL REFERENCES users(id),
                brand_id INTEGER NOT NULL REFERENCES brands(id),
                role VARCHAR(30) NOT NULL,
                UNIQUE(user_id, brand_id)
            )
        """))

    if "source_documents" not in existing_tables:
        conn.execute(text("""
            CREATE TABLE source_documents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                brand_id INTEGER NOT NULL REFERENCES brands(id),
                kind VARCHAR(20) NOT NULL,
                title VARCHAR(300) NOT NULL,
                version INTEGER DEFAULT 1,
                expires_on DATE,
                pages JSON DEFAULT '[]',
                content_hash VARCHAR(64) DEFAULT '',
                suspicious BOOLEAN DEFAULT 0,
                suspicious_notes JSON DEFAULT '[]',
                uploaded_by INTEGER REFERENCES users(id),
                storage_path VARCHAR(500),
                file_name VARCHAR(255),
                created_at TIMESTAMP NOT NULL,
                seeded BOOLEAN DEFAULT 0
            )
        """))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_source_documents_brand_id ON source_documents(brand_id)"))

    if "rules" not in existing_tables:
        conn.execute(text("""
            CREATE TABLE rules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                brand_id INTEGER NOT NULL REFERENCES brands(id),
                key VARCHAR(40) NOT NULL,
                version INTEGER DEFAULT 1,
                status VARCHAR(20) DEFAULT 'proposed',
                title VARCHAR(200) NOT NULL,
                category VARCHAR(40) NOT NULL,
                severity VARCHAR(20) NOT NULL,
                text TEXT NOT NULL,
                sensitive BOOLEAN DEFAULT 0,
                matchers JSON DEFAULT '[]',
                claim_kind VARCHAR(30),
                source_document_id INTEGER REFERENCES source_documents(id),
                source_page INTEGER,
                source_excerpt TEXT DEFAULT '',
                created_at TIMESTAMP NOT NULL,
                approved_by INTEGER REFERENCES users(id)
            )
        """))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_rules_brand_id ON rules(brand_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_rules_key ON rules(key)"))

    if "evidence" not in existing_tables:
        conn.execute(text("""
            CREATE TABLE evidence (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                brand_id INTEGER NOT NULL REFERENCES brands(id),
                claim_text TEXT NOT NULL,
                excerpt TEXT NOT NULL,
                source_document_id INTEGER NOT NULL REFERENCES source_documents(id),
                page INTEGER DEFAULT 1,
                owner VARCHAR(120) NOT NULL,
                keywords JSON DEFAULT '[]',
                valid_from DATE,
                valid_until DATE,
                status VARCHAR(20) DEFAULT 'pending',
                approved_by INTEGER REFERENCES users(id),
                created_at TIMESTAMP NOT NULL
            )
        """))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_evidence_brand_id ON evidence(brand_id)"))

    if "drafts" not in existing_tables:
        conn.execute(text("""
            CREATE TABLE drafts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                brand_id INTEGER NOT NULL REFERENCES brands(id),
                author_id INTEGER NOT NULL REFERENCES users(id),
                title VARCHAR(200) NOT NULL,
                channel VARCHAR(60) DEFAULT '',
                status VARCHAR(30) DEFAULT 'draft',
                route VARCHAR(20),
                current_revision_id INTEGER,
                approved_revision_id INTEGER,
                created_at TIMESTAMP NOT NULL,
                updated_at TIMESTAMP NOT NULL,
                seeded BOOLEAN DEFAULT 0
            )
        """))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_drafts_brand_id ON drafts(brand_id)"))

    if "draft_revisions" not in existing_tables:
        conn.execute(text("""
            CREATE TABLE draft_revisions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                draft_id INTEGER NOT NULL REFERENCES drafts(id),
                number INTEGER NOT NULL,
                text TEXT NOT NULL,
                audience VARCHAR(300) DEFAULT '',
                purpose VARCHAR(300) DEFAULT '',
                cta VARCHAR(300) DEFAULT '',
                edit_note VARCHAR(300) DEFAULT '',
                created_by INTEGER NOT NULL REFERENCES users(id),
                created_at TIMESTAMP NOT NULL
            )
        """))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_draft_revisions_draft_id ON draft_revisions(draft_id)"))

    if "analyses" not in existing_tables:
        conn.execute(text("""
            CREATE TABLE analyses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                draft_id INTEGER NOT NULL REFERENCES drafts(id),
                revision_id INTEGER NOT NULL REFERENCES draft_revisions(id),
                created_at TIMESTAMP NOT NULL,
                provider VARCHAR(40) DEFAULT 'mock',
                rule_versions JSON DEFAULT '{}',
                source_versions JSON DEFAULT '{}',
                route VARCHAR(20) DEFAULT 'standard',
                notes JSON DEFAULT '[]',
                triggered_by VARCHAR(30) DEFAULT 'manual'
            )
        """))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_analyses_draft_id ON analyses(draft_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_analyses_revision_id ON analyses(revision_id)"))

    if "findings" not in existing_tables:
        conn.execute(text("""
            CREATE TABLE findings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                analysis_id INTEGER NOT NULL REFERENCES analyses(id),
                draft_id INTEGER NOT NULL REFERENCES drafts(id),
                revision_id INTEGER NOT NULL,
                fingerprint VARCHAR(32) NOT NULL,
                origin VARCHAR(20) NOT NULL,
                category VARCHAR(40) NOT NULL,
                severity VARCHAR(20) NOT NULL,
                start INTEGER NOT NULL,
                end INTEGER NOT NULL,
                quote TEXT NOT NULL,
                explanation TEXT NOT NULL,
                rule_id INTEGER REFERENCES rules(id),
                rule_key VARCHAR(40),
                rule_version INTEGER,
                source_excerpt TEXT DEFAULT '',
                source_ref VARCHAR(400) DEFAULT '',
                is_claim BOOLEAN DEFAULT 0,
                evidence_id INTEGER REFERENCES evidence(id),
                evidence_status VARCHAR(20),
                needs_review BOOLEAN DEFAULT 0,
                sensitive BOOLEAN DEFAULT 0,
                suggestion_original TEXT,
                suggestion_replacement TEXT,
                protected_flags JSON DEFAULT '[]'
            )
        """))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_findings_analysis_id ON findings(analysis_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_findings_draft_id ON findings(draft_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_findings_fingerprint ON findings(fingerprint)"))

    if "dispositions" not in existing_tables:
        conn.execute(text("""
            CREATE TABLE dispositions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                draft_id INTEGER NOT NULL REFERENCES drafts(id),
                fingerprint VARCHAR(32) NOT NULL,
                action VARCHAR(20) NOT NULL,
                reason TEXT DEFAULT '',
                user_id INTEGER NOT NULL REFERENCES users(id),
                revision_id INTEGER NOT NULL,
                rule_key VARCHAR(40),
                severity VARCHAR(20) DEFAULT 'low',
                created_at TIMESTAMP NOT NULL,
                UNIQUE(draft_id, fingerprint)
            )
        """))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_dispositions_draft_id ON dispositions(draft_id)"))

    if "review_decisions" not in existing_tables:
        conn.execute(text("""
            CREATE TABLE review_decisions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                draft_id INTEGER NOT NULL REFERENCES drafts(id),
                revision_id INTEGER,
                user_id INTEGER NOT NULL REFERENCES users(id),
                kind VARCHAR(30) NOT NULL,
                body TEXT DEFAULT '',
                route VARCHAR(20),
                created_at TIMESTAMP NOT NULL,
                seeded BOOLEAN DEFAULT 0
            )
        """))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_review_decisions_draft_id ON review_decisions(draft_id)"))

    if "audit_events" not in existing_tables:
        conn.execute(text("""
            CREATE TABLE audit_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                brand_id INTEGER NOT NULL REFERENCES brands(id),
                draft_id INTEGER,
                user_id INTEGER REFERENCES users(id),
                action VARCHAR(60) NOT NULL,
                details JSON DEFAULT '{}',
                created_at TIMESTAMP NOT NULL,
                seeded BOOLEAN DEFAULT 0
            )
        """))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_audit_events_brand_id ON audit_events(brand_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_audit_events_draft_id ON audit_events(draft_id)"))

    if "rule_events" not in existing_tables:
        conn.execute(text("""
            CREATE TABLE rule_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                brand_id INTEGER NOT NULL REFERENCES brands(id),
                rule_key VARCHAR(40) NOT NULL,
                rule_version INTEGER DEFAULT 1,
                kind VARCHAR(20) NOT NULL,
                reason TEXT DEFAULT '',
                excerpt TEXT DEFAULT '',
                draft_id INTEGER,
                created_at TIMESTAMP NOT NULL,
                seeded BOOLEAN DEFAULT 0
            )
        """))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_rule_events_brand_id ON rule_events(brand_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_rule_events_rule_key ON rule_events(rule_key)"))


def downgrade(conn) -> None:
    tables = [
        "rule_events", "audit_events", "review_decisions", "dispositions",
        "findings", "analyses", "draft_revisions", "drafts", "evidence",
        "rules", "source_documents", "memberships", "brands",
        "rate_limit_events", "password_reset_tokens", "auth_sessions", "users"
    ]
    for tbl in tables:
        conn.execute(text(f"DROP TABLE IF EXISTS {tbl}"))
