"""Проверка назначений ДМС по клиническим рекомендациям."""

import logging
from typing import Annotated

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.config import settings
from app.schemas import CheckDmsForm, CheckDmsResponse
from app.services.check_dms.errors import DmsError
from app.services.check_dms.pipeline import verify_appointments
from app.services.check_dms.upload import read_pdf_upload

logger = logging.getLogger(__name__)

router = APIRouter(tags=["dms"])


def build_form(mkb: str, appointments: str) -> CheckDmsForm:
    """Собирает валидированную форму из multipart-полей."""
    cleaned_mkb = mkb.strip()
    cleaned_appointments = appointments.strip()
    if not cleaned_mkb or not cleaned_appointments:
        raise DmsError(
            "invalid_request",
            "Поля mkb и appointments обязательны и не могут быть пустыми",
            400,
        )
    return CheckDmsForm(mkb=cleaned_mkb, appointments=cleaned_appointments)


@router.post(
    "/check_dms",
    response_model=CheckDmsResponse,
    summary="Проверка назначений по клиническим рекомендациям",
    description=(
        "Принимает PDF клинических рекомендаций файлом (до 30 МБ), код МКБ и текст назначений. "
        "Размечает назначения: лишние — те, что не подтверждаются клиническими рекомендациями."
    ),
)
async def check_dms(
    file: Annotated[UploadFile, File(description="PDF клинических рекомендаций, до 30 МБ")],
    mkb: Annotated[str, Form(max_length=255, description="Код МКБ и название диагноза")],
    appointments: Annotated[str, Form(max_length=4000, description="Назначения врача")],
) -> CheckDmsResponse:
    try:
        form = build_form(mkb, appointments)
        content, file_hash = await read_pdf_upload(file, settings.dms)
        return await verify_appointments(content, file_hash, form, settings.dms)
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
