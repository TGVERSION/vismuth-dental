"""Переписка по принятым ответам. Не меняет маршрут, БД или печатный бланк."""

from __future__ import annotations

from .flow import DentalAnswers, dental_step
from .questions import OTHER


def dental_history(answers: DentalAnswers, completed: list[str]) -> list[dict[str, str]]:
    entries: list[dict[str, str]] = []
    for key in dict.fromkeys(completed):
        step = dental_step(key, answers)
        if step.step_type == 'checklist':
            if answers.health is None:
                continue
            if answers.flow_version == 2 and not {item['value'] for item in step.items}.issubset(answers.health_answered):
                continue
            yes = [item['label'] for item in step.items if item['value'] in answers.health]
            unknown = [item['label'] for item in step.items if item['value'] in answers.health_unknown]
            parts = []
            if yes:
                parts.append('Да: ' + '; '.join(yes))
            if unknown:
                parts.append('Не знаю: ' + '; '.join(unknown))
            if parts and len(yes) + len(unknown) < len(step.items):
                parts.append('Остальное: нет')
            entries.append({'id': key, 'step_key': key, 'question': step.title or 'Здоровье сейчас и раньше',
                            'answer': ('\n'.join(([f"Да: {'; '.join(yes)}"] if yes else []) + [answers.health_comments[key]])
                                       if key in answers.health_comments else ('\n'.join(parts) if parts else 'Ничего из этого нет'))})
            continue
        for group in step.groups:
            saved = answers.groups.get(group['key'])
            selected = saved.selected if saved else []
            labels = [option['label'] for option in group['options']
                      if option['value'] in selected and option['value'] != OTHER]
            field = group.get('text')
            visible = field and (field['show'] == 'always' or
                                 field['show'] == 'on_select' and selected or
                                 field['show'] == 'on_other' and OTHER in selected)
            text = saved.text if saved and (visible or group['key'] in answers.free_text_groups) else ''
            if group['key'] == 'medications.dose' and 'unknown' in selected and not text:
                text = 'Дозу не помню'
            question = ': '.join(part for part in [group.get('title'), group['question']] if part)
            entries.append({'id': f"{key}:{group['key']}", 'step_key': key, 'question': question,
                            'answer': '; '.join(part for part in [', '.join(labels), text] if part) or 'Не указано'})
    for index, turn in enumerate(answers.ai):
        if turn.is_closed:
            entries.append({'id': f'dental_ai:{index}', 'step_key': 'dental_ai',
                            'question': turn.question, 'answer': 'Пропущено' if turn.skipped else turn.answer})
    return entries
