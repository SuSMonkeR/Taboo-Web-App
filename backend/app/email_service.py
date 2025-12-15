# backend/app/email_service.py

import smtplib
from email.message import EmailMessage

from .config import settings


def send_admin_reset_email(to_email: str, token: str) -> None:
    """
    Send an admin password reset email containing ONLY the reset token.

    The frontend is responsible for accepting the token and completing
    the reset flow. No URLs are generated or sent.
    """

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

    # If SMTP is not configured, log to console (dev mode)
    if not settings.SMTP_HOST:
        print("=== Admin Reset Email (DEV MODE) ===")
        print(f"To: {to_email}")
        print(f"Subject: {subject}")
        print()
        print(body)
        print("=== End Email ===")
        return

    msg = EmailMessage()
    msg["From"] = settings.SMTP_USER or "no-reply@example.com"
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.set_content(body)

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
            if settings.SMTP_USE_TLS:
                server.starttls()

            if settings.SMTP_USER and settings.SMTP_PASSWORD:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)

            server.send_message(msg)
    except Exception as exc:
        # Fail silently but log for visibility
        print("Failed to send admin reset email:", exc)
        print("Email that failed to send was:")
        print(msg)
