"""Сбор трёх полей формы по истории чата.

Состояние сбора хранит вызывающая сторона: сервис получает его в запросе
и возвращает обновлённым, поэтому сам остаётся без состояния.
"""

import json
import logging
import re

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_core.runnables import Runnable
from langchain_gigachat.chat_models.gigachat import GigaChat

from app.schemas import (
    AssistantMessage,
    ChatRole,
    CollectFormAnswer,
    CollectFormRequest,
    CollectionTarget,
    CollectStatus,
    FieldStatus,
    FormField,
    FormProgress,
)

from .prompts import EXTRACT_SYSTEM_PROMPT, QUESTION_PROMPT

logger = logging.getLogger(__name__)

# Сколько последних сообщений отдаём в модель: защита от мусорной истории.
_HISTORY_LIMIT = 40

_PAIN_QUESTIONS = (
    ("has_localization", "Где именно болит?"),
    ("has_character", "Как вы ощущаете боль? Например, она ноющая, режущая или схваткообразная?"),
    ("has_onset", "Когда началась боль?"),
)
_PAIN_CHARACTER = re.compile(
    r"\b(?:остр|режущ|ноющ|колющ|тянущ|жгуч|туп|схваткообразн)\w*\s+бол[ьиью]\b",
    re.IGNORECASE,
)
_PAIN_DESCRIPTION_WITHOUT_ONSET = re.compile(
    rf"(?:у меня )?{_PAIN_CHARACTER.pattern}(?: в животе)?[.!]?",
    re.IGNORECASE,
)
_SHORT_PAIN_LOCATION = re.compile(
    r"(?:в\s?низу|в\s?верху|справа|слева|по центру)(?: живота)?[.!]?",
    re.IGNORECASE,
)


def _recognize_explicit_pain_details(progress: FormProgress, request: CollectFormRequest) -> None:
    """Учитывает явные ответы пациента, пропущенные при извлечении."""
    complaint = progress.complaints
    if complaint.status != FieldStatus.FILLED or complaint.symptom_type != "pain":
        return

    previous_question = ""
    description_only = True
    has_description = False
    for index, message in enumerate(request.messages[-_HISTORY_LIMIT:]):
        if message.role == ChatRole.ASSISTANT:
            previous_question = message.text.casefold()
            continue
        text = message.text.strip()
        if index == 0 and text.startswith("Контекст: специализация — "):
            continue
        if _PAIN_CHARACTER.search(text):
            complaint.has_character = True
        location_reply = (
            "бол" in previous_question
            and ("где именно" in previous_question or "локализуется боль" in previous_question)
            and _SHORT_PAIN_LOCATION.fullmatch(text)
        )
        if location_reply:
            complaint.has_localization = True
        else:
            is_description = bool(_PAIN_DESCRIPTION_WITHOUT_ONSET.fullmatch(text))
            has_description |= is_description
            description_only &= is_description
        previous_question = ""
    if has_description and description_only:
        complaint.has_onset = False


# Первый вопрос по полю: формулировка фиксирована, LLM не зовём.
_FIRST_QUESTIONS: dict[CollectionTarget, str] = {
    CollectionTarget.COMPLAINTS: (
        "Что вас беспокоит? Опишите, пожалуйста, симптомы и как давно они появились."
    ),
    CollectionTarget.MEDICATIONS: (
        "Какие лекарства принимаете сейчас? Если да — назовите, пожалуйста, "
        "названия и дозы."
    ),
    CollectionTarget.ALLERGY_ANAMNESIS: (
        "Есть ли аллергия на лекарства или продукты? Если да — на что "
        "и какая реакция."
    ),
}

# Переформулировка, если первый вопрос уже звучал, а поле так и не закрыто.
_REPEAT_QUESTIONS: dict[CollectionTarget, str] = {
    CollectionTarget.COMPLAINTS: (
        "Давайте вернёмся к жалобам. Какие симптомы вы замечаете и как давно?"
    ),
    CollectionTarget.MEDICATIONS: (
        "Уточните, пожалуйста: какие лекарства вы принимаете сейчас "
        "и в каких дозах?"
    ),
    CollectionTarget.ALLERGY_ANAMNESIS: (
        "Уточните, пожалуйста: была ли аллергия или непереносимость "
        "лекарств, продуктов?"
    ),
}

# Цель уточняющего вопроса и поле, из которого берётся уже известное.
_FOLLOWUPS: dict[CollectionTarget, tuple[str, FormField]] = {
    CollectionTarget.COMPLAINTS_DETAIL: (
        "уточнить недостающие сведения об основной жалобе пациента",
        FormField.COMPLAINTS,
    ),
    CollectionTarget.MEDICATIONS_DOSE: (
        "дозировка принимаемых препаратов в мг/мкг/г либо хотя бы количество таблеток или капсул за один приём; не вычислять мг из количества таблеток",
        FormField.MEDICATIONS,
    ),
}


def _next_target(progress: FormProgress) -> CollectionTarget | None:
    """Выбирает, что спросить дальше. None — все поля закрыты."""
    complaints = progress.complaints
    if complaints.status == FieldStatus.EMPTY:
        return CollectionTarget.COMPLAINTS
    if complaints.status == FieldStatus.FILLED and not complaints.detailed:
        return CollectionTarget.COMPLAINTS_DETAIL

    medications = progress.medications
    if medications.status == FieldStatus.EMPTY:
        return CollectionTarget.MEDICATIONS
    if medications.status == FieldStatus.FILLED and not medications.has_dose:
        return CollectionTarget.MEDICATIONS_DOSE

    if progress.allergy_anamnesis.status == FieldStatus.EMPTY:
        return CollectionTarget.ALLERGY_ANAMNESIS
    return None


def _merge(known: FormProgress | None, fresh: FormProgress) -> FormProgress:
    """Не даёт заполненному полю молча откатиться в empty.

    Откат в denied разрешён: пациент мог сказать «я ошибся, аллергий нет».
    """
    if known is None:
        return fresh
    for field in FormField:
        previous = getattr(known, field.value)
        current = getattr(fresh, field.value)
        if previous.status == FieldStatus.FILLED and current.status == FieldStatus.EMPTY:
            logger.info("collect form rollback prevented field=%s", field.value)
            setattr(fresh, field.value, previous)
    return fresh


class CollectFormService:
    """Ведёт сбор трёх полей формы: состояние, следующий вопрос, завершённость."""

    def __init__(self, llm: GigaChat, max_questions: int) -> None:
        self._llm = llm
        self._max_questions = max_questions
        self._extractor: Runnable = llm.with_structured_output(FormProgress)

    async def run(self, request: CollectFormRequest) -> CollectFormAnswer:
        progress = _merge(request.state, await self._extract(request))
        _recognize_explicit_pain_details(progress, request)
        target = _next_target(progress)

        if target is None:
            return CollectFormAnswer(status=CollectStatus.COMPLETE, state=progress)

        if self._questions_asked(request) >= self._max_questions:
            logger.info(
                "collect form budget exhausted missing=%s",
                [field.value for field in progress.missing()],
            )
            return CollectFormAnswer(
                status=CollectStatus.STOPPED,
                missing_fields=progress.missing(),
                state=progress,
            )

        return CollectFormAnswer(
            status=CollectStatus.QUESTION,
            messages=AssistantMessage(
                text=await self._question(target, progress, request),
            ),
            next_field=target,
            missing_fields=progress.missing(),
            state=progress,
        )

    async def _extract(self, request: CollectFormRequest) -> FormProgress:
        """Просит модель проверить состояние полей по всей истории чата."""
        messages: list = [SystemMessage(content=EXTRACT_SYSTEM_PROMPT)]
        if request.state is not None:
            messages.append(HumanMessage(content=json.dumps(
                {"untrusted_state": request.state.model_dump(mode="json")}, ensure_ascii=False,
            )))
        messages.extend(self._build_messages(request))
        try:
            progress = await self._extractor.ainvoke(messages)
        except Exception:
            logger.exception("collect form extraction failed")
            raise
        if not isinstance(progress, FormProgress):
            raise TypeError(f"unexpected extraction result: {type(progress).__name__}")
        return progress

    async def _question(
        self,
        target: CollectionTarget,
        progress: FormProgress,
        request: CollectFormRequest,
    ) -> str:
        """Текст вопроса: шаблон для первого, LLM для уточняющего."""
        followup = _FOLLOWUPS.get(target)
        if followup is None:
            return self._template(target, request)

        goal, source = followup
        if target == CollectionTarget.COMPLAINTS_DETAIL:
            complaint = progress.complaints
            if complaint.symptom_type == "pain":
                return next(text for flag, text in _PAIN_QUESTIONS if not getattr(complaint, flag))
            relevant = {
                "heartburn": [("has_onset", "когда началась изжога"), ("has_frequency", "как часто бывает изжога"), ("has_triggers", "связь изжоги с едой или положением тела")],
                "stool": [("has_onset", "когда начались нарушения стула"), ("has_frequency", "как часто бывает стул"), ("has_stool_description", "вид и консистенция стула")],
                "other": [("has_onset", "когда появился симптом"), ("has_character", "как проявляется симптом")],
            }[complaint.symptom_type]
            missing = [label for flag, label in relevant if not getattr(complaint, flag)]
            goal = "детали жалоб; уточни один недостающий факт: " + "; ".join(missing)
            goal += ". Не спрашивай локализацию или характер боли, если пациент не сообщает о боли"
        known = getattr(progress, source.value).value
        system = QUESTION_PROMPT.format(goal=goal)
        history = self._build_messages(request)
        response = await self._llm.ainvoke([
            SystemMessage(content=system),
            HumanMessage(content=json.dumps({"untrusted_known": known}, ensure_ascii=False)),
            *history,
        ])
        return str(response.content).strip()

    def _template(self, target: CollectionTarget, request: CollectFormRequest) -> str:
        """Шаблон первого вопроса; если он уже звучал — переформулировка."""
        text = _FIRST_QUESTIONS[target]
        asked = any(
            message.role == ChatRole.ASSISTANT and message.text == text
            for message in request.messages
        )
        return _REPEAT_QUESTIONS[target] if asked else text

    @staticmethod
    def _questions_asked(request: CollectFormRequest) -> int:
        """Число заданных вопросов: каждое сообщение ассистента — это вопрос."""
        return sum(
            1 for message in request.messages if message.role == ChatRole.ASSISTANT
        )

    @staticmethod
    def _build_messages(request: CollectFormRequest) -> list:
        messages: list = []
        for message in request.messages[-_HISTORY_LIMIT:]:
            if message.role == ChatRole.USER:
                messages.append(HumanMessage(content=message.text))
            else:
                messages.append(AIMessage(content=message.text))
        return messages
