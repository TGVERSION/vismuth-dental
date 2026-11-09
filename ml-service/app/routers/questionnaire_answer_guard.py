from fastapi import APIRouter, Depends, HTTPException

from app.dependencies.questionnaire_answer_guard import get_questionnaire_answer_guard_service
from app.schemas.questionnaire_answer_guard import (
    QuestionnaireAnswerGuardDecision,
    QuestionnaireAnswerGuardRequest,
)
from app.services.questionnaire_answer_guard import QuestionnaireAnswerGuardService

router = APIRouter(prefix="/questionnaire_answer_guard", tags=["questionnaire_answer_guard"])


@router.post("", response_model=QuestionnaireAnswerGuardDecision)
async def questionnaire_answer_guard(
    request: QuestionnaireAnswerGuardRequest,
    service: QuestionnaireAnswerGuardService = Depends(get_questionnaire_answer_guard_service),
) -> QuestionnaireAnswerGuardDecision:
    try:
        return await service.run(request)
    except Exception:
        # Не логируем исключение модели: оно может включать исходный текст пациента.
        raise HTTPException(status_code=503, detail="Answer validation unavailable") from None
