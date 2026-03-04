from pydantic import BaseModel
import os


class Settings(BaseModel):
    postgres_db: str = os.getenv("POSTGRES_DB", "vismuth")
    postgres_user: str = os.getenv("POSTGRES_USER", "vismuth")
    postgres_password: str = os.getenv("POSTGRES_PASSWORD", "vismuth_password")
    postgres_host: str = os.getenv("POSTGRES_HOST", "db")
    postgres_port: int = int(os.getenv("POSTGRES_PORT", "5432"))

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

