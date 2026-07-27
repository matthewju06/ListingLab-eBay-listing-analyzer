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

    @field_validator("client_id", "client_secret", mode="before")
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


settings = Settings()
