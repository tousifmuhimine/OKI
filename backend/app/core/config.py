from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "OKI CRM API"
    app_env: str = "development"
    debug: bool = True
    api_v1_prefix: str = "/api/v1"
    frontend_origin: str = "http://localhost:3000"
    frontend_origin_regex: str = r"^http://(localhost|127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}):\d+$"

    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
    supabase_jwt_secret: str = ""
    supabase_db_url: str = ""
    redis_url: str = "redis://localhost:6379/0"
    channel_config_secret: str = ""
    meta_webhook_verify_token: str = ""

    allow_anon_dev: bool = False

    @field_validator("debug", mode="before")
    @classmethod
    def parse_debug(cls, value: object) -> object:
        if isinstance(value, str) and value.lower() in {"release", "prod", "production"}:
            return False
        return value


settings = Settings()
