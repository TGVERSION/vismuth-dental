"""Общий OpenAI-совместимый транспорт DENTAL_LLM_*, отдельный гастроprompt."""
from functools import lru_cache

from fastapi import HTTPException
from langchain_openai import ChatOpenAI

from app.config import settings
from app.schemas.gastro_clarify import GastroDecision
from app.services.gastro_clarify import GastroClarifyService


@lru_cache(maxsize=1)
def _service() -> GastroClarifyService:
    config = settings.dental_llm
    llm = ChatOpenAI(base_url=config.base_url, api_key=config.api_key, model=config.model, temperature=config.temperature, max_tokens=config.max_tokens, timeout=config.timeout, max_retries=0, extra_body={"chat_template_kwargs": {"enable_thinking": False}} if config.disable_thinking else None)
    return GastroClarifyService(llm.with_structured_output(GastroDecision, method=config.structured_method))


def get_gastro_clarify_service() -> GastroClarifyService:
    if not settings.dental_llm.base_url:
        raise HTTPException(status_code=503, detail="Gastro clarification model is not configured")
    return _service()
