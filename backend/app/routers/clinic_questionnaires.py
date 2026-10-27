"""Анкеты пациентов у админа клиники: регистратура создаёт персональные
ссылки, видит статусы, печатает и отмечает подписанные."""

from datetime import date, datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import and_, delete, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..deps import require_clinic_admin
from ..models.clinic_membership import ClinicMembership
from ..models.questionnaire import Questionnaire
from ..models.service_user import ServiceUser
from ..schemas.clinic_questionnaires import (
    RegistryLink,
    RegistryQuestionnaireCreate,
    RegistryQuestionnaireCreated,
    RegistryQuestionnaireDetail,
    RegistryQuestionnaireItem,
    RegistryStatusLiteral,
)
from ..services.clinic_members import get_clinic_or_404
from ..services.questionnaire_invites import (
    create_invite,
    invite_url,
    regenerate_invite_token,
    registry_status,
)

router = APIRouter(tags=["clinic-questionnaires"])

_VISIBLE_STATUSES = ("invited", "in_progress", "completed")

# Статус регистратуры → условие в базе.
_STATUS_FILTERS = {
    "invited": Questionnaire.status == "invited",
    "in_progress": Questionnaire.status == "in_progress",
    "completed": and_(
        Questionnaire.status == "completed",
        Questionnaire.printed_at.is_(None),
        Questionnaire.signed_at.is_(None),
    ),
    "printed": and_(
        Questionnaire.status == "completed",
        Questionnaire.printed_at.is_not(None),
        Questionnaire.signed_at.is_(None),
    ),
    "signed": and_(
        Questionnaire.status == "completed",
        Questionnaire.signed_at.is_not(None),
    ),
}


def _short_name(user: Optional[ServiceUser]) -> Optional[str]:
    if user is None:
        return None
    initials = "".join(
        f"{part[0]}." for part in (user.first_name, user.middle_name) if part
    )
    return " ".join(part for part in (user.last_name, initials) if part) or None


def _item_fields(q: Questionnaire, doctor: Optional[ServiceUser]) -> dict:
    return {
        "id": q.id,
        "status": registry_status(q),
        "patient_last_name": q.patient_last_name,
        "patient_first_name": q.patient_first_name,
        "patient_middle_name": q.patient_middle_name,
        "doctor_membership_id": q.doctor_membership_id,
        "doctor_name": _short_name(doctor),
        "appointment_date": q.appointment_date,
        "appointment_time": q.appointment_time,
        "created_at": q.created_at,
        "completed_at": q.completed_at,
        "printed_at": q.printed_at,
        "signed_at": q.signed_at,
        "invite_expires_at": q.invite_expires_at,
    }


def _base_query(clinic_id: UUID):
    return (
        select(Questionnaire, ServiceUser)
        .outerjoin(
            ClinicMembership,
            ClinicMembership.id == Questionnaire.doctor_membership_id,
        )
        .outerjoin(ServiceUser, ServiceUser.id == ClinicMembership.user_id)
        .where(
            Questionnaire.clinic_id == clinic_id,
            Questionnaire.kind == "dental",
            Questionnaire.invite_expires_at.is_not(None),
            Questionnaire.status.in_(_VISIBLE_STATUSES),
        )
    )


async def _load(
    db: AsyncSession,
    clinic_id: UUID,
    questionnaire_id: UUID,
) -> tuple[Questionnaire, Optional[ServiceUser]]:
    result = await db.execute(
        _base_query(clinic_id).where(Questionnaire.id == questionnaire_id),
    )
    row = result.first()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Questionnaire not found",
        )
    return row[0], row[1]


async def _admin_membership_id(
    db: AsyncSession,
    clinic_id: UUID,
    user: ServiceUser,
) -> Optional[UUID]:
    """Кто создал ссылку. У супер-админа членства в клинике нет — None."""
    result = await db.execute(
        select(ClinicMembership.id).where(
            ClinicMembership.clinic_id == clinic_id,
            ClinicMembership.user_id == user.id,
            ClinicMembership.deleted_at.is_(None),
        ),
    )
    return result.scalar_one_or_none()


def _require_completed(questionnaire: Questionnaire) -> None:
    if questionnaire.status != "completed":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Questionnaire is not completed yet",
        )


@router.post(
    "/clinics/{clinic_id}/questionnaires",
    response_model=RegistryQuestionnaireCreated,
    status_code=status.HTTP_201_CREATED,
    summary="Создать персональную ссылку на анкету",
    description=(
        "ФИО, врач, дата и время приёма → анкета со статусом invited и ссылка. "
        "Только для клиники со стоматологической анкетой. Ссылка показывается один раз."
    ),
)
async def create_registry_questionnaire(
    clinic_id: UUID,
    payload: RegistryQuestionnaireCreate,
    current_user: ServiceUser = Depends(require_clinic_admin),
    db: AsyncSession = Depends(get_db),
) -> RegistryQuestionnaireCreated:
    clinic = await get_clinic_or_404(db, clinic_id)
    questionnaire, token = await create_invite(
        db,
        clinic,
        doctor_membership_id=payload.doctor_membership_id,
        last_name=payload.last_name,
        first_name=payload.first_name,
        middle_name=payload.middle_name,
        appointment_date=payload.appointment_date,
        appointment_time=payload.appointment_time,
        created_by_membership_id=await _admin_membership_id(db, clinic_id, current_user),
    )
    questionnaire, doctor = await _load(db, clinic_id, questionnaire.id)
    return RegistryQuestionnaireCreated(
        **_item_fields(questionnaire, doctor),
        url=invite_url(token),
    )


@router.get(
    "/clinics/{clinic_id}/questionnaires",
    response_model=list[RegistryQuestionnaireItem],
    summary="Анкеты пациентов за день",
    description="По умолчанию — приёмы сегодня. Фильтры: врач, статус, ФИО.",
)
async def list_registry_questionnaires(
    clinic_id: UUID,
    appointment_date: Optional[date] = Query(default=None, alias="date"),
    doctor_membership_id: Optional[UUID] = Query(default=None),
    registry_status_filter: Optional[RegistryStatusLiteral] = Query(
        default=None,
        alias="status",
    ),
    name: Optional[str] = Query(default=None, max_length=255),
    _: ServiceUser = Depends(require_clinic_admin),
    db: AsyncSession = Depends(get_db),
) -> list[RegistryQuestionnaireItem]:
    await get_clinic_or_404(db, clinic_id)
    query = _base_query(clinic_id).where(
        Questionnaire.appointment_date == (appointment_date or date.today()),
    )
    if doctor_membership_id is not None:
        query = query.where(Questionnaire.doctor_membership_id == doctor_membership_id)
    if registry_status_filter is not None:
        query = query.where(_STATUS_FILTERS[registry_status_filter])
    if name and name.strip():
        pattern = f"%{name.strip()}%"
        query = query.where(
            or_(
                Questionnaire.patient_last_name.ilike(pattern),
                Questionnaire.patient_first_name.ilike(pattern),
                Questionnaire.patient_middle_name.ilike(pattern),
            ),
        )
    query = query.order_by(
        Questionnaire.appointment_time,
        Questionnaire.patient_last_name,
    )
    result = await db.execute(query)
    return [
        RegistryQuestionnaireItem(**_item_fields(q, doctor))
        for q, doctor in result.all()
    ]


@router.get(
    "/clinics/{clinic_id}/questionnaires/{questionnaire_id}",
    response_model=RegistryQuestionnaireDetail,
    summary="Анкета пациента: карточка для печати",
)
async def get_registry_questionnaire(
    clinic_id: UUID,
    questionnaire_id: UUID,
    _: ServiceUser = Depends(require_clinic_admin),
    db: AsyncSession = Depends(get_db),
) -> RegistryQuestionnaireDetail:
    questionnaire, doctor = await _load(db, clinic_id, questionnaire_id)
    return RegistryQuestionnaireDetail(
        **_item_fields(questionnaire, doctor),
        structured=questionnaire.structured,
        gaps=questionnaire.gaps,
    )


@router.post(
    "/clinics/{clinic_id}/questionnaires/{questionnaire_id}/link",
    response_model=RegistryLink,
    summary="Выпустить новую ссылку",
    description="Прежняя ссылка перестаёт работать. Нельзя для заполненной или просроченной.",
)
async def regenerate_registry_link(
    clinic_id: UUID,
    questionnaire_id: UUID,
    _: ServiceUser = Depends(require_clinic_admin),
    db: AsyncSession = Depends(get_db),
) -> RegistryLink:
    questionnaire, _doctor = await _load(db, clinic_id, questionnaire_id)
    token = await regenerate_invite_token(db, questionnaire)
    return RegistryLink(url=invite_url(token))


async def _mark(
    db: AsyncSession,
    clinic_id: UUID,
    questionnaire_id: UUID,
    field: str,
) -> RegistryQuestionnaireItem:
    questionnaire, doctor = await _load(db, clinic_id, questionnaire_id)
    _require_completed(questionnaire)
    now = datetime.now(timezone.utc)
    if getattr(questionnaire, field) is None:
        setattr(questionnaire, field, now)
        questionnaire.updated_at = now
        await db.commit()
        await db.refresh(questionnaire)
    return RegistryQuestionnaireItem(**_item_fields(questionnaire, doctor))


@router.post(
    "/clinics/{clinic_id}/questionnaires/{questionnaire_id}/printed",
    response_model=RegistryQuestionnaireItem,
    summary="Отметить анкету распечатанной",
)
async def mark_registry_printed(
    clinic_id: UUID,
    questionnaire_id: UUID,
    _: ServiceUser = Depends(require_clinic_admin),
    db: AsyncSession = Depends(get_db),
) -> RegistryQuestionnaireItem:
    return await _mark(db, clinic_id, questionnaire_id, "printed_at")


@router.post(
    "/clinics/{clinic_id}/questionnaires/{questionnaire_id}/signed",
    response_model=RegistryQuestionnaireItem,
    summary="Отметить анкету подписанной",
)
async def mark_registry_signed(
    clinic_id: UUID,
    questionnaire_id: UUID,
    _: ServiceUser = Depends(require_clinic_admin),
    db: AsyncSession = Depends(get_db),
) -> RegistryQuestionnaireItem:
    return await _mark(db, clinic_id, questionnaire_id, "signed_at")


@router.delete(
    "/clinics/{clinic_id}/questionnaires/{questionnaire_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Удалить ошибочную ссылку",
    description="Только пока анкета не заполнена.",
)
async def delete_registry_questionnaire(
    clinic_id: UUID,
    questionnaire_id: UUID,
    _: ServiceUser = Depends(require_clinic_admin),
    db: AsyncSession = Depends(get_db),
) -> Response:
    await _load(db, clinic_id, questionnaire_id)
    # Условие в самом DELETE: пациент мог дозаполнить анкету между чтением и
    # удалением — заполненную не трогаем.
    result = await db.execute(
        delete(Questionnaire)
        .where(
            Questionnaire.id == questionnaire_id,
            Questionnaire.clinic_id == clinic_id,
            Questionnaire.status.in_(("invited", "in_progress")),
        )
        .returning(Questionnaire.id),
    )
    if result.first() is None:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Completed questionnaire cannot be deleted",
        )
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
