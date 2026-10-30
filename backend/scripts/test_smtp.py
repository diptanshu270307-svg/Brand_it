#!/usr/bin/env python3
"""CLI utility to verify and test BrandLint SMTP email delivery in production or staging.

Usage:
  python backend/scripts/test_smtp.py
  python backend/scripts/test_smtp.py --to security@yourcompany.com
"""
import argparse
import sys
from pathlib import Path

# Ensure backend package is in python path
backend_dir = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(backend_dir))

from app.config import get_settings
from app.mail import MailMessage, SmtpMailAdapter


def mask_secret(value: str) -> str:
    if not value:
        return "<not set>"
    if len(value) <= 4:
        return "****"
    return value[:2] + "****" + value[-2:]


def main() -> int:
    parser = argparse.ArgumentParser(description="Test BrandLint production SMTP configuration.")
    parser.add_argument("--to", help="Recipient email address to send a test message to.")
    parser.add_argument("--verify-only", action="store_true", help="Only verify connection without sending test message.")
    args = parser.parse_args()

    settings = get_settings()

    print("=" * 60)
    print("BrandLint SMTP Configuration Check")
    print("=" * 60)
    print(f"  App Mode:       {settings.app_mode}")
    print(f"  Mail Provider:  {settings.resolved_mail_provider}")
    print(f"  SMTP Host:      {settings.smtp_host or '<not configured>'}")
    print(f"  SMTP Port:      {settings.smtp_port}")
    print(f"  SMTP Username:  {settings.smtp_username or '<not configured>'}")
    print(f"  SMTP Password:  {mask_secret(settings.smtp_password)}")
    print(f"  SMTP From:      {settings.smtp_from or '<not configured>'}")
    print(f"  STARTTLS:       {settings.smtp_starttls}")
    print(f"  Direct SSL:     {getattr(settings, 'smtp_ssl', False)}")
    print("-" * 60)

    if not settings.smtp_host or not settings.smtp_from:
        print("[ERROR] SMTP_HOST and SMTP_FROM environment variables must be configured.")
        print("Example configuration:")
        print("  export SMTP_HOST=smtp.sendgrid.net")
        print("  export SMTP_PORT=587")
        print("  export SMTP_USERNAME=apikey")
        print("  export SMTP_PASSWORD=your_api_key_here")
        print("  export SMTP_FROM=security@yourcompany.com")
        print("  export SMTP_STARTTLS=true")
        return 1

    adapter = SmtpMailAdapter(settings=settings)
    print("Testing SMTP connection and authentication...")
    ok, msg = adapter.verify_connection()

    if not ok:
        print(f"[FAIL] {msg}")
        return 1

    print(f"[OK] {msg}")

    if args.to and not args.verify_only:
        print(f"\nSending test transactional message to '{args.to}'...")
        test_msg = MailMessage(
            to_email=args.to,
            subject="BrandLint — Production SMTP Test Message",
            text_body=(
                "Hello,\n\n"
                "This is a test message from your BrandLint production installation.\n"
                "If you received this message, SMTP delivery is functioning correctly.\n\n"
                f"Sent from: {settings.smtp_from}\n"
                f"Via host:  {settings.smtp_host}:{settings.smtp_port}\n"
            ),
            html_body=(
                "<h3>BrandLint SMTP Test</h3>"
                "<p>This is a test message confirming your production email delivery configuration is operational.</p>"
                f"<ul><li><strong>From:</strong> {settings.smtp_from}</li>"
                f"<li><strong>Relay:</strong> {settings.smtp_host}:{settings.smtp_port}</li></ul>"
            ),
        )
        try:
            adapter.send(test_msg)
            print(f"[SUCCESS] Test message successfully sent to {args.to}")
        except Exception as e:
            print(f"[FAIL] Failed to send message: {e}")
            return 1

    print("=" * 60)
    print("SMTP verification completed successfully.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
