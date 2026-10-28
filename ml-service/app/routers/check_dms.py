"""Проверка назначений ДМС по клиническим рекомендациям."""

import logging

from fastapi import APIRouter, HTTPException

from app.config import settings
from app.schemas import CheckDmsRequest, CheckDmsResponse
from app.services.check_dms.errors import DmsError
from app.services.check_dms.pipeline import verify_appointments

logger = logging.getLogger(__name__)

router = APIRouter(tags=["dms"])


@router.post(
    "/check_dms",
    response_model=CheckDmsResponse,
    summary="Проверка назначений по клиническим рекомендациям",
    description=(
        "Принимает PDF клинрека по presigned-ссылке, код МКБ и текст назначений. "
        "Размечает назначения: лишние — те, что не подтверждаются клиническими рекомендациями."
    ),
)
async def check_dms(request: CheckDmsRequest) -> CheckDmsResponse:
    try:
        return await verify_appointments(request, settings.dms)
    except DmsError as exc:
        logger.info("dms check rejected code=%s status=%s", exc.code, exc.status_code)
        raise HTTPException(
            status_code=exc.status_code,
            detail={"code": exc.code, "message": exc.message},
        ) from exc
    except Exception as exc:
        logger.exception("dms check failed")
        raise HTTPException(
            status_code=500,
            detail={"code": "internal_error", "message": "Внутренняя ошибка проверки"},
        ) from exc
