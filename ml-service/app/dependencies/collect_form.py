from fastapi import Depends
from langchain_gigachat.chat_models.gigachat import GigaChat

from app.services.collect_form import CollectFormService
from app.services.llm_setup import llm_collect_form


def get_collect_form_llm() -> GigaChat:
    """LLM-клиент для collect_form. Один на процесс, создан в llm_setup."""
    return llm_collect_form


def get_collect_form_service(
    llm: GigaChat = Depends(get_collect_form_llm),
) -> CollectFormService:
    return CollectFormService(llm=llm)
