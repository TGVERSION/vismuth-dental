"""Общий конфиг приложения.

Композиция, а не наследование: каждый под-конфиг читает свои env-переменные
и не может случайно получить поля соседа.
"""

from pydantic import Field

from .base_config import BaseConfig
from .chroma_config import ClinrecChromaConfig, MKBChromaConfig
from .dms_config import DmsConfig
from .gigachat_config import GigaChatConfig
from .log_config import LogSettings


class AppConfig(BaseConfig):
    # default_factory, а не готовый инстанс: иначе одна модель на всех
    gigachat: GigaChatConfig = Field(default_factory=GigaChatConfig, description="Настройки GigaChat")
    mkb_chroma: MKBChromaConfig = Field(default_factory=MKBChromaConfig, description="Векторное хранилище МКБ")
    clinrec_chroma: ClinrecChromaConfig = Field(
        default_factory=ClinrecChromaConfig,
        description="Векторное хранилище клинреков",
    )
    dms: DmsConfig = Field(
        default_factory=DmsConfig,
        description="Проверка назначений ДМС по клиническим рекомендациям",
    )
    log: LogSettings = Field(default_factory=LogSettings, description="Настройки логирования")


settings = AppConfig()
