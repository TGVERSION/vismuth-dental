"""Вердикт по назначениям на основе фрагментов клинрека.

Модель возвращает номера позиций, а не смещения в тексте: считать
символы она не умеет, а выбор из нумерованного списка — умеет.
"""

import logging

from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field

from app.services.prompts.check_dms import (
    CHECK_DMS_HUMAN_PROMPT_TEMPLATE,
    CHECK_DMS_SYSTEM_PROMPT,
)

from .errors import DmsError

logger = logging.getLogger(__name__)

_MAX_FRAGMENT_CHARS = 1500


class VerdictItem(BaseModel):
    """Позиция, которую модель считает лишней."""

    index: int = Field(ge=1, description="Номер позиции в списке, начиная с 1")
    text: str = Field(description="Формулировка позиции без изменений")
    reason: str | None = Field(default=None, description="Почему позиция лишняя")


class VerdictResult(BaseModel):
    """Ответ модели: только лишние позиции."""

    unnecessary: list[VerdictItem] = Field(
        default_factory=list,
        description="Позиции, не подтверждённые клиническими рекомендациями",
    )


def _numbered(items: list[str]) -> str:
    return "\n".join(f"{index}. {item}" for index, item in enumerate(items, start=1))


def _fragments_text(fragments: list[dict]) -> str:
    if not fragments:
        return "(фрагменты не найдены)"
    parts = []
    for number, fragment in enumerate(fragments, start=1):
        section = fragment.get("section") or "без раздела"
        text = str(fragment.get("text") or "")[:_MAX_FRAGMENT_CHARS]
        parts.append(f"[{number}] {section}: {text}")
    return "\n\n".join(parts)


def build_human_prompt(mkb: str, items: list[str], fragments: list[dict]) -> str:
    """Собирает запрос: диагноз, нумерованные назначения и фрагменты."""
    return CHECK_DMS_HUMAN_PROMPT_TEMPLATE.format(
        mkb=mkb,
        appointments=_numbered(items),
        fragments=_fragments_text(fragments),
    )


def _ask_model(human_prompt: str) -> VerdictResult:
    """Структурированный вызов ultra-модели с одним повтором."""
    from app.llm_services.llm_setup import llm_dms

    structured = llm_dms.with_structured_output(VerdictResult)
    messages = [
        SystemMessage(content=CHECK_DMS_SYSTEM_PROMPT),
        HumanMessage(content=human_prompt),
    ]
    last_error: Exception | None = None
    for attempt in range(2):
        try:
            return structured.invoke(messages)
        except Exception as exc:  # noqa: BLE001 — сеть, таймаут и невалидный JSON лечатся одинаково
            last_error = exc
            logger.warning("dms verdict attempt failed attempt=%s", attempt + 1)
    raise DmsError("llm_invalid_response", "Модель не вернула структурированный ответ", 502) from last_error


def _normalize(text: str) -> str:
    return " ".join(text.casefold().split())


def judge(mkb: str, items: list[str], fragments: list[dict]) -> set[int]:
    """Возвращает индексы (с 0) позиций, которые модель признала лишними."""
    if not items:
        return set()

    human_prompt = build_human_prompt(mkb, items, fragments)
    result = _ask_model(human_prompt)

    unnecessary: set[int] = set()
    for verdict in result.unnecessary:
        position = verdict.index - 1
        if not 0 <= position < len(items):
            logger.warning("dms verdict index out of range index=%s items=%s", verdict.index, len(items))
            continue
        if _normalize(verdict.text) != _normalize(items[position]):
            logger.warning("dms verdict text mismatch index=%s", verdict.index)
        unnecessary.add(position)

    logger.info("dms verdict unnecessary=%s items=%s", len(unnecessary), len(items))
    return unnecessary
