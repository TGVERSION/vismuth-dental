"""Базовая конфигурация.

Тут только механика: загрузка .env и общая настройка pydantic-settings.
Поля объявляются в под-конфигах: gigachat_config, chroma_config, log_config.
"""

from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict

# .env читаем один раз при импорте этого модуля.
# load_dotenv не перезаписывает уже существующие переменные окружения,
# поэтому в Docker приоритет остаётся за окружением процесса.
load_dotenv()


class BaseConfig(BaseSettings):
    # extra="ignore" обязателен: load_dotenv отдаёт весь .env целиком,
    # и каждый под-конфиг видит ключи соседей. Без этого pydantic-settings
    # падает с "Extra inputs are not permitted".
    model_config = SettingsConfigDict(extra="ignore")
