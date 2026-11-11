"""Small fixed follow-ups in the original chat; no separate gastro form."""
import re
from typing import Any

from .questionnaire_dedup import normalized_question


def needs_allergy_reaction(answer: str) -> bool:
    text = normalized_question(answer)
    if not text or re.fullmatch(
        r'(?:нет|не было|нет аллергии(?: на лекарства)?|аллергии(?: на лекарства)? (?:нет|не было)|'
        r'не знаю|не помню|не уверен[а]?|не известно|неизвестно|без аллергии)', text
    ):
        return False
    return not re.search(
        r'\b(?:сып\w*|высып\w*|зуд\w*|чесал\w*|отек\w*|опух\w*|'
        r'крапивниц\w*|покрасн\w*|задых\w*|удуш\w*|анафила\w*|'
        r'тошн\w*|рвот\w*|волдыр\w*|не помню|не знаю|не уверен[а]?)\b', text
    )

GASTRO_CHAT_QUESTIONS = {
    'allergy_reaction': {
        'text': 'Как проявилась аллергия? Если не помните, так и напишите.',
        'choices': [],
        'heading': 'Проявление аллергии', 'section': 'allergy_anamnesis', 'next': 'stool_frequency',
    },
    'stool_frequency': {
        'text': 'Как часто у вас обычно бывает стул?\n\nВыберите подходящий вариант или напишите своими словами, например: раз в три дня или несколько раз в день.',
        'choices': [
            {'value': 'less_daily', 'label': 'Реже раза в день'},
            {'value': 'daily', 'label': 'Раз в день'},
            {'value': 'two_three', 'label': '2–3 раза в день'},
            {'value': 'four_more', 'label': '4 раза в день и чаще'},
            {'value': 'unknown', 'label': 'Не знаю'},
        ],
        'heading': 'Частота стула', 'section': 'complaints', 'next': 'stool_form',
    },
    'stool_form': {
        'text': 'Какой стул бывает у вас обычно?\n\nМожно выбрать вариант или описать своими словами. Если бывает по-разному, расскажите об этом.',
        'choices': [
            {'value': 'hard', 'label': 'Твёрдый, комочками'},
            {'value': 'formed', 'label': 'Оформленный'},
            {'value': 'mushy', 'label': 'Кашицеобразный'},
            {'value': 'watery', 'label': 'Водянистый'},
            {'value': 'alternating', 'label': 'Бывает по-разному'},
            {'value': 'unknown', 'label': 'Не знаю'},
        ],
        'heading': 'Вид стула', 'section': 'complaints', 'next': 'stool_recent_changes',
    },
    'stool_recent_changes': {
        'text': 'Менялся ли ваш привычный стул в последнее время?\n\nНапример, стал чаще или реже, твёрже или более жидким.',
        'choices': [
            {'value': 'yes', 'label': 'Да, изменился'},
            {'value': 'none', 'label': 'Без изменений'},
            {'value': 'unknown', 'label': 'Не знаю'},
        ],
        'negative_text': 'Недавних изменений привычного стула не отмечает',
        'heading': 'Недавние изменения стула', 'section': 'complaints', 'next': 'stool_change_onset',
        'next_by_choice': {'none': 'stool_impurities', 'unknown': 'stool_impurities'},
    },
    'stool_change_onset': {
        'text': 'Когда вы заметили изменения стула?\n\nВыберите примерный срок или напишите свою дату или период.',
        'choices': [
            {'value': 'days', 'label': 'В течение последней недели'},
            {'value': 'weeks', 'label': 'От недели до месяца назад'},
            {'value': 'months', 'label': 'От месяца до полугода назад'},
            {'value': 'longer', 'label': 'Более полугода назад'},
            {'value': 'unknown', 'label': 'Не помню'},
        ],
        'heading': 'Начало изменений стула', 'section': 'complaints', 'next': 'stool_impurities',
    },
    # Старые начатые сессии заканчивают прежний объединённый вопрос.
    'stool_changes': {
        'text': 'Изменился ли стул: как часто вы ходите в туалет и каким он стал? Если да — как давно?',
        'negative_label': 'Без изменений',
        'negative_text': 'Изменений стула не отмечает',
        'heading': 'Изменения стула',
        'section': 'complaints',
        'next': 'stool_impurities',
    },
    'stool_impurities': {
        'text': 'Замечали ли вы примеси в кале? Например, кровь, слизь или непереваренные кусочки пищи. Если да, напишите, что именно заметили.',
        'choices': [{'value': 'none', 'label': 'Не замечал(а)'}],
        'negative_text': 'Примесей в кале не замечал(а)',
        'heading': 'Примеси в кале',
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


def gastro_choices(question: dict[str, Any]) -> list[dict[str, str]]:
    if 'choices' in question:
        return question['choices']
    return [
        {'value': 'none', 'label': question['negative_label']},
        {'value': 'unknown', 'label': 'Не знаю'},
    ]


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
