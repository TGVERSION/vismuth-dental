"""Фабрика LLM-клиентов GigaChat.

Клиенты создаются лениво и кешируются: у каждой роли свои модель, температура
и лимит токенов, а способ сборки клиента — один на всех.
"""

import logging
from enum import StrEnum

from langchain_gigachat.chat_models.gigachat import GigaChat

from app.config import GigaChatConfig

logger = logging.getLogger(__name__)


class LLMRole(StrEnum):
    """Роль клиента — по ней фабрика выбирает параметры из конфига."""

    MKB = "mkb"
    FULLNESS = "fullness"
    CLINREC = "clinrec"
    COLLECT_FORM = "collect_form"
    SUMMARIZE_FORM = "summarize_form"


class LLMFactory:
    """Создаёт клиентов GigaChat по настройкам и переиспользует их."""

    def __init__(self, config: GigaChatConfig) -> None:
        self._config = config
        self._chats: dict[LLMRole, GigaChat] = {}

    def get_chat(self, role: LLMRole) -> GigaChat:
        """Возвращает клиент для роли; создаёт его при первом обращении."""
        chat = self._chats.get(role)
        if chat is None:
            chat = self._create_chat(role)
            self._chats[role] = chat
            logger.info("gigachat client created role=%s model=%s", role, chat.model)
        return chat

    def _create_chat(self, role: LLMRole) -> GigaChat:
        config = self._config
        match role:
            case LLMRole.MKB:
                return self._build(
                    model=config.mkb_model,
                    temperature=config.mkb_temperature,
                    max_tokens=config.mkb_max_tokens,
                )
            case LLMRole.FULLNESS:
                return self._build(
                    model=config.fullness_model,
                    temperature=config.fullness_temperature,
                    max_tokens=config.fullness_max_tokens,
                )
            case LLMRole.CLINREC:
                return self._build(
                    model=config.clinrec_model,
                    temperature=config.clinrec_temperature,
                    max_tokens=config.clinrec_max_tokens,
                )
            # ultra-модели доступны только на отдельном endpoint и скоупе
            case LLMRole.COLLECT_FORM:
                return self._build(
                    model=config.collect_form_model,
                    temperature=config.collect_form_temperature,
                    max_tokens=config.collect_form_max_tokens,
                    base_url=config.ultra_base_url,
                    scope=config.ultra_scope,
                )
            case LLMRole.SUMMARIZE_FORM:
                return self._build(
                    model=config.summarize_form_model,
                    temperature=config.summarize_form_temperature,
                    max_tokens=config.summarize_form_max_tokens,
                    base_url=config.ultra_base_url,
                    scope=config.ultra_scope,
                )
        # match исчерпывает все роли: сюда попасть нельзя, но молча глотать нельзя тоже
        raise ValueError(f"unknown llm role: {role}")

    def _build(
        self,
        model: str,
        temperature: float,
        max_tokens: int,
        base_url: str | None = None,
        scope: str | None = None,
    ) -> GigaChat:
        return GigaChat(
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
            credentials=self._config.token.get_secret_value(),
            base_url=base_url,
            scope=scope,
            verify_ssl_certs=False,
        )
