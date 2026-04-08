import os

from dotenv import load_dotenv
from pydantic import BaseModel

load_dotenv()


class Settings(BaseModel):
    postgres_db: str = os.getenv("POSTGRES_DB", "vismuth")
    postgres_user: str = os.getenv("POSTGRES_USER", "vismuth")
    postgres_password: str = os.getenv("POSTGRES_PASSWORD", "vismuth_password")
    postgres_host: str = os.getenv("POSTGRES_HOST", "db")
    postgres_port: int = int(os.getenv("POSTGRES_PORT", "5432"))

    jwt_secret: str = os.getenv("JWT_SECRET", "dev-only-change-me-in-production")
    jwt_algorithm: str = os.getenv("JWT_ALGORITHM", "HS256")
    access_token_expire_minutes: int = int(
        os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"),
    )

    smtp_host: str = os.getenv("SMTP_HOST", "")
    smtp_port: int = int(os.getenv("SMTP_PORT", "465"))
    smtp_user: str = os.getenv("SMTP_USER", "")
    smtp_password: str = os.getenv("SMTP_PASSWORD", "")
    smtp_from: str = os.getenv("SMTP_FROM", "")

    registration_code_expire_minutes: int = int(
        os.getenv("REGISTRATION_CODE_EXPIRE_MINUTES", "15"),
    )
    registration_code_max_attempts: int = int(
        os.getenv("REGISTRATION_CODE_MAX_ATTEMPTS", "5"),
    )

    default_user_role: str = os.getenv("DEFAULT_USER_ROLE", "doctor")
    ml_service_url: str = os.getenv("ML_SERVICE_URL", "http://ml-service:8000")

    redis_host: str = os.getenv("REDIS_HOST", "redis")
    redis_port: int = int(os.getenv("REDIS_PORT", "6379"))
    redis_db: int = int(os.getenv("REDIS_DB", "0"))
    redis_url: str = os.getenv("REDIS_URL", "redis://redis:6379/0")
    redis_stream_key: str = os.getenv("REDIS_STREAM_KEY", "ml_mkb_code:events")
    redis_consumer_group: str = os.getenv("REDIS_CONSUMER_GROUP", "ml_mkb_code_group")
    redis_consumer_name: str = os.getenv("REDIS_CONSUMER_NAME", "backend-worker-1")

    @property
    def database_url_async(self) -> str:
        return (
            f"postgresql+asyncpg://{self.postgres_user}:"
            f"{self.postgres_password}@{self.postgres_host}:"
            f"{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def database_url_sync(self) -> str:
        return (
            f"postgresql://{self.postgres_user}:"
            f"{self.postgres_password}@{self.postgres_host}:"
            f"{self.postgres_port}/{self.postgres_db}"
        )


settings = Settings()
