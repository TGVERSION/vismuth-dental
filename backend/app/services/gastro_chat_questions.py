"""Small fixed follow-ups in the original chat; no separate gastro form."""
from typing import Any

GASTRO_CHAT_QUESTIONS = {
    'stool_changes': {
        'text': 'Изменился ли стул: как часто вы ходите в туалет и каким он стал? Если да — как давно?',
        'negative_label': 'Без изменений',
        'negative_text': 'Изменений стула не отмечает',
        'heading': 'Изменения стула',
        'section': 'complaints',
        'next': 'weight_changes',
    },
    'weight_changes': {
        'text': 'Менялся ли вес за последние 6 месяцев без намерения его менять? Если да — на сколько килограммов и за какой срок?',
        'negative_label': 'Без изменений',
        'negative_text': 'Непреднамеренного изменения веса не отмечает',
        'heading': 'Изменение веса',
        'section': 'complaints',
        'next': 'family_history',
    },
    'family_history': {
        'text': 'Известны ли у кровных родственников рак желудка или кишечника, болезнь Крона, язвенный колит или целиакия? Если да — у кого и что именно?',
        'negative_label': 'Нет',
        'negative_text': 'Такие заболевания у родственников не известны',
        'heading': 'Болезни родственников',
        'section': 'life_anamnesis',
        'next': 'patient_info',
    },
}


def append_gastro_chat_answers(structured: dict[str, Any], answers: list) -> None:
    """Keep the patient's exact words visible, independent of ML summarization."""
    by_step = {answer.step_key: answer for answer in answers
               if answer.step_key in GASTRO_CHAT_QUESTIONS and answer.kind in {'answer', 'fixed'}}
    for key, question in GASTRO_CHAT_QUESTIONS.items():
        answer = by_step.get(key)
        if answer is None or not answer.answer_text:
            continue
        section = question['section']
        original = str(structured.get(section) or '')
        addition = f"{question['heading']}: {answer.answer_text}"
        structured[section] = f'{original}\n\n{addition}' if original else addition
