"""Уточнения нейросети в стоматологической анкете — без базы и без ML.

Нейросеть зовём не всегда, а только если в ответах есть что уточнить: свой
текст пациента или неполное описание боли. Вопрос и варианты ответа приходят
из ml-service; здесь — шаг для экрана, приём ответа и запрос к модели.
"""

from __future__ import annotations

from .flow import AiTurn, DentalAnswerError, DentalAnswers, DentalStep, has_pain
from .flow import DEFAULT_MAX_TEXT_LEN
from .summary import build_dental_summary

AI_STEP = "dental_ai"
AI_GROUP = "ai"
_PAIN_KEYS = ("pain.where", "pain.when", "pain.since")


def needs_clarification(answers: DentalAnswers) -> bool:
    """Есть ли что уточнять: свой текст пациента или неполная боль."""
    if any(answer.text for answer in answers.groups.values()):
        return True
    if has_pain(answers):
        return any(
            not answers.groups.get(key) or not answers.groups[key].selected
            for key in _PAIN_KEYS
        )
    return False


def pending_turn(answers: DentalAnswers) -> AiTurn | None:
    """Вопрос, который задан и ещё без ответа."""
    if answers.ai and not answers.ai[-1].is_closed:
        return answers.ai[-1]
    return None


def add_ai_question(answers: DentalAnswers, question: str, choices: list[str]) -> DentalAnswers:
    turn = AiTurn(question=question, choices=list(choices))
    return answers.model_copy(update={"ai": [*answers.ai, turn]})


def ai_step(answers: DentalAnswers) -> DentalStep:
    """Экран вопроса: варианты нейросети, своё поле и «Пропустить»."""
    turn = pending_turn(answers)
    if turn is None:
        raise DentalAnswerError("No pending clarifying question")
    return DentalStep(
        step_key=AI_STEP,
        step_type="chip_groups",
        title="Уточним",
        groups=[
            {
                "key": AI_GROUP,
                "title": None,
                "question": turn.question,
                "options": [
                    {"value": str(index), "label": label}
                    for index, label in enumerate(turn.choices)
                ],
                "multiple": True,
                "required": False,
                "text": {"placeholder": "Свой ответ", "required": False, "show": "always"},
            },
        ],
        allow_skip=True,
    )


def apply_ai_answer(
    answers: DentalAnswers,
    *,
    selections: dict[str, list[str]],
    texts: dict[str, str],
    skip: bool,
    max_len: int = DEFAULT_MAX_TEXT_LEN,
) -> DentalAnswers:
    turn = pending_turn(answers)
    if turn is None:
        raise DentalAnswerError("No pending clarifying question")
    if (set(selections) | set(texts)) - {AI_GROUP}:
        raise DentalAnswerError("Only the clarifying question can be answered here")

    if skip:
        closed = turn.model_copy(update={"skipped": True})
    else:
        labels = []
        for value in dict.fromkeys(selections.get(AI_GROUP, [])):
            if not value.isdigit() or int(value) >= len(turn.choices):
                raise DentalAnswerError(f"Unknown choice {value}")
            labels.append(turn.choices[int(value)])
        text = (texts.get(AI_GROUP) or "").strip()[:max_len]
        answer = "; ".join(part for part in (", ".join(labels), text) if part)
        if not answer:
            raise DentalAnswerError("Choose an option, write an answer or skip")
        closed = turn.model_copy(update={"answer": answer})

    return answers.model_copy(update={"ai": [*answers.ai[:-1], closed]})


def clarify_request(answers: DentalAnswers) -> dict:
    """Тело запроса к ml-service `/dental_clarify`."""
    summary, _ = build_dental_summary(answers)
    has = [row for row in summary["health"] if row["has"]]
    has_not = [row["label"] for row in summary["health"] if not row["has"]]
    lines = [f"Повод и жалобы: {summary['complaints'] or '—'}"]
    lines += [f"Здоровье: {row['label']}" + (f" — {row['detail']}" if row["detail"] else "") for row in has]
    if has_not:
        lines.append("Нет: " + ", ".join(has_not))
    lines.append(f"Препараты: {summary['medications']}")
    lines.append(f"Аллергия: {summary['allergy_anamnesis']}")
    return {
        "answers": "\n".join(lines),
        "history": [
            {"question": turn.question, "answer": turn.answer}
            for turn in answers.ai
            if turn.is_closed
        ],
    }
