import importlib
import logging
import os
import re
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import Engine, inspect, text

log = logging.getLogger("brandlint.migrations")


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def init_migrations_table(conn) -> None:
    conn.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version VARCHAR(32) PRIMARY KEY,
                applied_at TIMESTAMP NOT NULL,
                description TEXT NOT NULL
            )
            """
        )
    )


def get_applied_versions(conn, *, create_table: bool = True) -> list[str]:
    if create_table:
        init_migrations_table(conn)
    elif not inspect(conn).has_table("schema_migrations"):
        return []
    rows = conn.execute(text("SELECT version FROM schema_migrations ORDER BY version ASC")).fetchall()
    return [r[0] for r in rows]


def get_available_migrations() -> list[Any]:
    migrations_dir = Path(__file__).resolve().parent
    modules = []
    pattern = re.compile(r"^(\d{4})_.*\.py$")
    for f in sorted(os.listdir(migrations_dir)):
        m = pattern.match(f)
        if m:
            mod_name = f"app.migrations.{f[:-3]}"
            try:
                mod = importlib.import_module(mod_name)
                if hasattr(mod, "REVISION") and hasattr(mod, "upgrade"):
                    modules.append(mod)
            except Exception as e:
                log.error("Failed to load migration %s: %s", f, e)
                raise
    return sorted(modules, key=lambda m: getattr(m, "REVISION"))


@contextmanager
def migration_connection(engine: Engine):
    """Serialize PostgreSQL migration commands across deployment processes.

    The session lock survives each revision's transaction and is released before
    the pooled connection is returned. SQLite keeps its existing transaction rules.
    """
    with engine.connect() as conn:
        postgres = conn.dialect.name == "postgresql"
        lock_key = 0x4252414E444C494E  # stable, app-specific signed bigint
        if postgres:
            with conn.begin():
                conn.execute(text("SELECT pg_advisory_lock(:key)"), {"key": lock_key})
        try:
            yield conn
        finally:
            if postgres:
                if conn.in_transaction():
                    conn.rollback()
                with conn.begin():
                    conn.execute(text("SELECT pg_advisory_unlock(:key)"), {"key": lock_key})


def run_migrations(engine: Engine, target: str = "head") -> list[str]:
    """
    Applies all pending migrations up to target (default: 'head' = all available).
    Returns list of newly applied revision IDs.
    """
    applied_this_run = []
    available = get_available_migrations()
    known_versions = {mod.REVISION for mod in available}
    if target != "head" and target not in known_versions:
        raise ValueError(f"Unknown migration target: {target}")
    if target != "head":
        available = [mod for mod in available if mod.REVISION <= target]

    with migration_connection(engine) as conn:
        with conn.begin():
            init_migrations_table(conn)
            applied = set(get_applied_versions(conn))
        unknown = applied - known_versions
        if unknown:
            raise RuntimeError(f"Database contains unknown migration revisions: {', '.join(sorted(unknown))}. Deploy matching application code before migrating.")

        for mod in available:
            rev = mod.REVISION
            desc = getattr(mod, "DESCRIPTION", "")
            if rev in applied:
                continue

            log.info("Applying migration %s: %s", rev, desc)
            with conn.begin():
                mod.upgrade(conn)
                conn.execute(
                    text(
                        "INSERT INTO schema_migrations (version, applied_at, description) VALUES (:v, :t, :d)"
                    ),
                    {"v": rev, "t": utcnow(), "d": desc},
                )
            applied_this_run.append(rev)
            log.info("Applied migration %s successfully.", rev)

            if target != "head" and rev == target:
                break

    return applied_this_run


def rollback_migration(engine: Engine, target: str | None = None) -> str | None:
    """
    Rolls back the most recently applied migration (or down to target).
    Returns the rolled back revision ID, or None if no migrations applied.
    """
    available_map = {m.REVISION: m for m in get_available_migrations()}

    with migration_connection(engine) as conn:
        with conn.begin():
            applied = get_applied_versions(conn)

        if not applied:
            log.info("No migrations currently applied to roll back.")
            return None

        last_rev = applied[-1]
        if target is not None and last_rev <= target:
            log.info("Database is already at or before target %s.", target)
            return None

        mod = available_map.get(last_rev)
        if not mod:
            raise RuntimeError(f"Cannot roll back migration {last_rev}: migration file not found.")

        if not hasattr(mod, "downgrade"):
            raise RuntimeError(f"Migration {last_rev} does not implement a downgrade function.")

        log.info("Rolling back migration %s: %s", last_rev, getattr(mod, "DESCRIPTION", ""))
        with conn.begin():
            mod.downgrade(conn)
            conn.execute(
                text("DELETE FROM schema_migrations WHERE version = :v"),
                {"v": last_rev},
            )
        log.info("Rolled back migration %s successfully.", last_rev)
        return last_rev


def get_migration_status(engine: Engine) -> dict[str, Any]:
    available = get_available_migrations()
    with engine.connect() as conn:
        with conn.begin():
            applied = set(get_applied_versions(conn, create_table=False))

    status_list = []
    for mod in available:
        status_list.append({
            "revision": mod.REVISION,
            "description": getattr(mod, "DESCRIPTION", ""),
            "applied": mod.REVISION in applied,
        })

    is_head = len(applied) == len(available) and all(m.REVISION in applied for m in available)
    current_rev = sorted(list(applied))[-1] if applied else None

    return {
        "current_revision": current_rev,
        "is_head": is_head,
        "total_available": len(available),
        "total_applied": len(applied),
        "migrations": status_list,
    }


def require_current_schema(engine: Engine) -> None:
    """Read-only startup gate; replicas must never race to change the schema."""
    status = get_migration_status(engine)
    if not status["is_head"]:
        raise RuntimeError(
            "Database migrations are not current. Run "
            "'python backend/scripts/migrate.py upgrade' as a deployment job "
            "before starting this application (AUTO_MIGRATE=false)."
        )
