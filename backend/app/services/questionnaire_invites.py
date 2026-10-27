"""Персональная ссылка на анкету, которую создаёт регистратура (админ клиники).

Анкета создаётся заранее со статусом `invited`: ФИО, врач, дата и время
приёма уже известны, пациент только отвечает на вопросы. Токен ссылки — это
сессионный токен анкеты: в базе лежит только хэш, поэтому показать ссылку
повторно нельзя — можно выпустить новую (старая перестаёт работать).
"""

from __future__ import annotations

import secrets
from datetime import date, datetime, time, timedelta, timezone
from typing import Any, Literal, Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..models.clinic import Clinic
from ..models.clinic_membership import ClinicMembership
from ..models.questionnaire import Questionnaire
from .dental.flow import FIRST_STEP as DENTAL_FIRST_STEP
from .questionnaire_flow import doctor_specializations, is_valid_appointment_time
from .questionnaire_limits import ensure_clinic_subscription_active, hash_session_token

# Ссылка работает до конца следующего дня после приёма.
INVITE_DAYS_AFTER_APPOINTMENT = 2
NAME_MAX_LEN = 255

RegistryStatus = Literal["invited", "in_progress", "completed", "printed", "signed"]


class InviteInputError(ValueError):
    """Неверные данные приглашения: текст уходит клиенту как 400."""


def invite_expires_at(appointment_date: date) -> datetime:
    day = appointment_date + timedelta(days=INVITE_DAYS_AFTER_APPOINTMENT)
    return datetime.combine(day, time.min, tzinfo=timezone.utc)


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


def validate_appointment(
    appointment_date: date,
    appointment_time: str,
    *,
    today: date,
    days_ahead: int,
) -> None:
    if appointment_date < today or appointment_date > today + timedelta(days=days_ahead):
        raise InviteInputError(f"Дата приёма — от сегодня до {days_ahead} дней вперёд")
    if not is_valid_appointment_time(appointment_time):
        raise InviteInputError("Время приёма в формате ЧЧ:ММ")


def invite_url(token: str) -> str:
    return f"{settings.frontend_public_url.rstrip('/')}/q/i/{token}"


def _bad_request(exc: InviteInputError) -> HTTPException:
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


async def _active_doctor(
    db: AsyncSession,
    clinic_id: UUID,
    membership_id: UUID,
) -> ClinicMembership:
    result = await db.execute(
        select(ClinicMembership).where(
            ClinicMembership.id == membership_id,
            ClinicMembership.clinic_id == clinic_id,
            ClinicMembership.is_doctor.is_(True),
            ClinicMembership.status == "active",
            ClinicMembership.deleted_at.is_(None),
        ),
    )
    membership = result.scalar_one_or_none()
    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Doctor not available",
        )
    return membership


async def create_invite(
    db: AsyncSession,
    clinic: Clinic,
    *,
    doctor_membership_id: UUID,
    last_name: str,
    first_name: str,
    middle_name: Optional[str],
    appointment_date: date,
    appointment_time: str,
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
        validate_appointment(
            appointment_date,
            appointment_time,
            today=date.today(),
            days_ahead=settings.questionnaire_appointment_days_ahead,
        )
    except InviteInputError as exc:
        raise _bad_request(exc) from exc

    # Суточный лимит клиники защищает от анонимных стартов; ссылки создаёт
    # сотрудник под своим входом — их не ограничиваем.
    ensure_clinic_subscription_active(clinic)
    doctor = await _active_doctor(db, clinic.id, doctor_membership_id)
    specs = await doctor_specializations(db, doctor.id)

    raw_token = secrets.token_urlsafe(32)
    questionnaire = Questionnaire(
        clinic_id=clinic.id,
        doctor_membership_id=doctor.id,
        specialization_id=specs[0]["id"] if len(specs) == 1 else None,
        kind="dental",
        visit_type="primary",
        status="invited",
        current_step=DENTAL_FIRST_STEP,
        patient_last_name=last,
        patient_first_name=first,
        patient_middle_name=middle,
        appointment_date=appointment_date,
        appointment_time=appointment_time,
        invite_expires_at=invite_expires_at(appointment_date),
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
