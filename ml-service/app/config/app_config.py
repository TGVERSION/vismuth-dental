"""Общий конфиг приложения.

Композиция, а не наследование: каждый под-конфиг читает свои env-переменные
и не может случайно получить поля соседа.
"""

from pydantic import Field

from .base_config import BaseConfig
from .chroma_config import ClinrecChromaConfig, MKBChromaConfig
from .dental_llm_config import DentalLLMConfig
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
    dental_llm: DentalLLMConfig = Field(
        default_factory=DentalLLMConfig,
        description="Модель уточнений стоматологической анкеты",
    )
    log: LogSettings = Field(default_factory=LogSettings, description="Настройки логирования")


settings = AppConfig()
