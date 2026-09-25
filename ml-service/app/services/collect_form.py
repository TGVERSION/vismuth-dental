from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_gigachat.chat_models.gigachat import GigaChat

from app.schemas import ChatAnswer, ChatMessages
from app.schemas.chat_form import ChatMessage, ChatRole

from .prompts import COLLECT_FORM_SYSTEM_PROMPT


class CollectFormService:
    """Собирает уточняющий вопрос по истории чата через LLM."""

    def __init__(self, llm: GigaChat) -> None:
        self._llm = llm

    def _build_messages(self, request: ChatMessages) -> list:
        messages: list = [SystemMessage(content=COLLECT_FORM_SYSTEM_PROMPT)]
        for message in request.messages:
            if message.role == ChatRole.USER:
                messages.append(HumanMessage(content=message.text))
            else:
                messages.append(AIMessage(content=message.text))
        return messages

    def run(self, request: ChatMessages) -> ChatAnswer:
        response = self._llm.invoke(self._build_messages(request))
        return ChatAnswer(
            messages=ChatMessage(
                role=ChatRole.ASSISTANT,
                text=response.content.strip(),
            )
        )
