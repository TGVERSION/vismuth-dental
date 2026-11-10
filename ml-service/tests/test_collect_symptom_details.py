"""Полнота и уточнения соответствуют симптому, а не предполагаемой боли."""
import asyncio

import pytest
from langchain_core.messages import AIMessage, SystemMessage

from app.schemas import Complaints, CollectFormRequest, CollectionTarget, FormProgress
from app.services.collect_form import CollectFormService, _next_target


def progress(**complaint):
    return FormProgress.model_validate({
        'complaints': {'status': 'filled', **complaint},
        'medications': {'status': 'denied'},
        'allergy_anamnesis': {'status': 'denied'},
    })


@pytest.mark.parametrize('kind, facts', [
    ('heartburn', {'has_onset': True, 'has_frequency': True, 'has_triggers': True}),
    ('stool', {'has_onset': True, 'has_frequency': True, 'has_stool_description': True}),
    ('pain', {'has_onset': True, 'has_localization': True, 'has_character': True}),
])
def test_completeness_depends_on_actual_symptom(kind, facts):
    state = progress(symptom_type=kind, **facts)
    assert state.complaints.detailed
    assert _next_target(state) is None
    state.complaints.has_onset = False
    assert _next_target(state) == CollectionTarget.COMPLAINTS_DETAIL


def test_old_progress_without_symptom_type_keeps_pain_criteria():
    old = Complaints(status='filled', has_localization=True, has_character=True, has_onset=True)
    assert old.detailed


@pytest.mark.parametrize('kind, missing', [('heartburn', 'как часто бывает изжога'), ('stool', 'как часто бывает стул')])
def test_followup_uses_only_relevant_missing_facts(kind, missing):
    class Client:
        def with_structured_output(self, _):
            return None

        async def ainvoke(self, messages):
            self.messages = messages
            return AIMessage(content='Как часто это бывает?')

    client = Client()
    state = progress(symptom_type=kind, value='PATIENT-ONLY', has_onset=True, has_triggers=True, has_stool_description=True)
    request = CollectFormRequest(messages=[{'role': 'user', 'text': 'PATIENT-ONLY'}])
    asyncio.run(CollectFormService(client, 6)._question(CollectionTarget.COMPLAINTS_DETAIL, state, request))
    system = next(message.content for message in client.messages if isinstance(message, SystemMessage))
    assert missing in system
    assert 'где именно болит' not in system
    assert 'PATIENT-ONLY' not in system
    assert 'когда началась' not in system
