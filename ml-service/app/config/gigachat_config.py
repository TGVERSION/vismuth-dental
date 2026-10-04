"""Настройки GigaChat.

env-переменные: GIGACHAT_*
Поля названы «модуль_параметр», чтобы имя не начиналось с model_:
pydantic ругается на такие имена (protected namespace).
"""

from pydantic import Field, SecretStr
from pydantic_settings import SettingsConfigDict

from .base_config import BaseConfig


class GigaChatConfig(BaseConfig):
    # validate_by_name=False: у token есть validation_alias, и по умолчанию
    # поле принималось бы ещё и по префиксному имени GIGACHAT_TOKEN.
    # Токен читается только из GIGA_TOKEN — как и написано в описании поля.
    model_config = SettingsConfigDict(
        extra="ignore",
        env_prefix="GIGACHAT_",
        validate_by_name=False,
    )

    # обязательное поле: без токена сервис не стартует (fail fast).
    # SecretStr — чтобы токен не утёк в логи и repr().
    # env_prefix здесь не применяется: у поля есть алиас.
    token: SecretStr = Field(
        validation_alias="GIGA_TOKEN",
        description="Токен авторизации GigaChat (env GIGA_TOKEN)",
    )

    # ultra-модели живут на отдельном endpoint и требуют явный scope
    ultra_base_url: str = Field(
        default="https://api.giga.chat/v1",
        description="Endpoint для ultra-моделей",
    )
    ultra_scope: str = Field(
        default="GIGACHAT_API_PERS",
        description="Scope авторизации для ultra-моделей",
    )

    # поиск кода МКБ
    mkb_model: str = Field(default="GigaChat-2", description="Модель для поиска кода МКБ")
    mkb_temperature: float = Field(default=0.1, description="Температура для поиска кода МКБ")
    mkb_max_tokens: int = Field(default=100, description="Лимит токенов ответа для поиска кода МКБ")

    # проверка полноты протокола
    fullness_model: str = Field(default="GigaChat-2-Pro", description="Модель для проверки полноты")
    fullness_temperature: float = Field(default=0.1, description="Температура для проверки полноты")
    fullness_max_tokens: int = Field(default=1000, description="Лимит токенов ответа для проверки полноты")

    # проверка клинических рекомендаций
    clinrec_model: str = Field(default="GigaChat-2-Pro", description="Модель для проверки клинреков")
    clinrec_temperature: float = Field(default=0.1, description="Температура для проверки клинреков")
    clinrec_max_tokens: int = Field(default=2000, description="Лимит токенов ответа для проверки клинреков")

    # сбор формы
    collect_form_model: str = Field(default="GigaChat-3-Ultra", description="Модель для сбора формы")
    collect_form_temperature: float = Field(default=0.3, description="Температура для сбора формы")
    collect_form_max_tokens: int = Field(default=1500, description="Лимит токенов ответа для сбора формы")
    # бюджет вопросов: исчерпан — сервис отдаёт stopped, а не спрашивает бесконечно
    collect_form_max_questions: int = Field(
        default=5,
        ge=1,
        le=20,
        description="Лимит вопросов ассистента за диалог сбора формы",
    )

    # суммаризация формы
    summarize_form_model: str = Field(default="GigaChat-3-Ultra", description="Модель для суммаризации формы")
    summarize_form_temperature: float = Field(default=0.1, description="Температура для суммаризации формы")
    summarize_form_max_tokens: int = Field(default=1200, description="Лимит токенов ответа для суммаризации формы")
