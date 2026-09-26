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

    frontend_public_url: str = os.getenv(
        "FRONTEND_PUBLIC_URL",
        "http://localhost:3000",
    )
    invite_expire_days: int = int(os.getenv("INVITE_EXPIRE_DAYS", "7"))

    default_user_role: str = os.getenv("DEFAULT_USER_ROLE", "doctor")
    ml_service_url: str = os.getenv("ML_SERVICE_URL", "http://ml-service:8000")

    redis_host: str = os.getenv("REDIS_HOST", "redis")
    redis_port: int = int(os.getenv("REDIS_PORT", "6379"))
    redis_db: int = int(os.getenv("REDIS_DB", "0"))
    redis_url: str = os.getenv("REDIS_URL", "redis://redis:6379/0")
    redis_stream_key: str = os.getenv("REDIS_STREAM_KEY", "ml_mkb_code:events")
    redis_consumer_group: str = os.getenv("REDIS_CONSUMER_GROUP", "ml_mkb_code_group")
    redis_consumer_name: str = os.getenv("REDIS_CONSUMER_NAME", "backend-worker-1")

    questionnaire_ai_timeout: float = float(
        os.getenv("QUESTIONNAIRE_AI_TIMEOUT", "20"),
    )
    questionnaire_answer_max_len: int = int(
        os.getenv("QUESTIONNAIRE_ANSWER_MAX_LEN", "1000"),
    )
    questionnaire_ai_primary_max: int = int(
        os.getenv("QUESTIONNAIRE_AI_PRIMARY_MAX", "6"),
    )
    questionnaire_ai_repeat_max: int = int(
        os.getenv("QUESTIONNAIRE_AI_REPEAT_MAX", "2"),
    )
    questionnaire_device_limit_per_hour: int = int(
        os.getenv("QUESTIONNAIRE_DEVICE_LIMIT_PER_HOUR", "5"),
    )
    questionnaire_ip_limit_per_hour: int = int(
        os.getenv("QUESTIONNAIRE_IP_LIMIT_PER_HOUR", "30"),
    )
    questionnaire_clinic_daily_per_doctor: int = int(
        os.getenv("QUESTIONNAIRE_CLINIC_DAILY_PER_DOCTOR", "30"),
    )
    questionnaire_clinic_daily_min: int = int(
        os.getenv("QUESTIONNAIRE_CLINIC_DAILY_MIN", "100"),
    )
    questionnaire_abandon_hours: int = int(
        os.getenv("QUESTIONNAIRE_ABANDON_HOURS", "24"),
    )
    questionnaire_retention_days: int = int(
        os.getenv("QUESTIONNAIRE_RETENTION_DAYS", "45"),
    )
    questionnaire_code_window_days: int = int(
        os.getenv("QUESTIONNAIRE_CODE_WINDOW_DAYS", "30"),
    )
    questionnaire_appointment_days_ahead: int = int(
        os.getenv("QUESTIONNAIRE_APPOINTMENT_DAYS_AHEAD", "30"),
    )
    trust_proxy: bool = os.getenv("TRUST_PROXY", "false").lower() in {
        "1",
        "true",
        "yes",
    }
    questionnaire_time_slots: str = os.getenv(
        "QUESTIONNAIRE_TIME_SLOTS",
        "09:00,09:30,10:00,10:30,11:00,11:30,12:00,12:30,"
        "13:00,13:30,14:00,14:30,15:00,15:30,16:00,16:30,17:00,17:30,18:00",
    )

    @property
    def appointment_time_slots(self) -> list[str]:
        return [s.strip() for s in self.questionnaire_time_slots.split(",") if s.strip()]

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
