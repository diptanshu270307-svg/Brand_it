"""Mail adapter for BrandLint account recovery and transactional messages.

In development and isolated-demo modes, the default adapter is `dev-outbox`,
which writes messages to local files in `backend/.dev_outbox/` for safe inspection
without making external network connections.

In production mode, configure SMTP via environment variables:
  SMTP_HOST=smtp.sendgrid.net
  SMTP_PORT=587
  SMTP_USERNAME=apikey
  SMTP_PASSWORD=your-secret-api-key
  SMTP_FROM=security@yourcompany.com
  SMTP_STARTTLS=true

If SMTP is not configured in production, the system falls back to `none` (logs
that email delivery is not configured, without failing silently or faking delivery).
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime, timezone
import json
import logging
from pathlib import Path
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from .config import get_settings

log = logging.getLogger("brandlint.mail")


@dataclass
class MailMessage:
    to_email: str
    subject: str
    text_body: str
    html_body: str | None = None


class MailAdapter(ABC):
    @abstractmethod
    def send(self, message: MailMessage) -> None:
        """Send a transactional email message."""
        pass

    def send_recovery_email(self, to_email: str, reset_url: str) -> None:
        """Helper to send a password recovery link."""
        subject = "BrandLint — Password Recovery Request"
        text_body = (
            f"Hello,\n\n"
            f"A password reset was requested for your BrandLint account.\n"
            f"To reset your password, open the following link:\n\n"
            f"{reset_url}\n\n"
            f"This link is valid for 30 minutes and can only be used once.\n"
            f"If you did not request this, you can safely ignore this email.\n"
        )
        html_body = (
            f"<p>Hello,</p>"
            f"<p>A password reset was requested for your BrandLint account.</p>"
            f"<p><a href=\"{reset_url}\">Click here to reset your password</a></p>"
            f"<p>Or paste this URL into your browser:<br><code>{reset_url}</code></p>"
            f"<p><small>This link is valid for 30 minutes and can only be used once.</small></p>"
        )
        self.send(MailMessage(to_email=to_email, subject=subject, text_body=text_body, html_body=html_body))

    def send_invitation_email(self, to_email: str, company_name: str, role_label: str, invite_url: str) -> None:
        """Helper to send a company team invitation link."""
        subject = f"Invitation to join {company_name} on BrandLint"
        text_body = (
            f"Hello,\n\n"
            f"You have been invited to join the '{company_name}' workspace on BrandLint as a {role_label}.\n\n"
            f"To accept this invitation and set up your workspace access, open this link:\n"
            f"{invite_url}\n\n"
            f"This invitation link is single-use and will expire in 7 days.\n"
        )
        html_body = (
            f"<p>Hello,</p>"
            f"<p>You have been invited to join the <strong>{company_name}</strong> workspace on BrandLint as a <strong>{role_label}</strong>.</p>"
            f"<p><a href=\"{invite_url}\">Click here to accept your invitation</a></p>"
            f"<p>Or paste this URL into your browser:<br><code>{invite_url}</code></p>"
            f"<p><small>This invitation is single-use and will expire in 7 days.</small></p>"
        )
        self.send(MailMessage(to_email=to_email, subject=subject, text_body=text_body, html_body=html_body))


class DevOutboxMailAdapter(MailAdapter):
    """Safe local development outbox. Writes emails to JSON files in dev_outbox_dir."""

    def __init__(self, outbox_dir: Path | None = None):
        if outbox_dir is None:
            settings = get_settings()
            if settings.dev_outbox_dir:
                self.outbox_dir = Path(settings.dev_outbox_dir).resolve()
            else:
                self.outbox_dir = (Path(__file__).resolve().parents[1] / ".dev_outbox").resolve()
        else:
            self.outbox_dir = outbox_dir.resolve()
        self.outbox_dir.mkdir(parents=True, exist_ok=True)

    def send(self, message: MailMessage) -> None:
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        safe_to = "".join(c if c.isalnum() or c in "@.-" else "_" for c in message.to_email)
        filename = f"{timestamp}_{safe_to}.json"
        target = self.outbox_dir / filename

        record = {
            "to": message.to_email,
            "subject": message.subject,
            "text": message.text_body,
            "html": message.html_body,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        target.write_text(json.dumps(record, indent=2), encoding="utf-8")
        log.info("dev-outbox saved email for %s to %s", message.to_email, target.name)


class SmtpMailAdapter(MailAdapter):
    """Production SMTP email delivery."""

    def __init__(self, settings=None):
        self.settings = settings or get_settings()

    def _create_connection(self):
        s = self.settings
        use_ssl = getattr(s, "smtp_ssl", False) or s.smtp_port == 465
        if use_ssl:
            server = smtplib.SMTP_SSL(s.smtp_host, s.smtp_port, timeout=15)
        else:
            server = smtplib.SMTP(s.smtp_host, s.smtp_port, timeout=15)
            if s.smtp_starttls:
                server.starttls()

        if s.smtp_username and s.smtp_password:
            server.login(s.smtp_username, s.smtp_password)
        return server

    def verify_connection(self) -> tuple[bool, str]:
        """Test connectivity and authentication against the configured SMTP host."""
        s = self.settings
        if not s.smtp_host or not s.smtp_from:
            return False, "SMTP_HOST and SMTP_FROM must be configured"

        mode_desc = "SSL (port 465)" if (getattr(s, "smtp_ssl", False) or s.smtp_port == 465) else ("STARTTLS" if s.smtp_starttls else "Plain")
        try:
            with self._create_connection() as server:
                server.noop()
            return True, f"Successfully connected and authenticated to {s.smtp_host}:{s.smtp_port} using {mode_desc}."
        except smtplib.SMTPAuthenticationError:
            return False, f"SMTP authentication failed on {s.smtp_host}:{s.smtp_port}. Verify SMTP_USERNAME and SMTP_PASSWORD."
        except smtplib.SMTPConnectError as exc:
            return False, f"Could not establish connection to {s.smtp_host}:{s.smtp_port}: {exc}"
        except Exception as exc:
            return False, f"SMTP connection failed on {s.smtp_host}:{s.smtp_port} ({type(exc).__name__}): {exc}"

    def send(self, message: MailMessage) -> None:
        s = self.settings
        if not s.smtp_host or not s.smtp_from:
            log.warning("SMTP requested but SMTP_HOST or SMTP_FROM is not set. Dropping message.")
            return

        msg = MIMEMultipart("alternative")
        msg["Subject"] = message.subject
        msg["From"] = s.smtp_from
        msg["To"] = message.to_email
        msg.attach(MIMEText(message.text_body, "plain", "utf-8"))
        if message.html_body:
            msg.attach(MIMEText(message.html_body, "html", "utf-8"))

        try:
            with self._create_connection() as server:
                server.send_message(msg)
            log.info("SMTP sent email to %s", message.to_email)
        except Exception as e:
            log.error("SMTP delivery to %s failed: %s", message.to_email, type(e).__name__)
            raise RuntimeError("Email delivery failed") from e


class NoopMailAdapter(MailAdapter):
    """Fallback when email delivery is not configured."""

    def send(self, message: MailMessage) -> None:
        log.info("No mail provider configured. Password recovery message to %s was dropped.", message.to_email)


_adapter_override: MailAdapter | None = None


def set_mail_adapter_override(adapter: MailAdapter | None) -> None:
    """Testing hook to capture sent emails in tests."""
    global _adapter_override
    _adapter_override = adapter


def get_mail_adapter() -> MailAdapter:
    if _adapter_override is not None:
        return _adapter_override

    settings = get_settings()
    provider = settings.resolved_mail_provider
    if provider == "dev-outbox":
        return DevOutboxMailAdapter()
    elif provider == "smtp":
        return SmtpMailAdapter()
    return NoopMailAdapter()
