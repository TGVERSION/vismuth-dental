"""Уточнения нейросети в стоматологической анкете: когда звать, как задать, как записать."""

import pytest

from app.services.dental.clarify import (
    AI_STEP,
    add_ai_question,
    ai_step,
    apply_ai_answer,
    clarify_request,
    needs_clarification,
    pending_turn,
)
from app.services.dental.flow import DentalAnswerError, DentalAnswers, GroupAnswer
from app.services.dental.summary import build_dental_summary


def _answers(health=None, **groups):
    return DentalAnswers(
        health=health if health is not None else [],
        groups={k.replace("__", "."): GroupAnswer(**v) for k, v in groups.items()},
    )


CHECKUP = _answers(reason={"selected": ["checkup"]})


@pytest.mark.parametrize(
    ("answers", "expected"),
    [
        (CHECKUP, False),
        (_answers(reason={"selected": ["other"], "text": "Шатается зуб"}), True),
        (_answers(reason={"selected": ["pain"]}, pain__where={"selected": ["upper_left"]}), True),
        (
            _answers(
                reason={"selected": ["pain"]},
                pain__where={"selected": ["upper_left"]},
                pain__when={"selected": ["cold"]},
                pain__since={"selected": ["days"]},
            ),
            False,
        ),
        (_answers(["medications"], reason={"selected": ["checkup"]}, medications={"text": "Конкор"}), True),
        # Дата рождения и последний визит — факты для шапки бланка, не повод спрашивать.
        (
            _answers(
                reason={"selected": ["checkup"]},
                about__birth_date={"text": "14.03.1985"},
                about__visit_year={"text": "2024"},
                about__visit_clinic={"text": "Улыбка"},
            ),
            False,
        ),
    ],
)
def test_ask_only_when_there_is_something_to_clarify(answers, expected):
    assert needs_clarification(answers) is expected


def test_question_step_offers_choices_own_text_and_skip():
    answers = add_ai_question(CHECKUP, "Когда удаляли зуб?", ["Вчера", "Неделю назад"])

    step = ai_step(answers)

    assert step.step_key == AI_STEP
    [group] = step.groups
    assert group["question"] == "Когда удаляли зуб?"
    assert [o["label"] for o in group["options"]] == ["Вчера", "Неделю назад"]
    assert group["text"]["show"] == "always"
    assert step.allow_skip is True


def test_answer_by_choice_and_text_is_recorded():
    answers = add_ai_question(CHECKUP, "Когда удаляли зуб?", ["Вчера", "Неделю назад"])

    answers = apply_ai_answer(answers, selections={"ai": ["1"]}, texts={"ai": " после обеда "}, skip=False)

    assert pending_turn(answers) is None
    assert answers.ai[0].answer == "Неделю назад; после обеда"


def test_unknown_choice_is_rejected():
    answers = add_ai_question(CHECKUP, "Когда?", ["Вчера"])

    with pytest.raises(DentalAnswerError):
        apply_ai_answer(answers, selections={"ai": ["7"]}, texts={}, skip=False)


def test_empty_answer_without_skip_is_rejected():
    answers = add_ai_question(CHECKUP, "Когда?", ["Вчера"])

    with pytest.raises(DentalAnswerError):
        apply_ai_answer(answers, selections={}, texts={"ai": "  "}, skip=False)


def test_skip_is_recorded():
    answers = add_ai_question(CHECKUP, "Когда?", ["Вчера"])

    answers = apply_ai_answer(answers, selections={}, texts={}, skip=True)

    assert answers.ai[0].skipped is True
    assert pending_turn(answers) is None


def test_request_to_model_has_answers_and_history():
    answers = _answers(reason={"selected": ["other"], "text": "Опухла щека"})
    answers = apply_ai_answer(add_ai_question(answers, "Когда?", ["Вчера"]), selections={"ai": ["0"]}, texts={}, skip=False)

    request = clarify_request(answers)

    assert "Опухла щека" in request["answers"]
    assert request["history"] == [{"question": "Когда?", "answer": "Вчера"}]


def test_clarifications_go_to_the_card_and_skipped_ones_to_gaps():
    answers = add_ai_question(CHECKUP, "Когда удаляли зуб?", ["Вчера"])
    answers = apply_ai_answer(answers, selections={"ai": ["0"]}, texts={}, skip=False)
    answers = add_ai_question(answers, "Есть ли температура?", ["Да", "Нет"])
    answers = apply_ai_answer(answers, selections={}, texts={}, skip=True)

    summary, gaps = build_dental_summary(answers)

    assert summary["clarifications"] == [
        {"question": "Когда удаляли зуб?", "answer": "Вчера"},
        {"question": "Есть ли температура?", "answer": ""},
    ]
    assert {"section": "complaints", "question": "Есть ли температура?"} in gaps
