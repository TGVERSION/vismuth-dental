"""Переиспользование кешируемого клиента сбора анкеты."""

from fastapi import HTTPException

from app.schemas.questionnaire_answer_guard import QuestionnaireAnswerGuardDecision
from app.services.questionnaire_answer_guard import QuestionnaireAnswerGuardService

from .collect_form import get_collect_form_llm


def get_questionnaire_answer_guard_service() -> QuestionnaireAnswerGuardService:
    try:
        llm = get_collect_form_llm()
        return QuestionnaireAnswerGuardService(
            llm.with_structured_output(QuestionnaireAnswerGuardDecision),
        )
    except Exception:
        # Ошибка транспорта/модели может содержать секреты; не переносим её в ответ.
        raise HTTPException(status_code=503, detail="Answer validation unavailable") from None
