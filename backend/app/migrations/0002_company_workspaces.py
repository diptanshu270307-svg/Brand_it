from sqlalchemy import inspect

from .ddl import migration_text as text

REVISION = "0002"
DOWN_REVISION = "0001"
DESCRIPTION = "Add company tenant boundaries, company memberships, invitations, and setup progress"


def upgrade(conn) -> None:
    inspector = inspect(conn)
    existing_tables = set(inspector.get_table_names())

    if "companies" not in existing_tables:
        conn.execute(text("""
            CREATE TABLE companies (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name VARCHAR(200) NOT NULL,
                slug VARCHAR(80) NOT NULL UNIQUE,
                created_at TIMESTAMP NOT NULL,
                settings JSON DEFAULT '{}'
            )
        """))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_companies_slug ON companies(slug)"))

    if "company_memberships" not in existing_tables:
        conn.execute(text("""
            CREATE TABLE company_memberships (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                company_id INTEGER NOT NULL REFERENCES companies(id),
                user_id INTEGER NOT NULL REFERENCES users(id),
                role VARCHAR(30) NOT NULL,
                created_at TIMESTAMP NOT NULL,
                UNIQUE(company_id, user_id)
            )
        """))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_company_memberships_company_id ON company_memberships(company_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_company_memberships_user_id ON company_memberships(user_id)"))

    if "company_invitations" not in existing_tables:
        conn.execute(text("""
            CREATE TABLE company_invitations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                company_id INTEGER NOT NULL REFERENCES companies(id),
                email VARCHAR(200) NOT NULL,
                role VARCHAR(30) NOT NULL,
                token_hash VARCHAR(64) NOT NULL UNIQUE,
                invited_by_id INTEGER NOT NULL REFERENCES users(id),
                created_at TIMESTAMP NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                accepted_at TIMESTAMP,
                revoked_at TIMESTAMP
            )
        """))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_company_invitations_company_id ON company_invitations(company_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_company_invitations_email ON company_invitations(email)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_company_invitations_token_hash ON company_invitations(token_hash)"))

    if "brands" in existing_tables:
        cols = [c["name"] for c in inspector.get_columns("brands")]
        if "company_id" not in cols:
            conn.execute(text("ALTER TABLE brands ADD COLUMN company_id INTEGER REFERENCES companies(id)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_brands_company_id ON brands(company_id)"))

    if "benchmark_caches" not in existing_tables:
        conn.execute(text("""
            CREATE TABLE benchmark_caches (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                brand_id INTEGER NOT NULL REFERENCES brands(id),
                company_id INTEGER REFERENCES companies(id),
                run_by_id INTEGER NOT NULL REFERENCES users(id),
                created_at TIMESTAMP NOT NULL,
                result_json JSON DEFAULT '{}'
            )
        """))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_benchmark_caches_brand_id ON benchmark_caches(brand_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_benchmark_caches_company_id ON benchmark_caches(company_id)"))

    if "brand_setup_progress" not in existing_tables:
        conn.execute(text("""
            CREATE TABLE brand_setup_progress (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                brand_id INTEGER NOT NULL UNIQUE REFERENCES brands(id),
                company_id INTEGER REFERENCES companies(id),
                current_step VARCHAR(40) DEFAULT 'guidelines',
                skipped_invite BOOLEAN DEFAULT 0,
                dismissed BOOLEAN DEFAULT 0,
                completed_at TIMESTAMP,
                updated_at TIMESTAMP NOT NULL
            )
        """))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_brand_setup_progress_brand_id ON brand_setup_progress(brand_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_brand_setup_progress_company_id ON brand_setup_progress(company_id)"))


def downgrade(conn) -> None:
    conn.execute(text("DROP TABLE IF EXISTS brand_setup_progress"))
    conn.execute(text("DROP TABLE IF EXISTS benchmark_caches"))
    conn.execute(text("DROP TABLE IF EXISTS company_invitations"))
    conn.execute(text("DROP TABLE IF EXISTS company_memberships"))
    conn.execute(text("DROP TABLE IF EXISTS companies"))
