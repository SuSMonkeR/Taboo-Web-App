# backend/app/email_service.py

from __future__ import annotations

import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional

try:
    import resend
except ImportError:
    resend = None

from .config import settings


def _get_env(name: str, default: str = "") -> str:
    """Get environment variable with fallback."""
    return os.getenv(name, default).strip()


def _send_via_smtp(to_email: str, subject: str, html_body: str, text_body: Optional[str] = None) -> None:
    """
    Send email via Gmail SMTP.
    
    Fallback method when Resend is not configured or in sandbox mode.
    """
    smtp_host = settings.SMTP_HOST
    smtp_port = settings.SMTP_PORT
    smtp_user = settings.SMTP_USER
    smtp_password = settings.SMTP_PASSWORD
    
    if not all([smtp_host, smtp_user, smtp_password]):
        raise RuntimeError("SMTP not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASSWORD.")
    
    # Create message
    msg = MIMEMultipart('alternative')
    msg['From'] = smtp_user
    msg['To'] = to_email
    msg['Subject'] = subject
    
    # Add text and HTML parts
    if text_body:
        msg.attach(MIMEText(text_body, 'plain'))
    msg.attach(MIMEText(html_body, 'html'))
    
    # Send via SMTP
    try:
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            if settings.SMTP_USE_TLS:
                server.starttls()
            server.login(smtp_user, smtp_password)
            server.send_message(msg)
    except Exception as e:
        raise RuntimeError(f"Failed to send email via SMTP: {str(e)}")


def _build_reset_email(token: str, email_type: str = "admin") -> tuple[str, str]:
    """
    Build email subject and body for password reset.
    
    email_type: "admin" or "owner"
    """
    if email_type == "owner":
        subject = "Taboo Owner Password Reset Token"
        body = f"""
A request was made to reset the owner password for the Taboo web app.

If you did not request this, you can safely ignore this email.

Use the following reset token inside the Taboo app:

{token}

Open the Taboo app, go to the Owner tab, paste the token, enter a new password, and submit.

This token will expire in 24 hours.
"""
    else:
        subject = "Taboo Admin Password Reset Token"
        body = f"""
A request was made to reset the admin password for the Taboo web app.

If you did not request this, you can safely ignore this email.

Use the following reset token inside the Taboo app:

{token}

Open the Taboo app, go to the Password Manager tab, paste the token, enter a new admin password, and submit.

This token will expire according to server rules.
"""
    
    return subject, body.strip()


def send_admin_reset_email(to_email: str, token: str, email_type: str = "admin") -> None:
    """
    Send a password reset email using Resend or Gmail SMTP fallback.
    
    Args:
        to_email: Recipient email address
        token: Password reset token
        email_type: "admin" or "owner" (determines email content)
    
    Raises:
        RuntimeError: If neither Resend nor SMTP is configured
    """
    # Validate recipient
    if not to_email or not to_email.strip():
        raise RuntimeError("No recipient email provided for password reset.")
    
    # Build email content
    subject, body = _build_reset_email(token, email_type)
    
    # Try Resend first
    api_key = getattr(settings, "RESEND_API_KEY", None) or _get_env("RESEND_API_KEY")
    
    if api_key and resend is not None:
        try:
            resend.api_key = api_key
            from_email = getattr(settings, "RESEND_FROM_EMAIL", None) or _get_env(
                "RESEND_FROM_EMAIL", "onboarding@resend.dev"
            )
            
            result = resend.Emails.send({
                "from": from_email,
                "to": to_email.strip(),
                "subject": subject,
                "text": body,
            })
            
            if result and result.get("id"):
                return  # Success!
        except Exception as e:
            print(f"Resend failed, trying SMTP fallback: {e}")
    
    # Fallback to SMTP
    _send_via_smtp(to_email, subject, f"<pre>{body}</pre>", body)


# Alias for backwards compatibility
def send_owner_reset_email(to_email: str, token: str) -> None:
    """Send owner password reset email."""
    send_admin_reset_email(to_email, token, email_type="owner")


def send_password_reset_email(to_email: str, reset_link: str, ip_address: str = "Unknown") -> None:
    """
    Send a beautiful HTML password reset email using Resend or Gmail SMTP fallback.
    
    Args:
        to_email: Recipient email address
        reset_link: Full URL with token for password reset
        ip_address: IP address of requester (for security info)
    
    Raises:
        RuntimeError: If neither Resend nor SMTP is configured
    """
    from .email_templates import get_password_reset_email_html
    
    # Validate recipient
    if not to_email or not to_email.strip():
        raise RuntimeError("No recipient email provided for password reset.")
    
    # Generate HTML email
    html_body = get_password_reset_email_html(reset_link, ip_address)
    
    # Try Resend first
    api_key = getattr(settings, "RESEND_API_KEY", None) or _get_env("RESEND_API_KEY")
    
    if api_key and resend is not None:
        try:
            resend.api_key = api_key
            from_email = getattr(settings, "RESEND_FROM_EMAIL", None) or _get_env(
                "RESEND_FROM_EMAIL", "onboarding@resend.dev"
            )
            
            result = resend.Emails.send({
                "from": from_email,
                "to": to_email.strip(),
                "subject": "Reset Your Taboo Password",
                "html": html_body,
            })
            
            if result and result.get("id"):
                return  # Success!
        except Exception as e:
            print(f"Resend failed, trying SMTP fallback: {e}")
    
    # Fallback to SMTP
    _send_via_smtp(to_email, "Reset Your Taboo Password", html_body)


def send_password_reset_confirmation_email(to_email: str, display_name: str) -> None:
    """
    Send a confirmation email after password is successfully reset.
    
    Args:
        to_email: Recipient email address
        display_name: User's display name
    """
    from .email_templates import get_password_reset_confirmation_email_html
    
    # Validate recipient
    if not to_email or not to_email.strip():
        return  # Silently fail for confirmation emails
    
    # Generate HTML email
    html_body = get_password_reset_confirmation_email_html(display_name)
    
    # Try Resend first
    api_key = getattr(settings, "RESEND_API_KEY", None) or _get_env("RESEND_API_KEY")
    
    if api_key and resend is not None:
        try:
            resend.api_key = api_key
            from_email = getattr(settings, "RESEND_FROM_EMAIL", None) or _get_env(
                "RESEND_FROM_EMAIL", "onboarding@resend.dev"
            )
            
            resend.Emails.send({
                "from": from_email,
                "to": to_email.strip(),
                "subject": "Your Taboo Password Was Changed",
                "html": html_body,
            })
            return
        except Exception:
            pass
    
    # Fallback to SMTP (silently fail if it doesn't work)
    try:
        _send_via_smtp(to_email, "Your Taboo Password Was Changed", html_body)
    except Exception:
        pass  # Silently fail for confirmation emails
