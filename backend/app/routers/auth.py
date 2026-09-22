import asyncio
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import ProgrammingError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..db import get_db
from ..deps import get_current_user
from ..email import send_registration_code
from ..models.registration_pending import RegistrationPending
from ..models.service_user import ServiceUser
from ..models.user_settings import UserSettings
from ..schemas.auth import (
    LoginRequest,
    MessageResponse,
    RegisterConfirmRequest,
    RegisterRequest,
    RegisterResponse,
    TokenResponse,
    UserPublic,
)
from ..security import (
    create_access_token,
    generate_registration_code,
    hash_password,
    hash_registration_code,
    verify_password,
    verify_registration_code,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _normalize_login(login: str) -> str:
    return login.strip().lower()


@router.post("/register", response_model=RegisterResponse)
async def register(
    payload: RegisterRequest,
    db: AsyncSession = Depends(get_db),
) -> RegisterResponse:
    login_norm = _normalize_login(str(payload.login))

    try:
        existing_user = await db.execute(
            select(ServiceUser).where(func.lower(ServiceUser.login) == login_norm),
        )
        if existing_user.scalar_one_or_none() is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="User with this email already exists",
            )

        pwd_hash = hash_password(payload.password)
        code = generate_registration_code()
        code_h = hash_registration_code(login_norm, code)
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(
            minutes=settings.registration_code_expire_minutes,
        )

        pending_result = await db.execute(
            select(RegistrationPending).where(
                func.lower(RegistrationPending.login) == login_norm,
            ),
        )
        pending = pending_result.scalar_one_or_none()

        if pending is None:
            pending = RegistrationPending(
                login=login_norm,
                password_hash=pwd_hash,
                code_hash=code_h,
                expires_at=expires_at,
                code_attempts=0,
                created_at=now,
            )
            db.add(pending)
        else:
            pending.password_hash = pwd_hash
            pending.code_hash = code_h
            pending.expires_at = expires_at
            pending.code_attempts = 0

        await db.commit()
    except HTTPException:
        await db.rollback()
        raise
    except ProgrammingError as e:
        await db.rollback()
        err = str(e.orig) if getattr(e, "orig", None) else str(e)
        if "registration_pending" in err:
            detail = (
                "Таблица registration_pending не найдена в БД. "
                "Выполните: alembic upgrade head."
            )
        else:
            detail = f"Ошибка PostgreSQL: {err}"
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=detail,
        ) from e
    except SQLAlchemyError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка БД: {e!s}",
        ) from e

    try:
        await asyncio.to_thread(send_registration_code, str(payload.login), code)
    except Exception as e:
        msg = str(e)
        hint = ""
        if "No address associated with hostname" in msg or "Errno -5" in msg:
            hint = (
                " Укажите реальный SMTP_HOST в .env бэкенда (например smtp.yandex.ru для Яндекса). "
                "Плейсхолдер smtp.example.com не резолвится. "
                "Если бэкенд в Docker: проверьте DNS из контейнера (getent hosts $SMTP_HOST)."
            )
        elif "SMTP is not configured" in msg:
            hint = " Заполните SMTP_HOST, SMTP_USER, SMTP_PASSWORD, SMTP_FROM в .env."
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Failed to send email: {msg}.{hint}",
        ) from e

    return RegisterResponse()


@router.post("/register/confirm", response_model=TokenResponse)
async def register_confirm(
    payload: RegisterConfirmRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    login_norm = _normalize_login(str(payload.login))

    result = await db.execute(
        select(RegistrationPending).where(
            func.lower(RegistrationPending.login) == login_norm,
        ),
    )
    pending = result.scalar_one_or_none()
    if pending is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No pending registration for this email",
        )

    now = datetime.now(timezone.utc)
    if pending.expires_at < now:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Registration code expired",
        )

    if pending.code_attempts >= settings.registration_code_max_attempts:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed attempts",
        )

    if not verify_registration_code(login_norm, payload.code, pending.code_hash):
        pending.code_attempts += 1
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid code",
        )

    existing_user = await db.execute(
        select(ServiceUser).where(func.lower(ServiceUser.login) == login_norm),
    )
    if existing_user.scalar_one_or_none() is not None:
        await db.delete(pending)
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User already registered",
        )

    user = ServiceUser(
        login=login_norm,
        password_hash=pending.password_hash,
        first_name=None,
        last_name=None,
        role=settings.default_user_role,
        is_active=True,
        created_at=now,
        updated_at=None,
        deleted_at=None,
    )
    db.add(user)
    await db.flush()
    db.add(UserSettings(user_id=user.id))
    await db.delete(pending)
    await db.commit()
    await db.refresh(user)

    token = create_access_token(user.id, {"role": user.role})
    return TokenResponse(
        access_token=token,
        user=UserPublic.model_validate(user),
    )


@router.post("/login", response_model=TokenResponse)
async def login(
    payload: LoginRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    login_norm = _normalize_login(str(payload.login))

    result = await db.execute(
        select(ServiceUser).where(func.lower(ServiceUser.login) == login_norm),
    )
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    if user.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User inactive",
        )
    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    token = create_access_token(user.id, {"role": user.role})
    return TokenResponse(
        access_token=token,
        user=UserPublic.model_validate(user),
    )


@router.post("/logout", response_model=MessageResponse)
async def logout(
    _: ServiceUser = Depends(get_current_user),
) -> MessageResponse:
    return MessageResponse(detail="logged_out")
