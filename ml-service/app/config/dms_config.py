"""Настройки проверки назначений ДМС по клиническим рекомендациям.

env-переменные: DMS_*
"""

from pydantic import Field
from pydantic_settings import SettingsConfigDict

from .base_config import BaseConfig


class DmsConfig(BaseConfig):
    model_config = SettingsConfigDict(extra="ignore", env_prefix="DMS_")

    qdrant_path: str = Field(
        default="./storage/qdrant",
        description="Каталог локальной БД Qdrant",
    )
    pdf_dir: str = Field(
        default="./storage/pdfs",
        description="Каталог скачанных PDF клинреков",
    )
    collection: str = Field(
        default="clinrec_dms",
        description="Имя коллекции фрагментов клинреков в Qdrant",
    )
    max_pdf_bytes: int = Field(
        default=50 * 1024 * 1024,
        ge=1024,
        description="Максимальный размер PDF, байт",
    )
    download_timeout: float = Field(
        default=30.0,
        gt=0,
        description="Таймаут скачивания PDF, секунд",
    )
    chunk_size: int = Field(
        default=1000,
        ge=200,
        description="Целевой размер чанка в символах",
    )
    chunk_overlap: int = Field(
        default=120,
        ge=0,
        description="Перекрытие соседних чанков, символов",
    )
    retrieval_top_k: int = Field(
        default=4,
        ge=1,
        description="Сколько фрагментов искать на одно назначение",
    )
    retrieval_max_chunks: int = Field(
        default=20,
        ge=1,
        description="Лимит фрагментов в промпте",
    )
    max_fragments: int = Field(
        default=8,
        ge=1,
        description="Лимит фрагментов в ответе",
    )
