"""
Beautiful HTML email templates for Taboo application.
"""

def get_password_reset_email_html(reset_link: str, ip_address: str = "Unknown") -> str:
    """
    Generate a beautiful HTML email for password reset.
    
    Args:
        reset_link: The full URL with token for password reset
        ip_address: IP address of requester (for security info)
    
    Returns:
        HTML string for the email body
    """
    return f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {{
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background-color: #f5f5f5;
        }}
        .email-container {{
            max-width: 600px;
            margin: 40px auto;
            background-color: #ffffff;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }}
        .header {{
            background-color: #667eea;
            padding: 40px 30px;
            text-align: center;
        }}
        .header h1 {{
            margin: 0;
            color: #ffffff;
            font-size: 32px;
            font-weight: 700;
            letter-spacing: 1px;
        }}
        .header .emoji {{
            font-size: 48px;
            margin-bottom: 10px;
        }}
        .content {{
            padding: 40px 30px;
        }}
        .content h2 {{
            margin: 0 0 20px 0;
            color: #1a1a1a;
            font-size: 24px;
            font-weight: 600;
        }}
        .content p {{
            margin: 0 0 20px 0;
            color: #4a4a4a;
            font-size: 16px;
            line-height: 1.6;
        }}
        .cta-button {{
            display: inline-block;
            padding: 16px 40px;
            background-color: #667eea;
            color: #ffffff;
            text-decoration: none;
            border-radius: 8px;
            font-size: 18px;
            font-weight: 600;
            margin: 20px 0;
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }}
        .cta-button:hover {{
            background-color: #5568d3;
        }}
        .info-box {{
            background-color: #f8f9fa;
            border-left: 4px solid #667eea;
            padding: 15px 20px;
            margin: 20px 0;
            border-radius: 4px;
        }}
        .info-box p {{
            margin: 5px 0;
            font-size: 14px;
            color: #666;
        }}
        .info-box strong {{
            color: #333;
        }}
        .security-notice {{
            background-color: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px 20px;
            margin: 20px 0;
            border-radius: 4px;
        }}
        .security-notice p {{
            margin: 0;
            color: #856404;
            font-size: 14px;
        }}
        .footer {{
            background-color: #f8f9fa;
            padding: 30px;
            text-align: center;
            border-top: 1px solid #e9ecef;
        }}
        .footer p {{
            margin: 5px 0;
            color: #6c757d;
            font-size: 14px;
        }}
        .footer a {{
            color: #667eea;
            text-decoration: none;
        }}
        @media only screen and (max-width: 600px) {{
            .email-container {{
                margin: 0;
                border-radius: 0;
            }}
            .header, .content, .footer {{
                padding: 30px 20px;
            }}
            .cta-button {{
                display: block;
                text-align: center;
            }}
        }}
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <div class="emoji">🔐</div>
            <h1>TABOO</h1>
        </div>
        
        <div class="content">
            <h2>Password Reset Request</h2>
            <p>Someone (hopefully you!) requested a password reset for your Taboo account.</p>
            <p>Click the button below to reset your password:</p>
            
            <center>
                <a href="{reset_link}" class="cta-button" style="color: #ffffff !important; text-decoration: none !important;">Reset My Password</a>
            </center>
            
            <div class="info-box" style="margin-top: 20px;">
                <p><strong>Button not working?</strong> Copy and paste this link into your browser:</p>
                <p style="word-break: break-all; color: #667eea; font-size: 13px;">{reset_link}</p>
            </div>
            
            <div class="info-box">
                <p><strong>⏰ This link expires in 1 hour</strong></p>
                <p>For security, password reset links are only valid for a short time.</p>
            </div>
            
            <div class="info-box">
                <p><strong>Request Details:</strong></p>
                <p>IP Address: {ip_address}</p>
                <p>Time: Just now</p>
            </div>
            
            <div class="security-notice">
                <p><strong>⚠️ Didn't request this?</strong><br>
                Your account is safe. You can ignore this email - the link will expire automatically.</p>
            </div>
        </div>
        
        <div class="footer">
            <p><strong>Taboo Application</strong></p>
            <p>This is an automated message. Please do not reply to this email.</p>
            <p>Questions? Contact your administrator.</p>
        </div>
    </div>
</body>
</html>
"""


def get_password_reset_confirmation_email_html(display_name: str) -> str:
    """
    Generate a beautiful HTML email confirming password was changed.
    
    Args:
        display_name: User's display name
    
    Returns:
        HTML string for the email body
    """
    return f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {{
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background-color: #f5f5f5;
        }}
        .email-container {{
            max-width: 600px;
            margin: 40px auto;
            background-color: #ffffff;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }}
        .header {{
            background-color: #10b981;
            padding: 40px 30px;
            text-align: center;
        }}
        .header h1 {{
            margin: 0;
            color: #ffffff;
            font-size: 32px;
            font-weight: 700;
            letter-spacing: 1px;
        }}
        .header .emoji {{
            font-size: 48px;
            margin-bottom: 10px;
        }}
        .content {{
            padding: 40px 30px;
        }}
        .content h2 {{
            margin: 0 0 20px 0;
            color: #1a1a1a;
            font-size: 24px;
            font-weight: 600;
        }}
        .content p {{
            margin: 0 0 20px 0;
            color: #4a4a4a;
            font-size: 16px;
            line-height: 1.6;
        }}
        .success-box {{
            background-color: #d1fae5;
            border-left: 4px solid #10b981;
            padding: 15px 20px;
            margin: 20px 0;
            border-radius: 4px;
        }}
        .success-box p {{
            margin: 0;
            color: #065f46;
            font-size: 14px;
        }}
        .security-notice {{
            background-color: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px 20px;
            margin: 20px 0;
            border-radius: 4px;
        }}
        .security-notice p {{
            margin: 0;
            color: #856404;
            font-size: 14px;
        }}
        .footer {{
            background-color: #f8f9fa;
            padding: 30px;
            text-align: center;
            border-top: 1px solid #e9ecef;
        }}
        .footer p {{
            margin: 5px 0;
            color: #6c757d;
            font-size: 14px;
        }}
        @media only screen and (max-width: 600px) {{
            .email-container {{
                margin: 0;
                border-radius: 0;
            }}
            .header, .content, .footer {{
                padding: 30px 20px;
            }}
        }}
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <div class="emoji">✅</div>
            <h1>TABOO</h1>
        </div>
        
        <div class="content">
            <h2>Password Changed Successfully</h2>
            <p>Hi {display_name},</p>
            <p>Your Taboo password has been changed successfully.</p>
            
            <div class="success-box">
                <p><strong>✓ Your account is secure</strong><br>
                You can now log in with your new password.</p>
            </div>
            
            <div class="security-notice">
                <p><strong>⚠️ Didn't change your password?</strong><br>
                If you didn't make this change, contact your administrator immediately.</p>
            </div>
        </div>
        
        <div class="footer">
            <p><strong>Taboo Application</strong></p>
            <p>This is an automated message. Please do not reply to this email.</p>
            <p>Questions? Contact your administrator.</p>
        </div>
    </div>
</body>
</html>
"""
