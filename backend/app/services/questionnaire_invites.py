"""Персональная ссылка на анкету, которую создаёт регистратура (админ клиники).

Анкета создаётся заранее со статусом `invited`: регистратура вводит только
ФИО, пациент отвечает на вопросы. Как и бумажная анкета, она не привязана ни к
врачу, ни к дате приёма. Токен ссылки — это
сессионный токен анкеты: в базе лежит только хэш, поэтому показать ссылку
повторно нельзя — можно выпустить новую (старая перестаёт работать).
"""

from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Literal, Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..models.clinic import Clinic
from ..models.questionnaire import Questionnaire
from .dental.flow import FIRST_STEP as DENTAL_FIRST_STEP
from .questionnaire_limits import ensure_clinic_subscription_active, hash_session_token

# Сколько дней после создания работает ссылка.
INVITE_TTL_DAYS = 7
NAME_MAX_LEN = 255

RegistryStatus = Literal["invited", "in_progress", "completed", "printed", "signed"]


class InviteInputError(ValueError):
    """Неверные данные приглашения: текст уходит клиенту как 400."""


def invite_expires_at(created_at: datetime) -> datetime:
    return created_at + timedelta(days=INVITE_TTL_DAYS)


def is_invite_expired(questionnaire: Any, now: datetime) -> bool:
    expires = questionnaire.invite_expires_at
    return expires is not None and now >= expires


def registry_status(questionnaire: Any) -> RegistryStatus:
    """Статус в списке регистратуры: печать и подпись — поверх «заполнена»."""
    if questionnaire.status != "completed":
        return "invited" if questionnaire.status == "invited" else "in_progress"
    if questionnaire.signed_at is not None:
        return "signed"
    if questionnaire.printed_at is not None:
        return "printed"
    return "completed"


def clean_patient_name(
    last_name: Optional[str],
    first_name: Optional[str],
    middle_name: Optional[str],
) -> tuple[str, str, Optional[str]]:
    last = (last_name or "").strip()[:NAME_MAX_LEN]
    first = (first_name or "").strip()[:NAME_MAX_LEN]
    middle = (middle_name or "").strip()[:NAME_MAX_LEN] or None
    if not last or not first:
        raise InviteInputError("Фамилия и имя пациента обязательны")
    return last, first, middle


def invite_url(token: str) -> str:
    return f"{settings.frontend_public_url.rstrip('/')}/q/i/{token}"


def _bad_request(exc: InviteInputError) -> HTTPException:
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


async def create_invite(
    db: AsyncSession,
    clinic: Clinic,
    *,
    last_name: str,
    first_name: str,
    middle_name: Optional[str],
    created_by_membership_id: Optional[UUID],
) -> tuple[Questionnaire, str]:
    """Создаёт анкету по персональной ссылке; возвращает её и токен ссылки."""
    if clinic.questionnaire_kind != "dental":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Personal links are available for dental questionnaire only",
        )
    try:
        last, first, middle = clean_patient_name(last_name, first_name, middle_name)
    except InviteInputError as exc:
        raise _bad_request(exc) from exc

    # Суточный лимит клиники защищает от анонимных стартов; ссылки создаёт
    # сотрудник под своим входом — их не ограничиваем.
    ensure_clinic_subscription_active(clinic)

    raw_token = secrets.token_urlsafe(32)
    questionnaire = Questionnaire(
        clinic_id=clinic.id,
        kind="dental",
        visit_type="primary",
        status="invited",
        current_step=DENTAL_FIRST_STEP,
        patient_last_name=last,
        patient_first_name=first,
        patient_middle_name=middle,
        invite_expires_at=invite_expires_at(datetime.now(timezone.utc)),
        created_by_membership_id=created_by_membership_id,
        session_token_hash=hash_session_token(raw_token),
    )
    db.add(questionnaire)
    await db.commit()
    await db.refresh(questionnaire)
    return questionnaire, raw_token


async def regenerate_invite_token(db: AsyncSession, questionnaire: Questionnaire) -> str:
    """Новая ссылка вместо старой: прежний токен перестаёт работать."""
    if questionnaire.status not in {"invited", "in_progress"}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Questionnaire is already completed",
        )
    if is_invite_expired(questionnaire, datetime.now(timezone.utc)):
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Invite expired",
        )
    raw_token = secrets.token_urlsafe(32)
    questionnaire.session_token_hash = hash_session_token(raw_token)
    questionnaire.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return raw_token


async def find_by_invite_token(db: AsyncSession, token: str) -> Optional[Questionnaire]:
    result = await db.execute(
        select(Questionnaire).where(
            Questionnaire.session_token_hash == hash_session_token(token),
            Questionnaire.invite_expires_at.is_not(None),
            Questionnaire.status.in_(("invited", "in_progress", "completed")),
        ),
    )
    return result.scalar_one_or_none()
