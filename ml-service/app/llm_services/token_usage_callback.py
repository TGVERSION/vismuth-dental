"""Колбэк для лога токенов GigaChat.

Структурированный вывод (`with_structured_output`) возвращает только
распарсенную модель: `AIMessage` с `usage_metadata` до вызывающего кода
не доходит. Колбэк висит на уровне LLM и видит `LLMResult` целиком,
поэтому расход токенов логируется независимо от способа вызова.
"""

import logging
import time
from typing import Any
from uuid import UUID

from langchain_core.callbacks import BaseCallbackHandler
from langchain_core.outputs import LLMResult

logger = logging.getLogger(__name__)

# сколько запросов держим для замера длительности; страховка от утечки,
# если on_llm_end по какой-то причине не придёт
_MAX_PENDING_RUNS = 100


def _extract_usage(response: LLMResult) -> dict[str, int] | None:
    """Достаёт расход токенов из ответа: сначала usage_metadata, затем llm_output."""
    for generation_list in response.generations:
        for generation in generation_list:
            message = getattr(generation, "message", None)
            usage = getattr(message, "usage_metadata", None)
            if usage:
                return {
                    "input_tokens": usage.get("input_tokens", 0),
                    "output_tokens": usage.get("output_tokens", 0),
                    "total_tokens": usage.get("total_tokens", 0),
                    "cache_read_tokens": (usage.get("input_token_details") or {}).get(
                        "cache_read", 0
                    ),
                }

    # streaming без usage_metadata оставляет счётчики только здесь
    token_usage = (response.llm_output or {}).get("token_usage")
    if not token_usage:
        return None
    return {
        "input_tokens": token_usage.get("prompt_tokens") or 0,
        "output_tokens": token_usage.get("completion_tokens") or 0,
        "total_tokens": token_usage.get("total_tokens") or 0,
        "cache_read_tokens": token_usage.get("precached_prompt_tokens") or 0,
    }


class TokenUsageCallbackHandler(BaseCallbackHandler):
    """Логирует токены и длительность каждого вызова GigaChat.

    Имя обработчика задаётся при создании: клиенты GigaChat не сохраняют
    `run_name` из конструктора, поэтому роль протаскиваем через колбэк.
    Один экземпляр можно вешать на несколько клиентов: состояние замера
    разложено по run_id, поэтому параллельные запросы не мешают друг другу.
    """

    def __init__(self, name: str = "gigachat") -> None:
        self._name = name
        self._started_at: dict[UUID, float] = {}

    def on_chat_model_start(
        self,
        serialized: dict[str, Any],
        messages: list[list[Any]],
        *,
        run_id: UUID,
        **kwargs: Any,
    ) -> None:
        if len(self._started_at) >= _MAX_PENDING_RUNS:
            self._started_at.clear()
        self._started_at[run_id] = time.perf_counter()

    def on_llm_end(self, response: LLMResult, *, run_id: UUID, **kwargs: Any) -> None:
        started_at = self._started_at.pop(run_id, None)
        usage = _extract_usage(response)
        if usage is None:
            # молчать нельзя: без токенов лог теряет смысл
            logger.warning("gigachat usage missing name=%s run_id=%s", self._name, run_id)
            return
        duration_ms = (time.perf_counter() - started_at) * 1000 if started_at else 0.0
        logger.info(
            "gigachat tokens name=%s input=%d output=%d total=%d cache_read=%d ms=%.0f",
            self._name,
            usage["input_tokens"],
            usage["output_tokens"],
            usage["total_tokens"],
            usage["cache_read_tokens"],
            duration_ms,
        )

    def on_llm_error(self, error: BaseException, *, run_id: UUID, **kwargs: Any) -> None:
        # незакрытый замер не должен копиться в памяти
        self._started_at.pop(run_id, None)
