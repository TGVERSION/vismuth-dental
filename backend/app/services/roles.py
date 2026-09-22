from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models.role import ALLOWED_ROLE_NAMES, Role, ServiceUserRole
from ..models.service_user import ServiceUser


def user_role_load_options():
    return (
        selectinload(ServiceUser.user_role_link).selectinload(ServiceUserRole.role),
    )


async def get_role_by_name(db: AsyncSession, role_name: str) -> Role:
    if role_name not in ALLOWED_ROLE_NAMES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown role: {role_name}",
        )
    result = await db.execute(select(Role).where(Role.name == role_name))
    role = result.scalar_one_or_none()
    if role is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown role: {role_name}",
        )
    return role


async def set_user_role(
    db: AsyncSession,
    user: ServiceUser,
    role_name: str,
) -> None:
    role = await get_role_by_name(db, role_name)
    if user.user_role_link is None:
        user.user_role_link = ServiceUserRole(user_id=user.id, role_id=role.id)
        user.user_role_link.role = role
    else:
        user.user_role_link.role_id = role.id
        user.user_role_link.role = role


def user_has_any_role(user: ServiceUser, *role_names: str) -> bool:
    return user.role in role_names
