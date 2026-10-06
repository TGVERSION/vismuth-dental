"""Opaque refresh tokens: hash in DB, raw value only in httpOnly cookie."""

from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Literal
from uuid import UUID

from fastapi import Response
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..models.refresh_token import RefreshToken
from ..models.service_user import ServiceUser
from .roles import user_role_load_options

SameSite = Literal["lax", "strict", "none"]


class RefreshTokenError(Exception):
    """Invalid, expired, or reused refresh token."""


def hash_refresh_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def _cookie_samesite() -> SameSite:
    value = settings.refresh_cookie_samesite
    if value in ("lax", "strict", "none"):
        return value  # type: ignore[return-value]
    return "lax"


def set_refresh_cookie(response: Response, raw_token: str) -> None:
    max_age = settings.refresh_token_expire_days * 24 * 60 * 60
    response.set_cookie(
        key=settings.refresh_cookie_name,
        value=raw_token,
        max_age=max_age,
        expires=max_age,
        path=settings.refresh_cookie_path,
        httponly=True,
        secure=settings.refresh_cookie_secure,
        samesite=_cookie_samesite(),
    )


def clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.refresh_cookie_name,
        path=settings.refresh_cookie_path,
        httponly=True,
        secure=settings.refresh_cookie_secure,
        samesite=_cookie_samesite(),
    )


async def issue_refresh_token(
    db: AsyncSession,
    user_id: UUID,
) -> tuple[str, RefreshToken]:
    raw = secrets.token_urlsafe(32)
    now = datetime.now(timezone.utc)
    row = RefreshToken(
        user_id=user_id,
        token_hash=hash_refresh_token(raw),
        expires_at=now + timedelta(days=settings.refresh_token_expire_days),
        created_at=now,
    )
    db.add(row)
    await db.flush()
    return raw, row


async def revoke_all_for_user(db: AsyncSession, user_id: UUID) -> None:
    now = datetime.now(timezone.utc)
    await db.execute(
        update(RefreshToken)
        .where(
            RefreshToken.user_id == user_id,
            RefreshToken.revoked_at.is_(None),
        )
        .values(revoked_at=now),
    )


async def revoke_refresh_token(db: AsyncSession, raw: str) -> None:
    token_hash = hash_refresh_token(raw)
    result = await db.execute(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash),
    )
    row = result.scalar_one_or_none()
    if row is None or row.revoked_at is not None:
        return
    row.revoked_at = datetime.now(timezone.utc)
    await db.flush()


async def rotate_refresh_token(
    db: AsyncSession,
    raw: str,
) -> tuple[ServiceUser, str]:
    """Validate cookie token, rotate (revoke old + issue new), return user + new raw.

    If a revoked token is presented again (reuse), revoke all sessions for that user.
    """
    token_hash = hash_refresh_token(raw)
    result = await db.execute(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash),
    )
    row = result.scalar_one_or_none()
    now = datetime.now(timezone.utc)

    if row is None:
        raise RefreshTokenError("unknown_token")

    if row.revoked_at is not None:
        await revoke_all_for_user(db, row.user_id)
        await db.flush()
        raise RefreshTokenError("token_reuse")

    if row.expires_at < now:
        row.revoked_at = now
        await db.flush()
        raise RefreshTokenError("expired")

    user_result = await db.execute(
        select(ServiceUser)
        .options(*user_role_load_options())
        .where(ServiceUser.id == row.user_id),
    )
    user = user_result.scalar_one_or_none()
    if (
        user is None
        or user.deleted_at is not None
        or not user.is_active
    ):
        row.revoked_at = now
        await db.flush()
        raise RefreshTokenError("user_inactive")

    new_raw, new_row = await issue_refresh_token(db, user.id)
    row.revoked_at = now
    row.replaced_by_id = new_row.id
    await db.flush()
    return user, new_raw
