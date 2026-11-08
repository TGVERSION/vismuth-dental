"""Разделение вопросов чата и безопасное распознавание прежних ответов."""
import re
from ..models.questionnaire import QuestionnaireAnswer


def normalized_question(text: str | None) -> str:
    return ' '.join(re.findall(r'\w+', (text or '').casefold().replace('ё', 'е')))


# Только известные полные формулировки прежнего collect_form, не поиск по
# словам и не предположение модели о наличии/отсутствии лекарств или аллергии.
_LEGACY_QUESTIONS = {
    normalized_question('Какие лекарства принимаете сейчас? Если да — назовите, пожалуйста, названия и дозы.'): 'medications',
    normalized_question('Уточните, пожалуйста: какие лекарства вы принимаете сейчас и в каких дозах?'): 'medications',
    normalized_question('Есть ли аллергия на лекарства или продукты? Если да — на что и какая реакция.'): 'allergy',
    normalized_question('Уточните, пожалуйста: была ли аллергия или непереносимость лекарств, продуктов?'): 'allergy',
}


def answered_fixed_topics(answers: list[QuestionnaireAnswer]) -> dict[str, str]:
    answered = {}
    for answer in answers:
        if answer.kind not in {'answer', 'fixed'} or not (answer.answer_text or '').strip():
            continue
        if answer.step_key in {'medications', 'allergy'}:
            topic = answer.step_key
        elif answer.step_key == 'ai_clarify':
            topic = _LEGACY_QUESTIONS.get(normalized_question(answer.question_text))
        else:
            topic = None
        if topic:
            answered[topic] = answer.answer_text
    return answered


def question_was_asked(text: str, answers: list[QuestionnaireAnswer]) -> bool:
    question = normalized_question(text)
    return not question or any(
        normalized_question(answer.question_text) == question for answer in answers
        if answer.question_text
    )
