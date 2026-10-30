#!/usr/bin/env python3
"""CLI utility for managing database migrations."""
import argparse
import sys
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parents[1]
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.db import SessionLocal, engine, migrate_existing_brands
from app.migrations.runner import (
    get_migration_status,
    rollback_migration,
    run_migrations,
)


def main():
    parser = argparse.ArgumentParser(description="BrandLint Database Migration Manager")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # status
    subparsers.add_parser("status", help="Show current migration status")

    # upgrade
    up_parser = subparsers.add_parser("upgrade", help="Run pending migrations up to target")
    up_parser.add_argument("--target", default="head", help="Target revision (default: head)")

    # rollback
    down_parser = subparsers.add_parser("rollback", help="Roll back the most recent migration")
    down_parser.add_argument("--target", default=None, help="Target revision to roll back to")

    args = parser.parse_args()

    if args.command == "status":
        status = get_migration_status(engine)
        print("=== Database Migration Status ===")
        print(f"Current Revision: {status['current_revision'] or 'None (unmigrated)'}")
        print(f"Is at Head: {'Yes' if status['is_head'] else 'No'}")
        print(f"Applied: {status['total_applied']} / {status['total_available']}")
        print("\nRevisions:")
        for m in status["migrations"]:
            badge = "[APPLIED]" if m["applied"] else "[PENDING]"
            print(f"  {badge:9} {m['revision']}: {m['description']}")

    elif args.command == "upgrade":
        applied = run_migrations(engine, target=args.target)
        if args.target == "head":
            with SessionLocal() as db:
                migrate_existing_brands(db)
        if applied:
            print(f"Successfully applied {len(applied)} migration(s): {', '.join(applied)}")
        else:
            print("Database is already up to date.")

    elif args.command == "rollback":
        rolled_back = rollback_migration(engine, target=args.target)
        if rolled_back:
            print(f"Successfully rolled back migration: {rolled_back}")
        else:
            print("No migrations were rolled back.")


if __name__ == "__main__":
    main()
