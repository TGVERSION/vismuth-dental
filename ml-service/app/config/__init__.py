"""Пакет конфигурации.

Наружу отдаём `settings` и `setup_logging`, чтобы сервисы писали
`from app.config import settings` и не знали про структуру пакета.
"""

from .app_config import AppConfig, settings
from .base_config import BaseConfig
from .chroma_config import ClinrecChromaConfig, MKBChromaConfig
from .dms_config import DmsConfig
from .gigachat_config import GigaChatConfig
from .log_config import LogSettings, setup_logging

__all__ = [
    "AppConfig",
    "BaseConfig",
    "ClinrecChromaConfig",
    "DmsConfig",
    "GigaChatConfig",
    "LogSettings",
    "MKBChromaConfig",
    "settings",
    "setup_logging",
]
