from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_gigachat.chat_models.gigachat import GigaChat

from app.schemas import ChatMessages, PatientFormSummary
from app.schemas.chat_form import ChatRole

from .prompts import SUMMARIZE_FORM_SYSTEM_PROMPT


class SummarizeFormService:
    """Саммаризирует анкету пациента по истории чата через structured output LLM."""

    def __init__(self, llm: GigaChat) -> None:
        self._llm = llm.with_structured_output(PatientFormSummary)

    def _build_messages(self, request: ChatMessages) -> list:
        messages: list = [SystemMessage(content=SUMMARIZE_FORM_SYSTEM_PROMPT)]
        for message in request.messages:
            if message.role == ChatRole.USER:
                messages.append(HumanMessage(content=message.text))
            else:
                messages.append(AIMessage(content=message.text))
        return messages

    def run(self, request: ChatMessages) -> PatientFormSummary:
        result = self._llm.invoke(self._build_messages(request))
        if not isinstance(result, PatientFormSummary):
            return PatientFormSummary(
                complaints="",
                medications="",
                allergy_anamnesis="",
            )
        return result
