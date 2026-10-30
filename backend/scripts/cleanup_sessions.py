#!/usr/bin/env python3
"""CLI utility to clean up expired and revoked sessions and recovery tokens.

Usage:
  python backend/scripts/cleanup_sessions.py
  python backend/scripts/cleanup_sessions.py --days 14
"""
import argparse
import sys
from pathlib import Path

# Ensure backend package is in python path
backend_dir = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(backend_dir))

from app.cleanup import purge_stale_auth_records
from app.config import get_settings
from app.db import SessionLocal


def main() -> int:
    parser = argparse.ArgumentParser(description="Purge stale BrandLint sessions and reset tokens.")
    parser.add_argument("--days", type=int, default=None, help="Retention period in days (default: from config).")
    args = parser.parse_args()

    settings = get_settings()
    days = args.days if args.days is not None else settings.session_retention_days

    print("=" * 60)
    print("BrandLint Session & Token Retention Cleanup")
    print("=" * 60)
    print(f"  App Mode:        {settings.app_mode}")
    print(f"  Database URL:    {settings.database_url.split('@')[-1] if '@' in settings.database_url else settings.database_url}")
    print(f"  Retention Days:  {days}")
    print("-" * 60)

    with SessionLocal() as db:
        stats = purge_stale_auth_records(db, older_than_days=days)

    print(f"[OK] Purged {stats['purged_sessions']} stale sessions")
    print(f"[OK] Purged {stats['purged_reset_tokens']} expired/consumed recovery tokens")
    print(f"[OK] Purged {stats['purged_rate_limit_events']} old rate limit events")
    print("=" * 60)
    print("Cleanup completed successfully.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
