from datetime import datetime, timezone
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_, delete, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..deps import get_current_user
from ..models.protocol_template import ProtocolTemplate, ProtocolTemplateField
from ..models.service_user import ServiceUser
from ..models.template_group import TemplateGroup
from ..schemas.protocol_template import (
    ProtocolPrivacy,
    ProtocolTemplateCreate,
    ProtocolTemplateFieldRead,
    ProtocolTemplateListItem,
    ProtocolTemplateRead,
    ProtocolTemplateUpdate,
)

router = APIRouter(prefix="/protocol-templates", tags=["protocol-templates"])

_ROLES_ALLOWED_GENERAL_PRIVACY = frozenset({"head_of_department", "administrator"})


@router.get(
    "",
    response_model=List[ProtocolTemplateListItem],
)
async def list_protocol_templates(
    current_user: ServiceUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[ProtocolTemplateListItem]:
    """Личные шаблоны текущего пользователя и все общие (`privacy = general`)."""
    stmt = (
        select(ProtocolTemplate)
        .where(
            ProtocolTemplate.deleted_at.is_(None),
            or_(
                ProtocolTemplate.privacy == ProtocolPrivacy.general.value,
                and_(
                    ProtocolTemplate.privacy == ProtocolPrivacy.personal.value,
                    ProtocolTemplate.creator_id == current_user.id,
                ),
            ),
        )
        .order_by(
            ProtocolTemplate.updated_at.desc().nulls_last(),
            ProtocolTemplate.created_at.desc(),
        )
    )
    result = await db.execute(stmt)
    rows = result.scalars().all()
    return rows


@router.get(
    "/{template_id}",
    response_model=ProtocolTemplateRead,
)
async def get_protocol_template(
    template_id: UUID,
    current_user: ServiceUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProtocolTemplateRead:
    """Детали шаблона: общий или личный текущего пользователя (как в списке)."""
    tpl_stmt = (
        select(ProtocolTemplate)
        .where(
            ProtocolTemplate.id == template_id,
            ProtocolTemplate.deleted_at.is_(None),
            or_(
                ProtocolTemplate.privacy == ProtocolPrivacy.general.value,
                and_(
                    ProtocolTemplate.privacy == ProtocolPrivacy.personal.value,
                    ProtocolTemplate.creator_id == current_user.id,
                ),
            ),
        )
    )
    tpl_result = await db.execute(tpl_stmt)
    template = tpl_result.scalar_one_or_none()
    if template is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Protocol template not found",
        )

    fields_stmt = (
        select(ProtocolTemplateField)
        .where(
            ProtocolTemplateField.protocol_template_id == template_id,
            ProtocolTemplateField.deleted_at.is_(None),
        )
        .order_by(ProtocolTemplateField.created_at.asc())
    )
    fields_result = await db.execute(fields_stmt)
    field_rows = fields_result.scalars().all()
    fields_read = [ProtocolTemplateFieldRead.model_validate(r) for r in field_rows]

    return ProtocolTemplateRead(
        id=template.id,
        protocol_name=template.protocol_name,
        group_id=template.group_id,
        creator_id=template.creator_id,
        privacy=template.privacy,
        created_at=template.created_at,
        updated_at=template.updated_at,
        deleted_at=template.deleted_at,
        fields=fields_read,
    )


async def _ensure_group_owned_by_user(
    db: AsyncSession,
    *,
    group_id: UUID,
    user_id: UUID,
) -> None:
    group_stmt = select(TemplateGroup.id).where(
        TemplateGroup.id == group_id,
        TemplateGroup.creator_id == user_id,
        TemplateGroup.deleted_at.is_(None),
    )
    group_result = await db.execute(group_stmt)
    if group_result.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unknown group reference",
        )


@router.put(
    "/{template_id}",
    response_model=ProtocolTemplateRead,
)
async def update_protocol_template(
    template_id: UUID,
    payload: ProtocolTemplateUpdate,
    current_user: ServiceUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProtocolTemplateRead:
    tpl_stmt = select(ProtocolTemplate).where(
        ProtocolTemplate.id == template_id,
        ProtocolTemplate.deleted_at.is_(None),
    )
    tpl_result = await db.execute(tpl_stmt)
    template = tpl_result.scalar_one_or_none()
    if template is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Protocol template not found",
        )

    if template.privacy == ProtocolPrivacy.personal.value:
        if template.creator_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot edit another user's personal protocol template",
            )
    elif template.privacy == ProtocolPrivacy.general.value:
        if current_user.role not in _ROLES_ALLOWED_GENERAL_PRIVACY:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions to edit a general protocol template",
            )

    data = payload.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update",
        )

    if "privacy" in data:
        raw_privacy = data["privacy"]
        if raw_privacy is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="privacy cannot be null",
            )
        new_privacy = (
            raw_privacy.value
            if isinstance(raw_privacy, ProtocolPrivacy)
            else str(raw_privacy)
        )
        if new_privacy == ProtocolPrivacy.general.value:
            if current_user.role not in _ROLES_ALLOWED_GENERAL_PRIVACY:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Insufficient permissions to set protocol template privacy to general",
                )
        template.privacy = new_privacy

    if "group_id" in data and data["group_id"] is not None:
        await _ensure_group_owned_by_user(
            db,
            group_id=data["group_id"],
            user_id=current_user.id,
        )

    now = datetime.now(timezone.utc)

    if "protocol_name" in data and data["protocol_name"] is not None:
        name = data["protocol_name"].strip()
        if not name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Protocol name must not be empty",
            )
        template.protocol_name = name

    if "group_id" in data:
        template.group_id = data["group_id"]

    if "fields" in data and data["fields"] is not None:
        old_fields_stmt = select(ProtocolTemplateField).where(
            ProtocolTemplateField.protocol_template_id == template.id,
            ProtocolTemplateField.deleted_at.is_(None),
        )
        old_fields_result = await db.execute(old_fields_stmt)
        for row in old_fields_result.scalars().all():
            row.deleted_at = now
            row.updated_at = now

        for item in data["fields"]:
            fname = item["field_name"].strip()
            ftype = item["field_type"].strip()
            if not fname or not ftype:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Each field must have non-empty field_name and field_type",
                )
            fv = item.get("field_value")
            db.add(
                ProtocolTemplateField(
                    protocol_template_id=template.id,
                    field_name=fname,
                    field_type=ftype,
                    field_value=fv,
                    created_at=now,
                    updated_at=now,
                    deleted_at=None,
                )
            )

    template.updated_at = now
    await db.commit()
    await db.refresh(template)

    fields_stmt = (
        select(ProtocolTemplateField)
        .where(
            ProtocolTemplateField.protocol_template_id == template_id,
            ProtocolTemplateField.deleted_at.is_(None),
        )
        .order_by(ProtocolTemplateField.created_at.asc())
    )
    fields_result = await db.execute(fields_stmt)
    field_rows = fields_result.scalars().all()
    fields_read = [ProtocolTemplateFieldRead.model_validate(r) for r in field_rows]

    return ProtocolTemplateRead(
        id=template.id,
        protocol_name=template.protocol_name,
        group_id=template.group_id,
        creator_id=template.creator_id,
        privacy=template.privacy,
        created_at=template.created_at,
        updated_at=template.updated_at,
        deleted_at=template.deleted_at,
        fields=fields_read,
    )


@router.delete(
    "/{template_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_protocol_template(
    template_id: UUID,
    current_user: ServiceUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    tpl_stmt = select(ProtocolTemplate).where(
        ProtocolTemplate.id == template_id,
        ProtocolTemplate.deleted_at.is_(None),
    )
    tpl_result = await db.execute(tpl_stmt)
    template = tpl_result.scalar_one_or_none()
    if template is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Protocol template not found",
        )

    if template.privacy == ProtocolPrivacy.personal.value:
        if template.creator_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot delete another user's personal protocol template",
            )
    elif template.privacy == ProtocolPrivacy.general.value:
        if current_user.role not in _ROLES_ALLOWED_GENERAL_PRIVACY:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions to delete a general protocol template",
            )

    await db.execute(
        delete(ProtocolTemplateField).where(
            ProtocolTemplateField.protocol_template_id == template_id,
        )
    )
    await db.execute(delete(ProtocolTemplate).where(ProtocolTemplate.id == template_id))
    await db.commit()


@router.post(
    "",
    response_model=ProtocolTemplateRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_protocol_template(
    payload: ProtocolTemplateCreate,
    current_user: ServiceUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProtocolTemplateRead:
    protocol_name = payload.protocol_name.strip()
    if not protocol_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Protocol name must not be empty",
        )

    if payload.privacy == ProtocolPrivacy.general:
        if current_user.role not in _ROLES_ALLOWED_GENERAL_PRIVACY:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions to create a general protocol template",
            )

    if payload.group_id is not None:
        await _ensure_group_owned_by_user(
            db,
            group_id=payload.group_id,
            user_id=current_user.id,
        )

    now = datetime.now(timezone.utc)
    privacy_value = payload.privacy.value

    template = ProtocolTemplate(
        protocol_name=protocol_name,
        group_id=payload.group_id,
        creator_id=current_user.id,
        privacy=privacy_value,
        created_at=now,
        updated_at=now,
        deleted_at=None,
    )
    db.add(template)
    await db.flush()

    field_rows: list[ProtocolTemplateField] = []
    for item in payload.fields:
        fname = item.field_name.strip()
        ftype = item.field_type.strip()
        if not fname or not ftype:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Each field must have non-empty field_name and field_type",
            )
        row = ProtocolTemplateField(
            protocol_template_id=template.id,
            field_name=fname,
            field_type=ftype,
            field_value=item.field_value,
            created_at=now,
            updated_at=now,
            deleted_at=None,
        )
        db.add(row)
        field_rows.append(row)

    await db.commit()
    await db.refresh(template)

    for row in field_rows:
        await db.refresh(row)

    fields_read = [ProtocolTemplateFieldRead.model_validate(r) for r in field_rows]
    return ProtocolTemplateRead(
        id=template.id,
        protocol_name=template.protocol_name,
        group_id=template.group_id,
        creator_id=template.creator_id,
        privacy=template.privacy,
        created_at=template.created_at,
        updated_at=template.updated_at,
        deleted_at=template.deleted_at,
        fields=fields_read,
    )
