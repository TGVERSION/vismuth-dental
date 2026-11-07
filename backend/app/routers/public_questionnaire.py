import secrets
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..models.clinic import Clinic
from ..models.clinic_membership import ClinicMembership
from ..models.questionnaire import Questionnaire
from ..models.service_user import ServiceUser
from ..schemas.questionnaire import (
    PublicInviteResponse,
    PublicLinkDoctor,
    PublicLinkResponse,
    QuestionnaireAnswerRequest,
    QuestionnaireCreateRequest,
    QuestionnaireCreateResponse,
    StepDescriptorResponse,
)
from ..services.clinic_access import compute_access_status
from ..services.clinic_members import load_specializations_map
from ..services.questionnaire_flow import (
    apply_answer,
    build_step_descriptor,
    list_active_doctors,
    resolve_initial_step,
)
from ..services.questionnaire_limits import (
    check_clinic_daily_limit,
    check_device_limit,
    check_ip_limit,
    clinic_daily_limit_exceeded,
    ensure_clinic_subscription_active,
    hash_device_id,
    hash_ip,
    hash_session_token,
)
from ..services.questionnaire_invites import find_by_invite_token, is_invite_expired
from ..services.questionnaire_process import schedule_processing
from ..services.gastro_questionnaire import run_gastro_clarification

router = APIRouter(prefix="/public", tags=["public-questionnaire"])


INVITE_ONLY = "invite_only"


def _invite_only_message(clinic: Clinic) -> str:
    return (
        "Анкету клиника присылает ссылкой при записи. Если ссылки нет — "
        f"позвоните в клинику по телефону {clinic.phone or '…'}"
    )


def _client_ip(request: Request) -> str:
    from ..config import settings

    if settings.trust_proxy:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def _step_response(descriptor) -> StepDescriptorResponse:
    return StepDescriptorResponse(
        step_key=descriptor.step_key,
        step_type=descriptor.step_type,
        title=descriptor.title,
        text=descriptor.text,
        required=descriptor.required,
        allow_skip=descriptor.allow_skip,
        allow_none=descriptor.allow_none,
        choices=descriptor.choices,
        options=descriptor.options,
        groups=descriptor.groups,
        date_min=descriptor.date_min,
        date_max=descriptor.date_max,
        code=descriptor.code,
        completed=descriptor.completed,
        truncated=descriptor.truncated,
        ai_unavailable=descriptor.ai_unavailable,
        gastro=descriptor.gastro,
        dental=descriptor.dental,
    )


async def _resolve_slug(
    db: AsyncSession,
    slug: str,
) -> tuple[Clinic, ClinicMembership | None]:
    clinic_result = await db.execute(
        select(Clinic).where(
            Clinic.public_slug == slug,
            Clinic.deleted_at.is_(None),
        ),
    )
    clinic = clinic_result.scalar_one_or_none()
    if clinic is not None:
        return clinic, None

    membership_result = await db.execute(
        select(ClinicMembership, Clinic)
        .join(Clinic, Clinic.id == ClinicMembership.clinic_id)
        .where(
            ClinicMembership.public_slug == slug,
            ClinicMembership.deleted_at.is_(None),
            Clinic.deleted_at.is_(None),
        ),
    )
    row = membership_result.first()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Link not found",
        )
    membership, clinic = row
    return clinic, membership


async def _doctor_payload(
    db: AsyncSession,
    membership: ClinicMembership,
) -> PublicLinkDoctor:
    user_result = await db.execute(
        select(ServiceUser).where(ServiceUser.id == membership.user_id),
    )
    user = user_result.scalar_one()
    membership_map, _ = await load_specializations_map(
        db,
        membership_ids=[membership.id],
    )
    return PublicLinkDoctor(
        membership_id=membership.id,
        public_slug=membership.public_slug,
        photo_url=membership.photo_url,
        first_name=user.first_name,
        last_name=user.last_name,
        middle_name=user.middle_name,
        specializations=membership_map.get(membership.id, []),
    )


@router.get(
    "/links/{slug}",
    response_model=PublicLinkResponse,
    summary="Публичная ссылка клиники или врача",
    description=(
        "Без JWT. Ищет slug в clinic.public_slug или membership.public_slug. "
        "При блокировке: blocked + block_code (subscription_expired | clinic_daily_limit | "
        "doctor_inactive | invite_only — у стоматологической клиники анкета только по "
        "персональной ссылке)."
    ),
)
async def get_public_link(
    slug: str,
    db: AsyncSession = Depends(get_db),
) -> PublicLinkResponse:
    clinic, membership = await _resolve_slug(db, slug)
    status_code, _ = compute_access_status(clinic.access_until, clinic.access_type)

    doctors_raw = await list_active_doctors(db, clinic.id)
    doctors = [
        PublicLinkDoctor(
            membership_id=UUID(d["membership_id"]),
            public_slug=d["public_slug"],
            photo_url=d["photo_url"],
            first_name=d["first_name"],
            last_name=d["last_name"],
            middle_name=d["middle_name"],
            specializations=d["specializations"],
        )
        for d in doctors_raw
    ]

    if clinic.questionnaire_kind == "dental":
        return PublicLinkResponse(
            link_type="doctor" if membership else "clinic",
            clinic_id=clinic.id,
            clinic_name=clinic.name,
            phone=clinic.phone,
            logo_url=clinic.logo_url,
            brand_color=clinic.brand_color,
            clinic_public_slug=clinic.public_slug,
            blocked=True,
            block_code=INVITE_ONLY,
            block_message=_invite_only_message(clinic),
        )

    if status_code == "expired":
        return PublicLinkResponse(
            link_type="doctor" if membership else "clinic",
            clinic_id=clinic.id,
            clinic_name=clinic.name,
            phone=clinic.phone,
            logo_url=clinic.logo_url,
            brand_color=clinic.brand_color,
            clinic_public_slug=clinic.public_slug,
            doctors=doctors,
            blocked=True,
            block_code="subscription_expired",
            block_message=(
                "Сервис временно недоступен. По вопросам записи "
                f"обращайтесь в клинику по телефону {clinic.phone or '…'}"
            ),
        )

    if await clinic_daily_limit_exceeded(db, clinic.id):
        return PublicLinkResponse(
            link_type="doctor" if membership else "clinic",
            clinic_id=clinic.id,
            clinic_name=clinic.name,
            phone=clinic.phone,
            logo_url=clinic.logo_url,
            brand_color=clinic.brand_color,
            clinic_public_slug=clinic.public_slug,
            doctors=doctors,
            blocked=True,
            block_code="clinic_daily_limit",
            block_message=(
                "Сервис временно недоступен. По вопросам записи "
                f"обращайтесь в клинику по телефону {clinic.phone or '…'}"
            ),
        )

    if membership is not None:
        if membership.status != "active" or not membership.is_doctor:
            return PublicLinkResponse(
                link_type="doctor",
                clinic_id=clinic.id,
                clinic_name=clinic.name,
                phone=clinic.phone,
                logo_url=clinic.logo_url,
                brand_color=clinic.brand_color,
                clinic_public_slug=clinic.public_slug,
                doctors=doctors,
                blocked=True,
                block_code="doctor_inactive",
                block_message="Врач не ведет прием, выберите другого",
            )
        doctor = await _doctor_payload(db, membership)
        return PublicLinkResponse(
            link_type="doctor",
            clinic_id=clinic.id,
            clinic_name=clinic.name,
            phone=clinic.phone,
            logo_url=clinic.logo_url,
            brand_color=clinic.brand_color,
            clinic_public_slug=clinic.public_slug,
            doctor=doctor,
            doctors=doctors,
        )

    return PublicLinkResponse(
        link_type="clinic",
        clinic_id=clinic.id,
        clinic_name=clinic.name,
        phone=clinic.phone,
        logo_url=clinic.logo_url,
        brand_color=clinic.brand_color,
        clinic_public_slug=clinic.public_slug,
        doctors=doctors,
    )


@router.post(
    "/questionnaires",
    response_model=QuestionnaireCreateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Начать публичную анкету",
    description=(
        "Требует X-Device-Id. Проверки: подписка, суточный лимит клиники, "
        "лимиты device/IP. Возвращает id, session token и первый step."
    ),
)
async def create_questionnaire(
    payload: QuestionnaireCreateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    x_device_id: Optional[str] = Header(
        default=None,
        alias="X-Device-Id",
        description="Стабильный ID устройства клиента (обязателен).",
    ),
) -> QuestionnaireCreateResponse:
    if not x_device_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="X-Device-Id header required",
        )

    clinic, membership = await _resolve_slug(db, payload.slug)
    if clinic.questionnaire_kind == "dental":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": INVITE_ONLY, "message": _invite_only_message(clinic)},
        )
    ensure_clinic_subscription_active(clinic)
    await check_clinic_daily_limit(db, clinic)
    await check_device_limit(x_device_id)
    await check_ip_limit(_client_ip(request))

    doctor_membership = membership
    if payload.doctor_membership_id is not None:
        result = await db.execute(
            select(ClinicMembership).where(
                ClinicMembership.id == payload.doctor_membership_id,
                ClinicMembership.clinic_id == clinic.id,
                ClinicMembership.is_doctor.is_(True),
                ClinicMembership.status == "active",
                ClinicMembership.deleted_at.is_(None),
            ),
        )
        doctor_membership = result.scalar_one_or_none()
        if doctor_membership is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Doctor not available",
            )

    if membership is not None and membership.status != "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "doctor_inactive",
                "message": "Врач не ведет прием, выберите другого",
            },
        )

    raw_token = secrets.token_urlsafe(32)
    questionnaire = Questionnaire(
        clinic_id=clinic.id,
        doctor_membership_id=doctor_membership.id if doctor_membership else None,
        session_token_hash=hash_session_token(raw_token),
        device_id_hash=hash_device_id(x_device_id),
        ip_hash=hash_ip(_client_ip(request)),
        current_step="choose_doctor",
    )
    db.add(questionnaire)
    await db.flush()

    doctor_preselected = doctor_membership is not None
    questionnaire.current_step = await resolve_initial_step(
        db,
        questionnaire,
        doctor_preselected=doctor_preselected,
    )
    await db.commit()
    await db.refresh(questionnaire)

    descriptor = await build_step_descriptor(db, questionnaire)
    return QuestionnaireCreateResponse(
        id=questionnaire.id,
        token=raw_token,
        step=_step_response(descriptor),
    )


async def _load_questionnaire_for_token(
    db: AsyncSession,
    questionnaire_id: UUID,
    token: str | None,
    *, lock: bool = False,
) -> Questionnaire:
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="X-Questionnaire-Token required",
        )
    statement = select(Questionnaire).where(Questionnaire.id == questionnaire_id)
    if lock:
        statement = statement.with_for_update()
    result = await db.execute(statement)
    questionnaire = result.scalar_one_or_none()
    if questionnaire is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Questionnaire not found",
        )
    if questionnaire.session_token_hash != hash_session_token(token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid questionnaire token",
        )
    return questionnaire


@router.get(
    "/questionnaires/{questionnaire_id}/step",
    response_model=StepDescriptorResponse,
    summary="Текущий шаг анкеты",
    description="Дескриптор шага (тип, текст, choices). Auth: X-Questionnaire-Token.",
)
async def get_step(
    questionnaire_id: UUID,
    db: AsyncSession = Depends(get_db),
    x_questionnaire_token: Optional[str] = Header(
        default=None,
        alias="X-Questionnaire-Token",
        description="Сессионный token из POST /public/questionnaires.",
    ),
) -> StepDescriptorResponse:
    questionnaire = await _load_questionnaire_for_token(
        db,
        questionnaire_id,
        x_questionnaire_token,
    )
    # Existing sessions waiting on the removed selector resume as primary visits.
    # Recheck after a row lock, so a concurrently accepted answer is never reset.
    if questionnaire.kind == "general" and questionnaire.current_step == "visit_type":
        await db.refresh(questionnaire, with_for_update=True)
        if questionnaire.kind == "general" and questionnaire.current_step == "visit_type":
            questionnaire.visit_type = "primary"
            questionnaire.current_step = "complaint"
            await db.commit()
    descriptor = await build_step_descriptor(db, questionnaire)
    return _step_response(descriptor)


@router.post(
    "/questionnaires/{questionnaire_id}/answer",
    response_model=StepDescriptorResponse,
    summary="Ответить на шаг анкеты",
    description=(
        "Валидирует step_key, сохраняет ответ, возвращает следующий дескриптор. "
        "На финале patient_info выдает code и ставит фоновую summarize_form."
    ),
)
async def post_answer(
    questionnaire_id: UUID,
    payload: QuestionnaireAnswerRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    x_questionnaire_token: Optional[str] = Header(
        default=None,
        alias="X-Questionnaire-Token",
        description="Сессионный token из POST /public/questionnaires.",
    ),
) -> StepDescriptorResponse:
    questionnaire = await _load_questionnaire_for_token(
        db,
        questionnaire_id,
        x_questionnaire_token,
        lock=True,
    )
    descriptor, _, should_process = await apply_answer(
        db,
        questionnaire,
        step_key=payload.step_key,
        value=payload.value,
        choice=payload.choice,
        skip=payload.skip,
        doctor_membership_id=payload.doctor_membership_id,
        specialization_id=payload.specialization_id,
        first_name=payload.first_name,
        middle_name=payload.middle_name,
        appointment_date=payload.appointment_date,
        appointment_time=payload.appointment_time,
        none_answer=payload.none,
        selections=payload.selections,
        texts=payload.texts,
        revision=payload.revision,
    )
    if should_process:
        schedule_processing(background_tasks, questionnaire_id)
    if questionnaire.kind == "gastro" and questionnaire.current_step == "gastro_ai_wait":
        background_tasks.add_task(run_gastro_clarification, questionnaire_id, questionnaire.gastro_answers["revision"])
    return _step_response(descriptor)


@router.get(
    "/invites/{token}",
    response_model=PublicInviteResponse,
    summary="Открыть персональную ссылку на анкету",
    description=(
        "Без JWT: токен ссылки сам по себе. Приветствие по имени, "
        "брендинг и текущий шаг. Дальше — /public/questionnaires/{id}/step и "
        "/answer с этим же токеном в X-Questionnaire-Token. "
        "blocked + block_code: invite_expired | subscription_expired."
    ),
)
async def get_invite(
    token: str,
    db: AsyncSession = Depends(get_db),
) -> PublicInviteResponse:
    questionnaire = await find_by_invite_token(db, token)
    if questionnaire is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "invite_not_found", "message": "Ссылка не найдена"},
        )
    clinic = (
        await db.execute(select(Clinic).where(Clinic.id == questionnaire.clinic_id))
    ).scalar_one()

    block_code, block_message = _invite_block(questionnaire, clinic)
    step = None
    if block_code is None:
        step = _step_response(await build_step_descriptor(db, questionnaire))
    return PublicInviteResponse(
        questionnaire_id=questionnaire.id,
        clinic_name=clinic.name,
        phone=clinic.phone,
        logo_url=clinic.logo_url,
        brand_color=clinic.brand_color,
        patient_first_name=questionnaire.patient_first_name,
        patient_middle_name=questionnaire.patient_middle_name,
        blocked=block_code is not None,
        block_code=block_code,
        block_message=block_message,
        step=step,
    )


def _invite_block(
    questionnaire: Questionnaire,
    clinic: Clinic,
) -> tuple[Optional[str], Optional[str]]:
    """Заполненную анкету показываем всегда; начатую даём закончить при истёкшей
    подписке, как в общей анкете; просроченную ссылку — нет."""
    if questionnaire.status == "completed":
        return None, None
    phone = clinic.phone or "…"
    if is_invite_expired(questionnaire, datetime.now(timezone.utc)):
        return (
            "invite_expired",
            f"Ссылка устарела. Попросите новую в клинике по телефону {phone}",
        )
    access, _ = compute_access_status(clinic.access_until, clinic.access_type)
    if access == "expired" and questionnaire.status == "invited":
        return (
            "subscription_expired",
            "Сервис временно недоступен. По вопросам записи "
            f"обращайтесь в клинику по телефону {phone}",
        )
    return None, None
