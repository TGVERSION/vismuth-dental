"""Уточняющий вопрос стоматологической анкеты: логика вокруг модели."""

import asyncio

from langchain_core.runnables import RunnableLambda

from app.schemas.dental_clarify import ClarifyTurn, DentalClarifyRequest, DentalDecision
from app.services.dental_clarify import DentalClarifyService

ANSWERS = "Повод: болит зуб. Другое: «после удаления опухла щека». Здоровье: нет."


def _service(decision: DentalDecision, calls: list | None = None, max_questions: int = 2):
    def fake(messages):
        if calls is not None:
            calls.append(messages)
        return decision

    return DentalClarifyService(decider=RunnableLambda(fake), max_questions=max_questions)


def _run(service, history=()):
    request = DentalClarifyRequest(answers=ANSWERS, history=list(history))
    return asyncio.run(service.run(request))


def test_returns_cleaned_question_and_choices():
    decision = DentalDecision(
        need_question=True,
        question="  Когда удаляли зуб?  ",
        choices=["Вчера", "Вчера", "Неделю назад", "Другое", "", "Больше месяца назад"],
    )

    answer = _run(_service(decision))

    assert answer.status == "question"
    assert answer.question == "Когда удаляли зуб?"
    assert answer.choices == ["Вчера", "Неделю назад", "Больше месяца назад"]


def test_model_may_decide_nothing_to_ask():
    answer = _run(_service(DentalDecision(need_question=False)))

    assert answer.status == "done"
    assert answer.question is None


def test_budget_exhausted_without_calling_model():
    calls: list = []
    history = [ClarifyTurn(question="Когда удаляли зуб?", answer="Вчера"),
               ClarifyTurn(question="Есть ли температура?", answer="")]

    answer = _run(_service(DentalDecision(need_question=True, question="Ещё?"), calls), history)

    assert answer.status == "done"
    assert calls == []


def test_repeated_question_is_not_asked_again():
    history = [ClarifyTurn(question="Когда удаляли зуб?", answer="Вчера")]
    decision = DentalDecision(need_question=True, question="когда удаляли зуб?")

    assert _run(_service(decision), history).status == "done"


def test_text_without_question_mark_is_not_a_question():
    decision = DentalDecision(need_question=True, question="Обратитесь к хирургу.")

    assert _run(_service(decision)).status == "done"


def test_choices_are_limited_to_five_short_ones():
    decision = DentalDecision(
        need_question=True,
        question="Что беспокоит?",
        choices=["А", "Б", "В", "Г", "Д", "Е", "очень длинный вариант ответа " * 5],
    )

    assert _run(_service(decision)).choices == ["А", "Б", "В", "Г", "Д"]


def test_model_sees_answers_and_history():
    calls: list = []
    history = [ClarifyTurn(question="Когда удаляли зуб?", answer="Вчера")]

    _run(_service(DentalDecision(need_question=False), calls), history)

    text = "\n".join(str(m.content) for m in calls[0])
    assert "после удаления опухла щека" in text
    assert "Когда удаляли зуб?" in text and "Вчера" in text
