from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    client_id: str = ""
    client_secret: str = ""
    cors_origins: str = "http://localhost:4200"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    def require_ebay_credentials(self) -> None:
        if not self.client_id or not self.client_secret:
            raise RuntimeError("Missing CLIENT_ID / CLIENT_SECRET environment variables")


settings = Settings()
