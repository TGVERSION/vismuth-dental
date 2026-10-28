"""Сервис уточнений стоматологической анкеты и его модель.

Модель — не GigaChat, а любой сервер с OpenAI-совместимым API, поэтому клиент
собирается здесь, а не в фабрике GigaChat (app/llm_services/llm_factory.py).
"""

from functools import lru_cache

from fastapi import HTTPException, status
from langchain_openai import ChatOpenAI

from app.config import settings
from app.schemas.dental_clarify import DentalDecision
from app.services.dental_clarify import DentalClarifyService


@lru_cache(maxsize=1)
def _dental_clarify_service() -> DentalClarifyService:
    config = settings.dental_llm
    extra_body = (
        {"chat_template_kwargs": {"enable_thinking": False}} if config.disable_thinking else None
    )
    llm = ChatOpenAI(
        base_url=config.base_url,
        api_key=config.api_key,
        model=config.model,
        temperature=config.temperature,
        max_tokens=config.max_tokens,
        timeout=config.timeout,
        # повторы — на стороне backend: он ждёт не дольше своего таймаута
        max_retries=0,
        extra_body=extra_body,
    )
    decider = llm.with_structured_output(DentalDecision, method=config.structured_method)
    return DentalClarifyService(decider=decider, max_questions=config.max_questions)


def get_dental_clarify_service() -> DentalClarifyService:
    if not settings.dental_llm.base_url:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Dental clarify model is not configured",
        )
    return _dental_clarify_service()
