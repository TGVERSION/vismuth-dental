import hashlib
import hmac
from datetime import date, datetime, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..models.clinic import Clinic
from ..models.questionnaire import Questionnaire
from ..services.clinic_access import compute_access_status
from ..services.clinic_members import active_doctors_count
from ..services.redis_stream import get_redis_client


def hash_device_id(device_id: str) -> str:
    return hmac.new(
        settings.jwt_secret.encode(),
        f"device:{device_id}".encode(),
        hashlib.sha256,
    ).hexdigest()


def hash_ip(ip: str) -> str:
    return hmac.new(
        settings.jwt_secret.encode(),
        f"ip:{ip}".encode(),
        hashlib.sha256,
    ).hexdigest()


def hash_session_token(token: str) -> str:
    return hmac.new(
        settings.jwt_secret.encode(),
        f"qtoken:{token}".encode(),
        hashlib.sha256,
    ).hexdigest()


def clinic_daily_limit(active_doctors: int) -> int:
    return max(
        active_doctors * settings.questionnaire_clinic_daily_per_doctor,
        settings.questionnaire_clinic_daily_min,
    )


async def _incr_hourly(key: str, limit: int) -> int:
    redis = get_redis_client()
    try:
        count = await redis.incr(key)
        if count == 1:
            await redis.expire(key, 3600)
        return int(count)
    finally:
        await redis.aclose()


async def check_device_limit(device_id: str) -> None:
    key = f"q:device:{hash_device_id(device_id)}"
    count = await _incr_hourly(key, settings.questionnaire_device_limit_per_hour)
    if count > settings.questionnaire_device_limit_per_hour:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "code": "device_limit",
                "message": (
                    "Вы уже заполнили анкету. "
                    "Если нужно ещё - обратитесь в клинику"
                ),
            },
        )


async def check_ip_limit(ip: str) -> None:
    key = f"q:ip:{hash_ip(ip)}"
    count = await _incr_hourly(key, settings.questionnaire_ip_limit_per_hour)
    if count > settings.questionnaire_ip_limit_per_hour:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "code": "ip_limit",
                "message": "Попробуйте позже",
            },
        )


async def count_clinic_questionnaires_today(
    db: AsyncSession,
    clinic_id: UUID,
) -> int:
    start = datetime.now(timezone.utc).replace(
        hour=0,
        minute=0,
        second=0,
        microsecond=0,
    )
    result = await db.execute(
        select(func.count())
        .select_from(Questionnaire)
        .where(
            Questionnaire.clinic_id == clinic_id,
            Questionnaire.created_at >= start,
        ),
    )
    return int(result.scalar_one() or 0)


async def clinic_daily_limit_exceeded(
    db: AsyncSession,
    clinic_id: UUID,
) -> bool:
    doctors = await active_doctors_count(db, clinic_id)
    limit = clinic_daily_limit(doctors)
    count = await count_clinic_questionnaires_today(db, clinic_id)
    return count >= limit


async def check_clinic_daily_limit(db: AsyncSession, clinic: Clinic) -> None:
    if await clinic_daily_limit_exceeded(db, clinic.id):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "clinic_daily_limit",
                "message": (
                    "Сервис временно недоступен. По вопросам записи "
                    f"обращайтесь в клинику по телефону {clinic.phone or '…'}"
                ),
                "phone": clinic.phone,
            },
        )


def ensure_clinic_subscription_active(clinic: Clinic) -> None:
    status_code, _ = compute_access_status(clinic.access_until, clinic.access_type)
    if status_code == "expired":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "subscription_expired",
                "message": (
                    "Сервис временно недоступен. По вопросам записи "
                    f"обращайтесь в клинику по телефону {clinic.phone or '…'}"
                ),
                "phone": clinic.phone,
            },
        )


async def free_codes_ratio(db: AsyncSession, clinic_id: UUID) -> float:
    window_start = datetime.now(timezone.utc) - timedelta(
        days=settings.questionnaire_code_window_days,
    )
    result = await db.execute(
        select(func.count())
        .select_from(Questionnaire)
        .where(
            Questionnaire.clinic_id == clinic_id,
            Questionnaire.code.is_not(None),
            Questionnaire.completed_at.is_not(None),
            Questionnaire.completed_at > window_start,
        ),
    )
    used = int(result.scalar_one() or 0)
    free = max(0, 10000 - used)
    return free / 10000.0
