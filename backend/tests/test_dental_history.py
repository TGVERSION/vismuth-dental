from types import SimpleNamespace

from app.services.dental.flow import AiTurn, DentalAnswers, GroupAnswer
from app.services.dental.history import dental_history
from app.services.dental_questionnaire import build_dental_descriptor


def test_history_contains_only_accepted_pages_and_preserves_unknown():
    answers = DentalAnswers(
        flow_version=2,
        health=['medications'], health_unknown=['hepatitis'],
        health_answered=['hepatitis', 'tuberculosis', 'hiv', 'transfusion', 'injections', 'jaw_trauma', 'surgery'],
        groups={'reason': GroupAnswer(selected=['checkup'])},
    )
    entries = dental_history(answers, ['dental_reason', 'dental_health_2'])
    assert entries[0]['answer'] == 'Осмотр, чистка'
    assert 'Не знаю:' in entries[1]['answer']
    assert 'гепатит' in entries[1]['answer'].lower()
    assert 'лекарств' not in entries[1]['answer'].lower()
    assert 'Остальное: нет' in entries[1]['answer']
    assert not dental_history(answers, ['dental_health_1'])  # coverage отсутствует


def test_group_history_uses_visible_answers_and_never_admin_birth_date():
    answers = DentalAnswers(groups={
        'reason': GroupAnswer(selected=['checkup'], text='скрытый текст другого варианта'),
        'about.birth_date': GroupAnswer(text='1980-04-12'),
        'about.visit_year': GroupAnswer(text='Не помню'),
        'about.visit_clinic': GroupAnswer(text='Клиника <тест>'),
    })
    entries = dental_history(answers, ['dental_reason', 'dental_about'])
    assert entries[0]['answer'] == 'Осмотр, чистка'
    assert entries[-1]['answer'] == 'Не указано'
    text = str(entries)
    assert 'Не помню' in text and 'Клиника <тест>' in text
    assert '1980-04-12' not in text and 'скрытый текст' not in text


def test_history_keeps_full_open_text_and_closed_ai_turns_once():
    long_text = 'Подробности\n' + 'а' * 15000
    answers = DentalAnswers(groups={'reason': GroupAnswer(selected=['other'], text=long_text)}, ai=[
        AiTurn(question='Уточнение один?', answer='Ответ'),
        AiTurn(question='Уточнение два?', skipped=True),
        AiTurn(question='Текущий вопрос?'),
    ])
    entries = dental_history(answers, ['dental_reason'])
    assert entries[0]['answer'] == long_text
    assert [entry['question'] for entry in entries[1:]] == ['Уточнение один?', 'Уточнение два?']
    assert entries[-1]['answer'] == 'Пропущено'
    assert len({entry['id'] for entry in entries}) == len(entries)


def test_descriptor_restores_history_from_server_without_current_question():
    answers = DentalAnswers(flow_version=2, groups={'reason': GroupAnswer(selected=['checkup'])},
                            completed_steps=['dental_reason'])
    q = SimpleNamespace(current_step='dental_health_1', dental_answers=answers.model_dump(), status='in_progress')
    descriptor = build_dental_descriptor(q)
    assert descriptor.dental['history'] == dental_history(answers, ['dental_reason'])
    assert descriptor.dental['history'][0]['step_key'] == 'dental_reason'
    assert len(descriptor.dental['history']) == 1
