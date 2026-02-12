# backend/app/config.py

from typing import Optional, List

from pydantic_settings import BaseSettings, SettingsConfigDict


def _split_origins(value: Optional[str]) -> List[str]:
    if not value:
        return []
    parts = [p.strip().rstrip("/") for p in value.split(",")]
    return [p for p in parts if p]


class Settings(BaseSettings):
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
    DEV_PASSWORD: str = "TwitchyP00!!"
    JWT_SECRET: str = "change-me-in-env"

    # === Admin password reset ===
    ADMIN_RESET_EMAIL: Optional[str] = None

    # === Gmail API (OAuth2) ===
    GMAIL_CLIENT_ID: str = ""
    GMAIL_CLIENT_SECRET: str = ""
    GMAIL_REFRESH_TOKEN: str = ""
    GMAIL_ADDRESS: str = ""

    # === Google Sheets API ===
    GOOGLE_SHEETS_API_KEY: Optional[str] = None

    # === Frontend URL ===
    REACT_FRONTEND_URL: str = ""
    FRONTEND_URL: str = ""
    CORS_ORIGINS: str = ""

    @property
    def cors_allow_origins(self) -> List[str]:
        origins = _split_origins(self.CORS_ORIGINS)

        if not origins and self.REACT_FRONTEND_URL.strip():
            origins = [self.REACT_FRONTEND_URL.strip().rstrip("/")]

        for o in ("http://localhost:5173", "http://127.0.0.1:5173"):
            if o not in origins:
                origins.append(o)

        return origins


settings = Settings()
