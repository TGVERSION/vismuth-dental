from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..deps import get_current_user
from ..models.role import Role
from ..models.service_user import ServiceUser
from ..schemas.role import RoleRead

router = APIRouter(prefix="/roles", tags=["roles"])


@router.get(
    "",
    response_model=List[RoleRead],
    summary="Справочник ролей",
    description="Список {name, name_ru} для dropdown на UI.",
)
async def list_roles(
    _: ServiceUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[RoleRead]:
    result = await db.execute(select(Role).order_by(Role.name))
    return list(result.scalars().all())
