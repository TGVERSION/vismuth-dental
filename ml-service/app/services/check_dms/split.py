"""Разбиение строки назначений на отдельные позиции.

Разбиение нужно только для поиска: по каждой позиции ищется свой
фрагмент клинрека. Поэтому сбой модели не роняет запрос — есть
фолбэк по разделителям.
"""

import logging
import re

from pydantic import BaseModel, Field

from app.services.prompts.check_dms import CHECK_DMS_SPLIT_PROMPT

from .errors import DmsError

logger = logging.getLogger(__name__)

_DELIMITERS = re.compile(r"[;\n•·]+")
_EDGE_CHARS = " \t.,;"


class SplitResult(BaseModel):
    """Позиции назначений, выделенные моделью."""

    items: list[str] = Field(description="Назначения по отдельности, в исходном порядке")


def fallback_split(text: str) -> list[str]:
    """Делит по явным разделителям; без них возвращает строку целиком."""
    parts = [part.strip(_EDGE_CHARS) for part in _DELIMITERS.split(text)]
    items = [part for part in parts if part]
    return items or [text.strip()]


def split_appointments(text: str) -> list[str]:
    """Возвращает позиции назначений, стараясь сохранить исходные формулировки."""
    try:
        result = _ask_model(text)
        items = [item.strip(_EDGE_CHARS) for item in result.items if item.strip()]
        if items:
            logger.info("dms appointments split by model items=%s", len(items))
            return items
    except Exception:
        logger.warning("dms split failed, falling back to delimiters", exc_info=True)

    items = fallback_split(text)
    logger.info("dms appointments split by delimiters items=%s", len(items))
    return items


def _ask_model(text: str) -> SplitResult:
    """Структурированный вызов модели; вынесен для тестов.

    Импорт внутри: `llm_setup` грузит модели, а тесты этого не требуют.
    """
    from app.llm_services.llm_setup import llm_dms_split

    structured = llm_dms_split.with_structured_output(SplitResult)
    try:
        return structured.invoke(CHECK_DMS_SPLIT_PROMPT.format(appointments=text))
    except Exception as exc:
        raise DmsError("llm_unavailable", "Модель разбиения назначений недоступна", 502) from exc
