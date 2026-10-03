"""Настройки векторных хранилищ.

Два независимых хранилища — два класса. Общий класс с одним env_prefix
нельзя: модель эмбеддингов и коллекция у МКБ и клинреков разные,
а раньше они читались из одной переменной окружения.

env-переменные: MKB_CHROMA_*, CLINREC_CHROMA_*
"""

from pydantic import Field
from pydantic_settings import SettingsConfigDict

from .base_config import BaseConfig


class MKBChromaConfig(BaseConfig):
    model_config = SettingsConfigDict(extra="ignore", env_prefix="MKB_CHROMA_")

    embedding_model: str = Field(
        default="./ru-en-RoSBERTa",
        description="Путь или имя SentenceTransformer-модели для эмбеддингов МКБ",
    )
    db_path: str = Field(default="./rosberta_chromadb", description="Каталог постоянного хранилища ChromaDB для МКБ")
    collection: str = Field(default="mkb_codes", description="Имя коллекции МКБ в ChromaDB")


class ClinrecChromaConfig(BaseConfig):
    model_config = SettingsConfigDict(extra="ignore", env_prefix="CLINREC_CHROMA_")

    embedding_model: str = Field(
        default="./Qwen3-Embedding-0.6B",
        description="Путь или имя SentenceTransformer-модели для эмбеддингов клинреков",
    )
    db_path: str = Field(
        default="./chroma_qwen_md_3",
        description="Каталог постоянного хранилища ChromaDB для клинреков",
    )
    collection: str = Field(default="clinic_recommendations", description="Имя коллекции клинреков в ChromaDB")
