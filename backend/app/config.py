# backend/app/config.py

from typing import Optional, List

from pydantic_settings import BaseSettings, SettingsConfigDict


def _split_origins(value: Optional[str]) -> List[str]:
    """
    Support either:
      - a single URL: "https://example.com"
      - a comma-separated list: "https://a.com,https://b.com"
    Returns a cleaned list (no blanks, no trailing slashes).
    """
    if not value:
        return []
    parts = [p.strip().rstrip("/") for p in value.split(",")]
    return [p for p in parts if p]


class Settings(BaseSettings):
    """
    Central application configuration.

    All values can be overridden via environment variables or a .env file
    in the backend/ directory.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # === MongoDB ===
    MONGODB_URI: str = "mongodb://localhost:27017"
    MONGODB_DB_NAME: str = "taboo_app"

    # === Auth / passwords ===
    STAFF_DEFAULT_PASSWORD: str = "123"
    ADMIN_DEFAULT_PASSWORD: str = "1234"

    # Dev password is *not* stored in Mongo and cannot be changed via UI.
    DEV_PASSWORD: str = "TwitchyP00!!"

    # JWT / token signing secret (used for auth tokens).
    JWT_SECRET: str = "change-me-in-env"

    # === Admin password reset ===
    ADMIN_RESET_EMAIL: Optional[str] = None

    # === Outgoing email (for admin reset token emails) ===
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_USE_TLS: bool = True

    # === Google Sheets API ===
    GOOGLE_SHEETS_API_KEY: Optional[str] = None

    # === Frontend URL (for CORS allowlist) ===
    # Set on Render: REACT_FRONTEND_URL=https://taboo-web-app.onrender.com
    REACT_FRONTEND_URL: str = ""

    # Optional: allow multiple origins via env var, comma-separated.
    # Set on Render if needed: CORS_ORIGINS="https://taboo-web-app.onrender.com,https://your-custom-domain.com"
    CORS_ORIGINS: str = ""

    @property
    def cors_allow_origins(self) -> List[str]:
        """
        Final CORS allowlist used by backend/app/main.py.
        Priority:
          1) CORS_ORIGINS if provided (comma-separated)
          2) REACT_FRONTEND_URL if provided
          3) Local dev defaults
        """
        origins = _split_origins(self.CORS_ORIGINS)

        if not origins and self.REACT_FRONTEND_URL.strip():
            origins = [self.REACT_FRONTEND_URL.strip().rstrip("/")]

        # Always include local dev defaults (harmless on Render, useful locally)
        for o in ("http://localhost:5173", "http://127.0.0.1:5173"):
            if o not in origins:
                origins.append(o)

        return origins


settings = Settings()
