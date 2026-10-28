"""Уточняющий вопрос стоматологической анкеты.

Модель решает, спрашивать ли, и формулирует вопрос; всё остальное — правила:
лимит вопросов, без повторов, только настоящий вопрос, короткие варианты.
Сервис без состояния: историю уточнений присылает backend.
"""

import logging

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.runnables import Runnable

from app.schemas.dental_clarify import (
    DentalClarifyAnswer,
    DentalClarifyRequest,
    DentalDecision,
)

from .prompts.dental_clarify import DENTAL_CLARIFY_HUMAN_TEMPLATE, DENTAL_CLARIFY_SYSTEM_PROMPT

logger = logging.getLogger(__name__)

MAX_QUESTION_LEN = 200
MAX_CHOICE_LEN = 60
MAX_CHOICES = 5
# Свой текст и «пропустить» у пациента есть всегда — такие варианты лишние.
_SERVICE_CHOICES = {"другое", "пропустить", "не знаю"}

_DONE = DentalClarifyAnswer(status="done")


def _normalize(text: str) -> str:
    return " ".join(text.lower().replace("ё", "е").split()).rstrip("?").strip()


def _clean_choices(choices: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for raw in choices:
        choice = raw.strip()
        key = _normalize(choice)
        if not choice or len(choice) > MAX_CHOICE_LEN or key in _SERVICE_CHOICES or key in seen:
            continue
        seen.add(key)
        result.append(choice)
    return result[:MAX_CHOICES]


class DentalClarifyService:
    """Решает, нужен ли уточняющий вопрос, и проверяет то, что предложила модель."""

    def __init__(self, decider: Runnable, max_questions: int) -> None:
        # decider — модель со структурированным выводом DentalDecision
        self._decider = decider
        self._max_questions = max_questions

    async def run(self, request: DentalClarifyRequest) -> DentalClarifyAnswer:
        if len(request.history) >= self._max_questions:
            return _DONE

        decision = await self._decider.ainvoke(self._messages(request))
        if not isinstance(decision, DentalDecision):
            raise TypeError(f"unexpected decision: {type(decision).__name__}")
        if not decision.need_question:
            return _DONE

        question = decision.question.strip()
        asked = {_normalize(turn.question) for turn in request.history}
        if not question or "?" not in question or len(question) > MAX_QUESTION_LEN:
            logger.info("dental clarify rejected question len=%s", len(question))
            return _DONE
        if _normalize(question) in asked:
            logger.info("dental clarify repeated question rejected")
            return _DONE

        return DentalClarifyAnswer(
            status="question",
            question=question,
            choices=_clean_choices(decision.choices),
        )

    @staticmethod
    def _messages(request: DentalClarifyRequest) -> list:
        history = "\n".join(
            f"- {turn.question} — {turn.answer or 'пациент пропустил'}"
            for turn in request.history
        ) or "нет"
        human = DENTAL_CLARIFY_HUMAN_TEMPLATE.format(answers=request.answers, history=history)
        return [SystemMessage(content=DENTAL_CLARIFY_SYSTEM_PROMPT), HumanMessage(content=human)]
