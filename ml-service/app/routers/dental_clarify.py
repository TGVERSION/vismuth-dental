import logging

from fastapi import APIRouter, Depends, HTTPException, status

from app.dependencies.dental_clarify import get_dental_clarify_service
from app.schemas.dental_clarify import DentalClarifyAnswer, DentalClarifyRequest
from app.services.dental_clarify import DentalClarifyService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/dental_clarify", tags=["dental_clarify"])


@router.post("", response_model=DentalClarifyAnswer)
async def dental_clarify(
    request: DentalClarifyRequest,
    service: DentalClarifyService = Depends(get_dental_clarify_service),
) -> DentalClarifyAnswer:
    try:
        return await service.run(request)
    except Exception as exc:
        # Сбой модели — не ошибка анкеты: backend пропустит уточнение.
        logger.exception("dental clarify failed")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Dental clarify model failed",
        ) from exc
