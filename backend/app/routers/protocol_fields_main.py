from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..deps import require_clinical_user
from ..models.protocol_structure import ProtocolFieldMain
from ..models.service_user import ServiceUser
from ..schemas.protocol_field_main import (
    ProtocolFieldMainListItem,
    ProtocolFieldMainRead,
)

router = APIRouter(prefix="/protocol-fields-main", tags=["protocol-fields-main"])


@router.get(
    "",
    response_model=List[ProtocolFieldMainListItem],
    summary="Список основных полей протоколов",
)
async def list_protocol_fields_main(
    current_user: ServiceUser = Depends(require_clinical_user),
    db: AsyncSession = Depends(get_db),
) -> List[ProtocolFieldMainListItem]:
    _ = current_user
    stmt = (
        select(ProtocolFieldMain)
        .where(ProtocolFieldMain.deleted_at.is_(None))
        .order_by(
            ProtocolFieldMain.updated_at.desc().nulls_last(),
            ProtocolFieldMain.created_at.desc(),
        )
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.get(
    "/{field_id}",
    response_model=ProtocolFieldMainRead,
    summary="Основное поле протокола по id",
)
async def get_protocol_field_main(
    field_id: UUID,
    current_user: ServiceUser = Depends(require_clinical_user),
    db: AsyncSession = Depends(get_db),
) -> ProtocolFieldMainRead:
    _ = current_user
    stmt = select(ProtocolFieldMain).where(
        ProtocolFieldMain.id == field_id,
        ProtocolFieldMain.deleted_at.is_(None),
    )
    result = await db.execute(stmt)
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Protocol field main not found",
        )
    return row
