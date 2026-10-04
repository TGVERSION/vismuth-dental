from fastapi import Depends
from langchain_gigachat.chat_models.gigachat import GigaChat

from app.config import settings
from app.llm_services.llm_factory import LLMRole
from app.llm_services.llm_setup import llm_factory
from app.services.collect_form import CollectFormService


def get_collect_form_llm() -> GigaChat:
    """LLM-клиент для collect_form. Создаётся фабрикой и кешируется в ней."""
    return llm_factory.get_chat(LLMRole.COLLECT_FORM)


def get_collect_form_service(
    llm: GigaChat = Depends(get_collect_form_llm),
) -> CollectFormService:
    return CollectFormService(
        llm=llm,
        max_questions=settings.gigachat.collect_form_max_questions,
    )
