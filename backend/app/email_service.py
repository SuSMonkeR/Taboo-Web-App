# backend/app/email_service.py
import smtplib
from email.message import EmailMessage

from .config import settings


def _build_reset_link(token: str) -> str:
    """
    Build a reset link for the admin password.

    For now we hardcode the frontend URL path; you can adjust this later
    or move the base URL into settings if you want.
    """
    # You can change this if your frontend runs elsewhere:
    base_url = "http://localhost:5173"
    return f"{base_url}/admin-reset?token={token}"


def send_admin_reset_email(to_email: str, token: str) -> None:
    """
    Send an admin password reset email to the given address.

    If SMTP settings are not configured, this will simply log the email
    contents to the console (dev mode), so the rest of the flow can still
    be exercised without a real mail server.
    """
    reset_link = _build_reset_link(token)

    subject = "Taboo Admin Password Reset"
    body = (
        "A request was made to reset the admin password for the Taboo web app.\n\n"
        "If you did not request this, you can ignore this email.\n\n"
        "You have two ways to complete the reset:\n\n"
        "1) Open this link to launch the app:\n"
        f"{reset_link}\n\n"
        "2) Or copy this reset token and paste it into the 'Admin password reset'\n"
        "   section of the Taboo app (in the Password Manager tab):\n\n"
        f"{token}\n\n"
        "After pasting the token, enter the new admin password and submit.\n"
    )

    # If SMTP is not configured, just log to console and return.
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
        # Fail silently but log so you can see issues in dev logs
        print("Failed to send admin reset email:", exc)
        print("Email that failed to send was:")
        print(msg)
