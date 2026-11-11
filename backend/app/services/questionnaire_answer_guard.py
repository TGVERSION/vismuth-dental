"""Проверка тематики без сохранения отклонённого текста пациента."""
from collections.abc import Sequence
from uuid import UUID
from fastapi import HTTPException
from ..models.questionnaire import QuestionnaireAnswer
from .ml_proxy import proxy_post_to_ml
from .questionnaire_limits import check_answer_guard_limit
from .questionnaire_step import StepDescriptor

GUARDED_STEPS = frozenset({
    'complaint', 'ai_clarify', 'medications', 'chronic', 'allergy', 'allergy_reaction',
    'stool_changes', 'weight_changes', 'family_history', 'repeat_change', 'repeat_side_effects',
    'stool_frequency', 'stool_form', 'stool_recent_changes', 'stool_change_onset',
    'stool_impurities',
})
MAX_CONSECUTIVE = 3
MAX_TOTAL = 6
_SHORT_ANSWERS = frozenset({
    'да', 'нет', 'не знаю', 'не помню', 'не уверен', 'не уверена',
    'не принимаю', 'ничего не принимаю', 'без изменений', 'ничего',
    'не было', 'нет аллергии', 'аллергии нет', 'лекарств нет',
    'жалоб нет', 'ничего не беспокоит',
})


def rejection_counts(answers: Sequence[QuestionnaireAnswer]) -> tuple[int, int]:
    total = sum(answer.step_key == 'guard_reject' for answer in answers)
    consecutive = 0
    for answer in reversed(answers):
        if answer.step_key != 'guard_reject' and answer.kind in {'answer', 'fixed', 'skip'}:
            break
        if answer.step_key == 'guard_reject':
            consecutive += 1
    return consecutive, total


def rejected_before(answers: Sequence[QuestionnaireAnswer], answer_id: UUID | None) -> bool:
    return answer_id is not None and any(
        answer.step_key == 'guard_reject' and answer.question_text == str(answer_id)
        for answer in answers
    )


def guard_notice(answers: Sequence[QuestionnaireAnswer], step: str) -> str | None:
    if not answers or answers[-1].step_key != 'guard_reject' or answers[-1].choice != step:
        return None
    consecutive, total = rejection_counts(answers)
    if consecutive >= MAX_CONSECUTIVE - 1 or total >= MAX_TOTAL - 1:
        return 'Пожалуйста, ответьте на вопрос о вашем здоровье. Следующий ответ не по теме завершит этот опрос.'
    return 'Давайте вернёмся к вопросу о вашем здоровье. Пожалуйста, ответьте на него; другие темы здесь не обсуждаются.'


def stopped_descriptor() -> StepDescriptor:
    return StepDescriptor(
        step_key='guard_stopped', step_type='stopped', title='Опрос завершён',
        text='Опрос остановлен после нескольких ответов не по теме. Анкета не отправлена врачу. Для консультации или записи обратитесь в клинику.',
        required=False,
    )


async def classify_answer(question: str, answer: str, step: str, *, questionnaire_id: UUID | None = None) -> bool:
    normalized = ' '.join(answer.casefold().replace('ё', 'е').split()).strip(' .!?')
    if normalized in _SHORT_ANSWERS:
        return False
    if questionnaire_id is not None:
        try:
            await check_answer_guard_limit(questionnaire_id)
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(status_code=503, detail='Проверка ответа временно недоступна. Повторите отправку.') from None
    try:
        response = await proxy_post_to_ml(
            '/questionnaire_answer_guard',
            {'question': question[:1000], 'answer': answer, 'step_key': step},
            timeout=20,
        )
        decision = response.get('decision') if isinstance(response, dict) else None
        if isinstance(decision, str) and decision in {'accept', 'uncertain', 'off_topic'}:
            return decision == 'off_topic'
    except Exception:
        # Сбой проверки не является нарушением и не раскрывает содержимое ответа.
        pass
    raise HTTPException(status_code=503, detail='Не удалось проверить ответ. Попробуйте отправить его ещё раз.')
