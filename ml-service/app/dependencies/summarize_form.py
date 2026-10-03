from fastapi import Depends
from langchain_gigachat.chat_models.gigachat import GigaChat

from app.llm_services.llm_factory import LLMRole
from app.llm_services.llm_setup import llm_factory
from app.services.summarize_form import SummarizeFormService


def get_summarize_form_llm() -> GigaChat:
    """LLM-клиент для summarize_form. Создаётся фабрикой и кешируется в ней."""
    return llm_factory.get_chat(LLMRole.SUMMARIZE_FORM)


def get_summarize_form_service(
    llm: GigaChat = Depends(get_summarize_form_llm),
) -> SummarizeFormService:
    return SummarizeFormService(llm=llm)
