from datetime import datetime, timezone
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..deps import get_current_user
from ..models.protocol_structure import ProtocolStructure, ProtocolStructureField
from ..models.service_user import ServiceUser
from ..schemas.protocol_structure import (
    ProtocolStructureCreate,
    ProtocolStructureFieldCreate,
    ProtocolStructureFieldPut,
    ProtocolStructureFieldRead,
    ProtocolStructureListItem,
    ProtocolStructurePatch,
    ProtocolStructurePut,
    ProtocolStructureRead,
)

router = APIRouter(prefix="/protocol-structures", tags=["protocol-structures"])


def _normalize_required(value: str, *, field_name: str) -> str:
    normalized = value.strip()
    if not normalized:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{field_name} must not be empty",
        )
    return normalized


def _ensure_unique_field_names(items: list[dict]) -> None:
    seen: set[str] = set()
    for item in items:
        name = str(item["field_name"]).strip()
        lowered = name.lower()
        if lowered in seen:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Duplicate field_name inside structure: {name}",
            )
        seen.add(lowered)


async def _load_structure(
    db: AsyncSession,
    structure_id: UUID,
) -> ProtocolStructure | None:
    stmt = select(ProtocolStructure).where(
        ProtocolStructure.id == structure_id,
        ProtocolStructure.deleted_at.is_(None),
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def _load_fields(
    db: AsyncSession,
    structure_id: UUID,
) -> list[ProtocolStructureField]:
    stmt = (
        select(ProtocolStructureField)
        .where(ProtocolStructureField.protocol_structure_id == structure_id)
        .order_by(
            ProtocolStructureField.sort_order.asc(),
            ProtocolStructureField.field_name.asc(),
        )
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


def _to_read(
    structure: ProtocolStructure,
    fields: list[ProtocolStructureField],
) -> ProtocolStructureRead:
    return ProtocolStructureRead(
        id=structure.id,
        creator_id=structure.creator_id,
        structure_code=structure.structure_code,
        structure_name=structure.structure_name,
        description=structure.description,
        version=structure.version,
        is_active=structure.is_active,
        created_at=structure.created_at,
        updated_at=structure.updated_at,
        deleted_at=structure.deleted_at,
        fields=[ProtocolStructureFieldRead.model_validate(row) for row in fields],
    )


def _fields_create_payload(
    structure_id: UUID,
    rows: list[ProtocolStructureFieldCreate] | list[ProtocolStructureFieldPut],
) -> list[dict]:
    items: list[dict] = []
    for row in rows:
        field_name = _normalize_required(row.field_name, field_name="field_name")
        field_type = _normalize_required(row.field_type, field_name="field_type")
        items.append(
            {
                "protocol_structure_id": structure_id,
                "field_name": field_name,
                "field_label": row.field_label,
                "description": row.description,
                "field_type": field_type,
                "default_value": row.default_value,
                "dictionary": row.dictionary,
                "protocol_fields_main_id": row.protocol_fields_main_id,
                "is_required": row.is_required,
                "sort_order": row.sort_order,
            }
        )
    _ensure_unique_field_names(items)
    return items


def _ensure_owner(
    structure: ProtocolStructure | None,
    user_id: UUID,
) -> ProtocolStructure:
    if structure is None or structure.creator_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Protocol structure not found",
        )
    return structure


@router.get("", response_model=List[ProtocolStructureListItem])
async def list_protocol_structures(
    current_user: ServiceUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[ProtocolStructureListItem]:
    _ = current_user
    stmt = (
        select(ProtocolStructure)
        .where(ProtocolStructure.deleted_at.is_(None))
        .order_by(
            ProtocolStructure.updated_at.desc().nulls_last(),
            ProtocolStructure.created_at.desc(),
        )
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.get("/{structure_id}", response_model=ProtocolStructureRead)
async def get_protocol_structure(
    structure_id: UUID,
    current_user: ServiceUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProtocolStructureRead:
    _ = current_user
    structure = await _load_structure(db, structure_id)
    if structure is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Protocol structure not found",
        )
    fields = await _load_fields(db, structure.id)
    return _to_read(structure, fields)


@router.post("", response_model=ProtocolStructureRead, status_code=status.HTTP_201_CREATED)
async def create_protocol_structure(
    payload: ProtocolStructureCreate,
    current_user: ServiceUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProtocolStructureRead:
    now = datetime.now(timezone.utc)
    structure = ProtocolStructure(
        creator_id=current_user.id,
        structure_code=_normalize_required(payload.structure_code, field_name="structure_code"),
        structure_name=_normalize_required(payload.structure_name, field_name="structure_name"),
        description=payload.description,
        version=payload.version,
        is_active=payload.is_active,
        created_at=now,
        updated_at=now,
        deleted_at=None,
    )
    db.add(structure)

    try:
        await db.flush()
        field_items = _fields_create_payload(structure.id, payload.fields)
        field_rows: list[ProtocolStructureField] = []
        for item in field_items:
            row = ProtocolStructureField(**item)
            db.add(row)
            field_rows.append(row)
        await db.commit()
        await db.refresh(structure)
        for row in field_rows:
            await db.refresh(row)
        return _to_read(structure, field_rows)
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Protocol structure conflicts with existing data",
        ) from exc
    except SQLAlchemyError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error while creating protocol structure",
        ) from exc


@router.put("/{structure_id}", response_model=ProtocolStructureRead)
async def put_protocol_structure(
    structure_id: UUID,
    payload: ProtocolStructurePut,
    current_user: ServiceUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProtocolStructureRead:
    structure = _ensure_owner(await _load_structure(db, structure_id), current_user.id)
    now = datetime.now(timezone.utc)
    structure.structure_code = _normalize_required(payload.structure_code, field_name="structure_code")
    structure.structure_name = _normalize_required(payload.structure_name, field_name="structure_name")
    structure.description = payload.description
    structure.version = payload.version
    structure.is_active = payload.is_active
    structure.updated_at = now

    try:
        await db.execute(
            delete(ProtocolStructureField).where(
                ProtocolStructureField.protocol_structure_id == structure.id
            )
        )
        field_items = _fields_create_payload(structure.id, payload.fields)
        for item in field_items:
            db.add(ProtocolStructureField(**item))
        await db.commit()
        await db.refresh(structure)
        fields = await _load_fields(db, structure.id)
        return _to_read(structure, fields)
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Protocol structure conflicts with existing data",
        ) from exc
    except SQLAlchemyError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error while updating protocol structure",
        ) from exc


@router.patch("/{structure_id}", response_model=ProtocolStructureRead)
async def patch_protocol_structure(
    structure_id: UUID,
    payload: ProtocolStructurePatch,
    current_user: ServiceUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProtocolStructureRead:
    structure = _ensure_owner(await _load_structure(db, structure_id), current_user.id)
    update_data = payload.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update",
        )

    now = datetime.now(timezone.utc)
    if "structure_code" in update_data and update_data["structure_code"] is not None:
        structure.structure_code = _normalize_required(
            update_data["structure_code"], field_name="structure_code"
        )
    if "structure_name" in update_data and update_data["structure_name"] is not None:
        structure.structure_name = _normalize_required(
            update_data["structure_name"], field_name="structure_name"
        )
    if "description" in update_data:
        structure.description = update_data["description"]
    if "version" in update_data and update_data["version"] is not None:
        structure.version = update_data["version"]
    if "is_active" in update_data and update_data["is_active"] is not None:
        structure.is_active = update_data["is_active"]
    structure.updated_at = now

    try:
        existing_fields = await _load_fields(db, structure.id)
        existing_by_id = {row.id: row for row in existing_fields}

        fields_update_ids = {item.id for item in payload.fields_update}
        missing_update_ids = fields_update_ids.difference(existing_by_id.keys())
        if missing_update_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Attempt to update unknown field id",
            )

        fields_delete_ids = set(payload.fields_delete)
        missing_delete_ids = fields_delete_ids.difference(existing_by_id.keys())
        if missing_delete_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Attempt to delete unknown field id",
            )

        for item in payload.fields_update:
            row = existing_by_id[item.id]
            item_data = item.model_dump(exclude_unset=True)
            if "field_name" in item_data and item_data["field_name"] is not None:
                row.field_name = _normalize_required(
                    item_data["field_name"], field_name="field_name"
                )
            if "field_label" in item_data:
                row.field_label = item_data["field_label"]
            if "description" in item_data:
                row.description = item_data["description"]
            if "field_type" in item_data and item_data["field_type"] is not None:
                row.field_type = _normalize_required(
                    item_data["field_type"], field_name="field_type"
                )
            if "default_value" in item_data:
                row.default_value = item_data["default_value"]
            if "dictionary" in item_data:
                row.dictionary = item_data["dictionary"]
            if "protocol_fields_main_id" in item_data:
                row.protocol_fields_main_id = item_data["protocol_fields_main_id"]
            if "is_required" in item_data and item_data["is_required"] is not None:
                row.is_required = item_data["is_required"]
            if "sort_order" in item_data and item_data["sort_order"] is not None:
                row.sort_order = item_data["sort_order"]

        if fields_delete_ids:
            await db.execute(
                delete(ProtocolStructureField).where(
                    ProtocolStructureField.protocol_structure_id == structure.id,
                    ProtocolStructureField.id.in_(fields_delete_ids),
                )
            )

        add_items = _fields_create_payload(structure.id, payload.fields_add)
        for item in add_items:
            db.add(ProtocolStructureField(**item))

        final_fields = await _load_fields(db, structure.id)
        final_names: set[str] = set()
        for row in final_fields:
            normalized_name = row.field_name.strip().lower()
            if normalized_name in final_names:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Duplicate field_name inside structure: {row.field_name}",
                )
            final_names.add(normalized_name)

        await db.commit()
        await db.refresh(structure)
        reloaded_fields = await _load_fields(db, structure.id)
        return _to_read(structure, reloaded_fields)
    except HTTPException:
        await db.rollback()
        raise
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Protocol structure conflicts with existing data",
        ) from exc
    except SQLAlchemyError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error while patching protocol structure",
        ) from exc


@router.delete("/{structure_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_protocol_structure(
    structure_id: UUID,
    current_user: ServiceUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    structure = _ensure_owner(await _load_structure(db, structure_id), current_user.id)

    try:
        await db.execute(
            delete(ProtocolStructure).where(
                ProtocolStructure.id == structure.id,
            )
        )
        await db.commit()
    except SQLAlchemyError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error while deleting protocol structure",
        ) from exc
