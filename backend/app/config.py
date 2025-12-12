from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Central application configuration.

    All values can be overridden via environment variables or a .env file
    in the backend/ directory.
    """

    # Tell pydantic-settings v2 where to find .env
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # === MongoDB ===
    MONGODB_URI: str = "mongodb://localhost:27017"
    MONGODB_DB_NAME: str = "taboo_app"

    # === Auth / passwords ===
    # Initial seed values for staff/admin in Mongo on first startup.
    # These are only used if the roles collection is empty.
    STAFF_DEFAULT_PASSWORD: str = "123"
    ADMIN_DEFAULT_PASSWORD: str = "1234"

    # Dev password is *not* stored in Mongo and cannot be changed via UI.
    # This is your personal entry point; override in .env in real usage.
    DEV_PASSWORD: str = "TwitchyP00!!"

    # JWT / token signing secret (used for auth tokens).
    JWT_SECRET: str = "change-me-in-env"

    # === Admin password reset (Kendra) ===
    # Email address that receives admin password reset links.
    ADMIN_RESET_EMAIL: Optional[str] = None

    # === Outgoing email (for admin reset links) ===
    # For local dev you can leave these blank and the email service
    # will just log the email to console instead of sending.
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_USE_TLS: bool = True

    # === Google Sheets API (for later Sheets integration) ===
    GOOGLE_SHEETS_API_KEY: Optional[str] = None


settings = Settings()
