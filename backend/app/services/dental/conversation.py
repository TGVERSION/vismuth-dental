"""Один вопрос внутри прежнего серверного раздела, с произвольным ответом."""

from .flow import (DentalAnswers, DentalAnswerError, GroupAnswer, _groups_for,
                   _parse_group, _clean_text, dental_step, DEFAULT_MAX_TEXT_LEN)


def active_group(step_key: str, answers: DentalAnswers):
    done = answers.answered_questions.get(step_key, [])
    return next((group for group in _groups_for(step_key, answers) if group.key not in done), None)


def prepare_question_answer(step_key, answers, key, selections, texts, none):
    step = dental_step(step_key, answers)
    if step.step_type == 'checklist':
        if key != 'health' or set(texts) - {'health'}:
            raise DentalAnswerError('Ответьте на текущий вопрос')
        comment = _clean_text(texts.get('health'), DEFAULT_MAX_TEXT_LEN)
        comments = dict(answers.health_comments)
        if comment:
            if none:
                raise DentalAnswerError('Выберите «ничего нет» или напишите ответ')
            comments[step_key] = comment
            owned = {item['value'] for item in step.items}
            yes = set(selections.get('health', []))
            unknown = set(selections.get('health_unknown', []))
            selections = {**selections, 'health_unknown': list(unknown | (owned - yes))}
        else:
            comments.pop(step_key, None)
        return answers.model_copy(update={'health_comments': comments}), True, selections, {}, none
    group = active_group(step_key, answers)
    if group is None or key != group.key:
        raise DentalAnswerError('Вопрос уже изменился. Загрузите актуальный вопрос')
    if none or set(selections) - {key} or set(texts) - {key}:
        raise DentalAnswerError('Ответ должен относиться только к текущему вопросу')
    text = _clean_text(texts.get(key), DEFAULT_MAX_TEXT_LEN)
    chosen = selections.get(key, [])
    # Только точное совпадение целого ответа с готовым вариантом; отрицания
    # и произвольные фразы остаются исходным текстом, без классификации.
    if text and not chosen:
        literal = next((option for option in group.options if option.value != 'other'
                        and option.label.casefold().replace('ё', 'е') == text.casefold().replace('ё', 'е')), None)
        if literal:
            chosen, text = [literal.value], ''
    saved = _parse_group(group, chosen, text, allow_free_text=True)
    groups = {**answers.groups, key: saved}
    completed = [*answers.answered_questions.get(step_key, []), key]
    updated = answers.model_copy(update={
        'groups': groups,
        'answered_questions': {**answers.answered_questions, step_key: completed},
        'free_text_groups': list(dict.fromkeys([*answers.free_text_groups, key])),
    })
    all_groups = _groups_for(step_key, updated)
    complete = all(group.key in completed for group in all_groups)
    return updated, complete, {g.key: groups.get(g.key, GroupAnswer()).selected for g in all_groups}, {
        g.key: groups.get(g.key, GroupAnswer()).text for g in all_groups}, False


def health_free_reference(answers: DentalAnswers, value: str) -> str | None:
    if value not in answers.health_unknown:
        return None
    for key in answers.health_comments:
        step = dental_step(key, answers)
        if any(item['value'] == value for item in step.items):
            return f'См. свободный ответ: {step.title}'
    return None
