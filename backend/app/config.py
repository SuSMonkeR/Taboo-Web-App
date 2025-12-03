from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Shared staff password — can change later
    STAFF_PASSWORD: str = "123"

    class Config:
        env_file = ".env"


settings = Settings()
