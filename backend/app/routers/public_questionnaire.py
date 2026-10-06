import secrets
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
from ..services.questionnaire_process import schedule_processing

router = APIRouter(prefix="/public", tags=["public-questionnaire"])


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
        date_min=descriptor.date_min,
        date_max=descriptor.date_max,
        code=descriptor.code,
        completed=descriptor.completed,
        truncated=descriptor.truncated,
        ai_unavailable=descriptor.ai_unavailable,
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


@router.get("/links/{slug}", response_model=PublicLinkResponse)
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
                block_message="Врач не ведёт приём, выберите другого",
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
)
async def create_questionnaire(
    payload: QuestionnaireCreateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    x_device_id: Optional[str] = Header(default=None, alias="X-Device-Id"),
) -> QuestionnaireCreateResponse:
    if not x_device_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="X-Device-Id header required",
        )

    clinic, membership = await _resolve_slug(db, payload.slug)
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
                "message": "Врач не ведёт приём, выберите другого",
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
) -> Questionnaire:
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="X-Questionnaire-Token required",
        )
    result = await db.execute(
        select(Questionnaire).where(Questionnaire.id == questionnaire_id),
    )
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
)
async def get_step(
    questionnaire_id: UUID,
    db: AsyncSession = Depends(get_db),
    x_questionnaire_token: Optional[str] = Header(
        default=None,
        alias="X-Questionnaire-Token",
    ),
) -> StepDescriptorResponse:
    questionnaire = await _load_questionnaire_for_token(
        db,
        questionnaire_id,
        x_questionnaire_token,
    )
    descriptor = await build_step_descriptor(db, questionnaire)
    return _step_response(descriptor)


@router.post(
    "/questionnaires/{questionnaire_id}/answer",
    response_model=StepDescriptorResponse,
)
async def post_answer(
    questionnaire_id: UUID,
    payload: QuestionnaireAnswerRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    x_questionnaire_token: Optional[str] = Header(
        default=None,
        alias="X-Questionnaire-Token",
    ),
) -> StepDescriptorResponse:
    questionnaire = await _load_questionnaire_for_token(
        db,
        questionnaire_id,
        x_questionnaire_token,
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
    )
    if should_process:
        schedule_processing(background_tasks, questionnaire_id)
    return _step_response(descriptor)
