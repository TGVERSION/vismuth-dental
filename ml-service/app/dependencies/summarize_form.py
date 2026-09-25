from fastapi import Depends
from langchain_gigachat.chat_models.gigachat import GigaChat

from app.services.summarize_form import SummarizeFormService
from app.services.llm_setup import llm_summarize_form


def get_summarize_form_llm() -> GigaChat:
    """LLM-клиент для summarize_form. Один на процесс, создан в llm_setup."""
    return llm_summarize_form


def get_summarize_form_service(
    llm: GigaChat = Depends(get_summarize_form_llm),
) -> SummarizeFormService:
    return SummarizeFormService(llm=llm)
