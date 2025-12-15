# backend/app/email_service.py

from __future__ import annotations

import os
import smtplib
from email.message import EmailMessage
from typing import Optional

import requests

from .config import settings


def _build_reset_email(token: str) -> tuple[str, str]:
    subject = "Taboo Admin Password Reset Token"
    body = (
        "A request was made to reset the admin password for the Taboo web app.\n\n"
        "If you did not request this, you can safely ignore this email.\n\n"
        "Use the following reset token inside the Taboo app:\n\n"
        f"{token}\n\n"
        "Open the Taboo app, go to the Password Manager tab,\n"
        "paste the token, enter a new admin password, and submit.\n\n"
        "This token will expire according to server rules.\n"
    )
    return subject, body


def _get_env(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


def _mailgun_send(to_email: str, subject: str, body: str) -> None:
    """
    Send email via Mailgun HTTP API (recommended for Render free tier).
    Required env/config:
      - MAILGUN_API_KEY
      - MAILGUN_DOMAIN   (e.g. sandbox....mailgun.org)
    Optional:
      - MAILGUN_FROM     (defaults to postmaster@<domain>)
      - MAILGUN_BASE_URL (defaults to https://api.mailgun.net)
    """
    # Pull from Settings if you add them later, otherwise fallback to env vars.
    api_key = getattr(settings, "MAILGUN_API_KEY", None) or _get_env("MAILGUN_API_KEY")
    domain = getattr(settings, "MAILGUN_DOMAIN", None) or _get_env("MAILGUN_DOMAIN")
    base_url = getattr(settings, "MAILGUN_BASE_URL", None) or _get_env(
        "MAILGUN_BASE_URL", "https://api.mailgun.net"
    )
    from_addr = getattr(settings, "MAILGUN_FROM", None) or _get_env("MAILGUN_FROM")

    if not api_key or not domain:
        raise RuntimeError(
            "Mailgun not configured. Set MAILGUN_API_KEY and MAILGUN_DOMAIN."
        )

    if not from_addr:
        from_addr = f"postmaster@{domain}"

    url = f"{base_url.rstrip('/')}/v3/{domain}/messages"

    resp = requests.post(
        url,
        auth=("api", api_key),
        data={
            "from": f"Taboo Admin <{from_addr}>",
            "to": to_email,
            "subject": subject,
            "text": body,
        },
        timeout=12,
    )

    if not resp.ok:
        # Include Mailgun's response body to make debugging painless.
        raise RuntimeError(
            f"Mailgun send failed: {resp.status_code} {resp.text}"
        )


def _smtp_send(to_email: str, subject: str, body: str) -> None:
    """
    Send using SMTP (works locally; Render free tier blocks SMTP ports).
    Uses existing settings.* fields.
    """
    msg = EmailMessage()
    msg["From"] = settings.SMTP_USER or "no-reply@example.com"
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.set_content(body)

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=12) as server:
        if settings.SMTP_USE_TLS:
            server.starttls()

        if settings.SMTP_USER and settings.SMTP_PASSWORD:
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)

        server.send_message(msg)


def send_admin_reset_email(to_email: str, token: str) -> None:
    """
    Send an admin password reset email containing ONLY the reset token.

    Delivery priority:
      1) Mailgun (HTTP API) if configured (works on Render free tier)
      2) SMTP if configured (works locally; likely blocked on Render free)
      3) Dev-mode print to logs if neither configured

    This function raises on failure (so the API can return an error instead of "green").
    """
    subject, body = _build_reset_email(token)

    # Safety: nothing to do if no recipient passed
    if not to_email or not to_email.strip():
        raise RuntimeError("No recipient email provided for admin reset.")

    # Try Mailgun first (best for Render)
    mailgun_key_present = bool(
        getattr(settings, "MAILGUN_API_KEY", None) or _get_env("MAILGUN_API_KEY")
    )
    mailgun_domain_present = bool(
        getattr(settings, "MAILGUN_DOMAIN", None) or _get_env("MAILGUN_DOMAIN")
    )

    if mailgun_key_present and mailgun_domain_present:
        _mailgun_send(to_email.strip(), subject, body)
        return

    # Otherwise try SMTP if configured
    if settings.SMTP_HOST:
        _smtp_send(to_email.strip(), subject, body)
        return

    # Dev fallback
    print("=== Admin Reset Email (DEV MODE) ===")
    print(f"To: {to_email}")
    print(f"Subject: {subject}")
    print()
    print(body)
    print("=== End Email ===")
