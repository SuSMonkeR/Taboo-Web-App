# backend/app/email_service.py

from __future__ import annotations

import os
from typing import Optional

try:
    import resend
except ImportError:
    resend = None

from .config import settings


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


def _get_env(name: str, default: str = "") -> str:
    """Get environment variable with fallback."""
    return os.getenv(name, default).strip()


def send_admin_reset_email(to_email: str, token: str, email_type: str = "admin") -> None:
    """
    Send a password reset email using Resend.
    
    Args:
        to_email: Recipient email address
        token: Password reset token
        email_type: "admin" or "owner" (determines email content)
    
    Raises:
        RuntimeError: If Resend is not configured or sending fails
    """
    # Validate recipient
    if not to_email or not to_email.strip():
        raise RuntimeError("No recipient email provided for password reset.")
    
    # Check if Resend is installed
    if resend is None:
        raise RuntimeError("Resend package not installed. Run: pip install resend")
    
    # Get API key
    api_key = getattr(settings, "RESEND_API_KEY", None) or _get_env("RESEND_API_KEY")
    
    if not api_key:
        raise RuntimeError("Resend not configured. Set RESEND_API_KEY environment variable.")
    
    # Set API key
    resend.api_key = api_key
    
    # Get from address (default to onboarding@resend.dev for sandbox)
    from_email = getattr(settings, "RESEND_FROM_EMAIL", None) or _get_env(
        "RESEND_FROM_EMAIL", "onboarding@resend.dev"
    )
    
    # Build email content
    subject, body = _build_reset_email(token, email_type)
    
    try:
        # Send email
        result = resend.Emails.send({
            "from": from_email,
            "to": to_email.strip(),
            "subject": subject,
            "text": body,
        })
        
        # Resend returns a dict with 'id' on success
        if not result or not result.get("id"):
            raise RuntimeError("Resend send failed: No email ID returned")
            
    except Exception as e:
        raise RuntimeError(f"Failed to send email via Resend: {str(e)}")


# Alias for backwards compatibility
def send_owner_reset_email(to_email: str, token: str) -> None:
    """Send owner password reset email."""
    send_admin_reset_email(to_email, token, email_type="owner")


def send_password_reset_email(to_email: str, reset_link: str, ip_address: str = "Unknown") -> None:
    """
    Send a beautiful HTML password reset email using Resend.
    
    Args:
        to_email: Recipient email address
        reset_link: Full URL with token for password reset
        ip_address: IP address of requester (for security info)
    
    Raises:
        RuntimeError: If Resend is not configured or sending fails
    """
    from .email_templates import get_password_reset_email_html
    
    # Validate recipient
    if not to_email or not to_email.strip():
        raise RuntimeError("No recipient email provided for password reset.")
    
    # Check if Resend is installed
    if resend is None:
        raise RuntimeError("Resend package not installed. Run: pip install resend")
    
    # Get API key
    api_key = getattr(settings, "RESEND_API_KEY", None) or _get_env("RESEND_API_KEY")
    
    if not api_key:
        raise RuntimeError("Resend not configured. Set RESEND_API_KEY environment variable.")
    
    # Set API key
    resend.api_key = api_key
    
    # Get from address
    from_email = getattr(settings, "RESEND_FROM_EMAIL", None) or _get_env(
        "RESEND_FROM_EMAIL", "onboarding@resend.dev"
    )
    
    # Generate HTML email
    html_body = get_password_reset_email_html(reset_link, ip_address)
    
    try:
        # Send email with HTML
        result = resend.Emails.send({
            "from": from_email,
            "to": to_email.strip(),
            "subject": "Reset Your Taboo Password",
            "html": html_body,
        })
        
        if not result or not result.get("id"):
            raise RuntimeError("Resend send failed: No email ID returned")
            
    except Exception as e:
        raise RuntimeError(f"Failed to send email via Resend: {str(e)}")


def send_password_reset_confirmation_email(to_email: str, display_name: str) -> None:
    """
    Send a confirmation email after password is successfully reset.
    
    Args:
        to_email: Recipient email address
        display_name: User's display name
    
    Raises:
        RuntimeError: If Resend is not configured or sending fails
    """
    from .email_templates import get_password_reset_confirmation_email_html
    
    # Validate recipient
    if not to_email or not to_email.strip():
        return  # Silently fail for confirmation emails
    
    # Check if Resend is installed
    if resend is None:
        return
    
    # Get API key
    api_key = getattr(settings, "RESEND_API_KEY", None) or _get_env("RESEND_API_KEY")
    
    if not api_key:
        return
    
    # Set API key
    resend.api_key = api_key
    
    # Get from address
    from_email = getattr(settings, "RESEND_FROM_EMAIL", None) or _get_env(
        "RESEND_FROM_EMAIL", "onboarding@resend.dev"
    )
    
    # Generate HTML email
    html_body = get_password_reset_confirmation_email_html(display_name)
    
    try:
        # Send email with HTML
        resend.Emails.send({
            "from": from_email,
            "to": to_email.strip(),
            "subject": "Your Taboo Password Was Changed",
            "html": html_body,
        })
    except Exception:
        pass  # Silently fail for confirmation emails
