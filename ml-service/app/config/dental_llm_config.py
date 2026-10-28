"""Модель для уточняющих вопросов стоматологической анкеты.

Любой сервер с OpenAI-совместимым API (sglang, vLLM и т. п.).
env-переменные: DENTAL_LLM_*. Без DENTAL_LLM_BASE_URL эндпоинт отвечает 503,
а backend просто не задаёт уточнений — анкета работает и без них.
"""

from typing import Literal

from pydantic import Field, SecretStr
from pydantic_settings import SettingsConfigDict

from .base_config import BaseConfig


class DentalLLMConfig(BaseConfig):
    model_config = SettingsConfigDict(extra="ignore", env_prefix="DENTAL_LLM_")

    base_url: str | None = Field(default=None, description="Адрес API, например http://host:8888/v1")
    model: str = Field(default="", description="Имя модели на сервере")
    api_key: SecretStr = Field(default=SecretStr("-"), description="Ключ API; локальному серверу подойдёт любой")
    temperature: float = Field(default=0.2, description="Температура")
    max_tokens: int = Field(default=400, description="Лимит токенов ответа")
    timeout: float = Field(default=15.0, description="Таймаут запроса к модели, с")
    max_questions: int = Field(default=2, ge=1, le=5, description="Сколько уточнений на анкету")
    structured_method: Literal["json_schema", "function_calling", "json_mode"] = Field(
        default="json_schema",
        description="Как получать структурированный ответ — зависит от сервера",
    )
    disable_thinking: bool = Field(
        default=True,
        description="Отключить «размышления» Qwen3 (chat_template_kwargs): иначе ответ долгий",
    )
