# backend/app/email_service.py

import base64
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from .config import settings


def _get_gmail_service():
    """Build and return an authenticated Gmail API service."""
    if not all([
        settings.GMAIL_CLIENT_ID,
        settings.GMAIL_CLIENT_SECRET,
        settings.GMAIL_REFRESH_TOKEN,
        settings.GMAIL_ADDRESS,
    ]):
        raise RuntimeError(
            "Gmail API not configured. "
            "Set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, GMAIL_ADDRESS in .env"
        )

    creds = Credentials(
        token=None,
        refresh_token=settings.GMAIL_REFRESH_TOKEN,
        client_id=settings.GMAIL_CLIENT_ID,
        client_secret=settings.GMAIL_CLIENT_SECRET,
        token_uri="https://oauth2.googleapis.com/token",
    )

    return build("gmail", "v1", credentials=creds)


def _send_email(to_email: str, subject: str, html_body: str) -> None:
    """Send an email via Gmail API."""
    msg = MIMEMultipart("alternative")
    msg["From"] = settings.GMAIL_ADDRESS
    msg["To"] = to_email.strip()
    msg["Subject"] = subject
    msg.attach(MIMEText(html_body, "html"))

    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()

    try:
        service = _get_gmail_service()
        service.users().messages().send(
            userId="me",
            body={"raw": raw}
        ).execute()
    except HttpError as e:
        raise RuntimeError(f"Gmail API error: {e}")


def send_password_reset_email(to_email: str, reset_link: str, ip_address: str = "Unknown") -> None:
    """Send a password reset email with a magic link."""
    from .email_templates import get_password_reset_email_html

    if not to_email or not to_email.strip():
        raise RuntimeError("No recipient email provided.")

    html_body = get_password_reset_email_html(reset_link, ip_address)
    _send_email(to_email, "Reset Your Taboo Password", html_body)


def send_password_reset_confirmation_email(to_email: str, display_name: str) -> None:
    """Send a confirmation email after password is successfully reset."""
    from .email_templates import get_password_reset_confirmation_email_html

    if not to_email or not to_email.strip():
        return

    html_body = get_password_reset_confirmation_email_html(display_name)

    try:
        _send_email(to_email, "Your Taboo Password Was Changed", html_body)
    except Exception as e:
        # Silently fail for confirmation emails - not critical
        print(f"Failed to send confirmation email: {e}")
