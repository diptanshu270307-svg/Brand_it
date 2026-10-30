import re
from sqlalchemy import create_engine, inspect, text, select
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import get_settings


class Base(DeclarativeBase):
    pass


_original_create_all = Base.metadata.create_all


def _safe_create_all(*args, **kwargs):
    if get_settings().is_production:
        raise RuntimeError("create_all is strictly forbidden in production mode. Use versioned migrations.")
    return _original_create_all(*args, **kwargs)


Base.metadata.create_all = _safe_create_all


def _make_engine(url: str):
    kwargs = {}
    if url.startswith("sqlite"):
        kwargs["connect_args"] = {"check_same_thread": False}
    else:
        # PostgreSQL production connection pool configuration
        kwargs["pool_pre_ping"] = True
        kwargs["pool_size"] = 10
        kwargs["max_overflow"] = 20
        kwargs["pool_timeout"] = 30
        kwargs["pool_recycle"] = 1800
    return create_engine(url, **kwargs)


engine = _make_engine(get_settings().database_url)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def migrate_existing_brands(db) -> None:
    """
    Safely migrates existing brands into companies.
    Initially places each existing brand in its own company unless an explicit mapping is supplied.
    Also migrates user memberships into company_memberships.
    """
    from .models import Brand, Company, CompanyMembership, Membership

    brands_without_company = list(db.scalars(select(Brand).where(Brand.company_id.is_(None))))
    for b in brands_without_company:
        clean_name = b.name.split("(")[0].strip() or f"Company {b.id}"
        base_slug = re.sub(r"[^a-z0-9]+", "-", clean_name.lower()).strip("-") or f"company-{b.id}"
        slug = base_slug
        suffix = 1
        while db.scalar(select(Company).where(Company.slug == slug)):
            slug = f"{base_slug}-{suffix}"
            suffix += 1

        company = Company(
            name=clean_name,
            slug=slug,
            settings={"plan": "enterprise", "migrated_from_brand_id": b.id},
        )
        db.add(company)
        db.flush()
        b.company_id = company.id

    db.commit()

    # Synchronize brand memberships to company memberships
    memberships = list(db.scalars(select(Membership)))
    for m in memberships:
        b = db.get(Brand, m.brand_id)
        if b and b.company_id:
            existing_cm = db.scalar(
                select(CompanyMembership).where(
                    CompanyMembership.company_id == b.company_id,
                    CompanyMembership.user_id == m.user_id,
                )
            )
            if not existing_cm:
                cm = CompanyMembership(company_id=b.company_id, user_id=m.user_id, role=m.role)
                db.add(cm)

    db.commit()


def init_db():
    from . import models  # noqa: F401
    from .migrations.runner import require_current_schema, run_migrations
    settings = get_settings()

    auto_migrate = settings.auto_migrate
    if auto_migrate is None:
        auto_migrate = not settings.is_production
    if auto_migrate:
        run_migrations(engine)
        # Local/backward-compatible startup also performs the legacy data backfill.
        with SessionLocal() as db:
            migrate_existing_brands(db)
    else:
        require_current_schema(engine)
