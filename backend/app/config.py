from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    client_id: str = ""
    client_secret: str = ""
    cors_origins: str = "http://localhost:4200"
    database_url: str = ""
    # Temporary until Clerk JWT auth is wired. Frontend/API can send X-User-Id.
    dev_user_id: str = "dev-user"

    @field_validator("client_id", "client_secret", "database_url", "dev_user_id", mode="before")
    @classmethod
    def strip_credential(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip().strip('"').strip("'")
        return value

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    def require_ebay_credentials(self) -> None:
        if not self.client_id or not self.client_secret:
            raise RuntimeError(
                "Missing CLIENT_ID / CLIENT_SECRET. "
                "Set them in Vercel → Project Settings → Environment Variables "
                "(Production), then redeploy."
            )

    def require_database_url(self) -> str:
        if not self.database_url:
            raise RuntimeError(
                "Missing DATABASE_URL. Create a Neon Postgres database and set "
                "DATABASE_URL in backend/.env (and Vercel env vars)."
            )
        return self.database_url


settings = Settings()
