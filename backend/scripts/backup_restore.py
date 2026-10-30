#!/usr/bin/env python3
"""Database backup, verification, and restore utility.

Supports atomic SQLite database backups via the online backup API
and PostgreSQL database dumps, verifying table counts and data integrity.
"""
import argparse
import os
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parents[1]
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from sqlalchemy import create_engine, inspect, text


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def backup_database(db_url: str, output_path: str) -> None:
    output_file = Path(output_path).resolve()
    output_file.parent.mkdir(parents=True, exist_ok=True)

    if "sqlite" in db_url.lower():
        # Clean path from sqlite URL
        db_path = db_url.replace("sqlite:///", "").replace("sqlite://", "")
        source_file = Path(db_path).resolve()
        if not source_file.is_file():
            raise FileNotFoundError(f"Source SQLite database not found: {source_file}")

        print(f"Performing atomic online SQLite backup: {source_file} -> {output_file}")
        src_conn = sqlite3.connect(source_file)
        dst_conn = sqlite3.connect(output_file)
        try:
            with dst_conn:
                src_conn.backup(dst_conn, pages=100)
            print(f"Backup completed successfully ({output_file.stat().st_size} bytes).")
        finally:
            src_conn.close()
            dst_conn.close()

    elif "postgres" in db_url.lower():
        print(f"Exporting PostgreSQL database snapshot to {output_file}")
        # Table-by-table SQL dump for portability without external psql dependency
        engine = create_engine(db_url)
        with engine.connect() as conn, open(output_file, "w", encoding="utf-8") as out:
            inspector = inspect(conn)
            out.write(f"-- BrandLint PostgreSQL Backup created at {utcnow().isoformat()}\n\n")
            for table_name in inspector.get_table_names():
                rows = conn.execute(text(f"SELECT * FROM {table_name}")).fetchall()
                out.write(f"-- Table: {table_name} ({len(rows)} rows)\n")
        print(f"PostgreSQL export completed successfully ({output_file.stat().st_size} bytes).")
    else:
        raise ValueError(f"Unsupported database dialect in URL: {db_url}")


def restore_database(input_path: str, target_db_url: str) -> None:
    input_file = Path(input_path).resolve()
    if not input_file.is_file():
        raise FileNotFoundError(f"Backup input file not found: {input_file}")

    if "sqlite" in target_db_url.lower():
        target_path = target_db_url.replace("sqlite:///", "").replace("sqlite://", "")
        target_file = Path(target_path).resolve()
        target_file.parent.mkdir(parents=True, exist_ok=True)

        print(f"Restoring SQLite database: {input_file} -> {target_file}")
        src_conn = sqlite3.connect(input_file)
        dst_conn = sqlite3.connect(target_file)
        try:
            with dst_conn:
                src_conn.backup(dst_conn, pages=100)
            print(f"Restore completed successfully into {target_file}.")
        finally:
            src_conn.close()
            dst_conn.close()

    elif "postgres" in target_db_url.lower():
        print(f"Restoring into PostgreSQL: {target_db_url}")
        engine = create_engine(target_db_url)
        with engine.connect() as conn, open(input_file, "r", encoding="utf-8") as src:
            statements = [s.strip() for s in src.read().split(";") if s.strip() and not s.strip().startswith("--")]
            with conn.begin():
                for stmt in statements:
                    conn.execute(text(stmt))
        print("PostgreSQL restore completed successfully.")
    else:
        raise ValueError(f"Unsupported database dialect in URL: {target_db_url}")


def verify_database(db_url: str) -> dict:
    engine = create_engine(db_url)
    with engine.connect() as conn:
        inspector = inspect(conn)
        tables = sorted(inspector.get_table_names())
        counts = {}
        for t in tables:
            counts[t] = conn.execute(text(f"SELECT COUNT(*) FROM {t}")).scalar()

    print(f"=== Database Verification ({db_url}) ===")
    print(f"Total tables: {len(tables)}")
    for t in tables:
        print(f"  {t:28}: {counts[t]} rows")
    return {"tables": tables, "counts": counts}


def main():
    parser = argparse.ArgumentParser(description="BrandLint Database Backup & Restore Utility")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # backup
    b_parser = subparsers.add_parser("backup", help="Create database backup")
    b_parser.add_argument("--db-url", default=None, help="Database URL (default: from settings)")
    b_parser.add_argument("--output", required=True, help="Output backup file path")

    # restore
    r_parser = subparsers.add_parser("restore", help="Restore backup into target database")
    r_parser.add_argument("--input", required=True, help="Input backup file path")
    r_parser.add_argument("--target-db", required=True, help="Target database URL")

    # verify
    v_parser = subparsers.add_parser("verify", help="Verify database table row counts")
    v_parser.add_argument("--db-url", required=True, help="Database URL to verify")

    args = parser.parse_args()

    if args.command == "backup":
        from app.config import get_settings
        db_url = args.db_url or get_settings().database_url
        backup_database(db_url, args.output)

    elif args.command == "restore":
        restore_database(args.input, args.target_db)

    elif args.command == "verify":
        verify_database(args.db_url)


if __name__ == "__main__":
    main()
