from datetime import datetime, timezone
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..deps import get_current_user
from ..models.protocol import Protocol, ProtocolField
from ..models.protocol_structure import ProtocolStructure, ProtocolStructureField
from ..models.service_user import ServiceUser
from ..schemas.protocol import (
    ProtocolCreate,
    ProtocolListItem,
    ProtocolPatch,
    ProtocolPut,
    ProtocolRead,
)

router = APIRouter(prefix="/protocols", tags=["protocols"])


def _is_empty_value(value: str | None) -> bool:
    if value is None:
        return True
    if isinstance(value, str) and not value.strip():
        return True
    return False


async def _load_protocol_owned(
    db: AsyncSession,
    *,
    protocol_id: UUID,
    user_id: UUID,
) -> Protocol:
    stmt = select(Protocol).where(
        Protocol.id == protocol_id,
        Protocol.deleted_at.is_(None),
        Protocol.service_user == user_id,
    )
    result = await db.execute(stmt)
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Protocol not found",
        )
    return row


async def _load_structure_fields_map(
    db: AsyncSession,
    *,
    protocol_structure_id: UUID,
) -> dict[UUID, ProtocolStructureField]:
    stmt = select(ProtocolStructureField).where(
        ProtocolStructureField.protocol_structure_id == protocol_structure_id
    )
    result = await db.execute(stmt)
    rows = list(result.scalars().all())
    return {row.id: row for row in rows}


async def _ensure_structure_exists(
    db: AsyncSession,
    *,
    protocol_structure_id: UUID,
) -> None:
    stmt = select(ProtocolStructure.id).where(
        ProtocolStructure.id == protocol_structure_id,
        ProtocolStructure.deleted_at.is_(None),
    )
    result = await db.execute(stmt)
    if result.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unknown protocol structure reference",
        )


def _validate_field_ids_belong_to_structure(
    *,
    field_values: dict[UUID, str | None],
    structure_fields_map: dict[UUID, ProtocolStructureField],
) -> None:
    unknown_ids = [field_id for field_id in field_values if field_id not in structure_fields_map]
    if unknown_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown field_id for this structure: {unknown_ids[0]}",
        )


def _validate_required_for_create_or_put(
    *,
    field_values: dict[UUID, str | None],
    structure_fields_map: dict[UUID, ProtocolStructureField],
) -> None:
    for field_id, row in structure_fields_map.items():
        if row.is_required:
            if field_id not in field_values or _is_empty_value(field_values.get(field_id)):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Required field is missing or empty: {field_id}",
                )


def _validate_required_for_patch(
    *,
    field_values: dict[UUID, str | None],
    structure_fields_map: dict[UUID, ProtocolStructureField],
) -> None:
    for field_id, value in field_values.items():
        row = structure_fields_map.get(field_id)
        if row and row.is_required and _is_empty_value(value):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Required field cannot be empty: {field_id}",
            )


async def _read_field_values(
    db: AsyncSession,
    *,
    protocol_id: UUID,
) -> dict[UUID, str | None]:
    stmt = select(ProtocolField).where(ProtocolField.protocol_id == protocol_id)
    result = await db.execute(stmt)
    rows = list(result.scalars().all())
    return {row.field_id: row.field_value for row in rows}


async def _upsert_field_values(
    db: AsyncSession,
    *,
    protocol_id: UUID,
    field_values: dict[UUID, str | None],
) -> None:
    stmt = select(ProtocolField).where(ProtocolField.protocol_id == protocol_id)
    result = await db.execute(stmt)
    existing_rows = list(result.scalars().all())
    existing_by_field_id = {row.field_id: row for row in existing_rows}

    for field_id, value in field_values.items():
        existing = existing_by_field_id.get(field_id)
        if existing is None:
            db.add(
                ProtocolField(
                    protocol_id=protocol_id,
                    field_id=field_id,
                    field_value=value,
                )
            )
        else:
            existing.field_value = value


async def _replace_field_values(
    db: AsyncSession,
    *,
    protocol_id: UUID,
    field_values: dict[UUID, str | None],
) -> None:
    await db.execute(delete(ProtocolField).where(ProtocolField.protocol_id == protocol_id))
    for field_id, value in field_values.items():
        db.add(
            ProtocolField(
                protocol_id=protocol_id,
                field_id=field_id,
                field_value=value,
            )
        )


def _to_read(protocol: Protocol, field_values: dict[UUID, str | None]) -> ProtocolRead:
    return ProtocolRead(
        id=protocol.id,
        service_user=protocol.service_user,
        protocol_structure_id=protocol.protocol_structure_id,
        patient_id=protocol.patient_id,
        doctor_id=protocol.doctor_id,
        protocol_name=protocol.protocol_name,
        status_protocol=protocol.status_protocol,
        created_at=protocol.created_at,
        updated_at=protocol.updated_at,
        deleted_at=protocol.deleted_at,
        field_values=field_values,
        source_questionnaire_id=protocol.source_questionnaire_id,
        created_from_questionnaire=bool(protocol.created_from_questionnaire),
    )


@router.get(
    "",
    response_model=List[ProtocolListItem],
    summary="Список протоколов",
)
async def list_protocols(
    current_user: ServiceUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[ProtocolListItem]:
    stmt = (
        select(Protocol)
        .where(
            Protocol.deleted_at.is_(None),
            Protocol.service_user == current_user.id,
        )
        .order_by(Protocol.updated_at.desc().nulls_last(), Protocol.created_at.desc())
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.get(
    "/{protocol_id}",
    response_model=ProtocolRead,
    summary="Протокол по id",
)
async def get_protocol(
    protocol_id: UUID,
    current_user: ServiceUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProtocolRead:
    protocol = await _load_protocol_owned(db, protocol_id=protocol_id, user_id=current_user.id)
    field_values = await _read_field_values(db, protocol_id=protocol.id)
    return _to_read(protocol, field_values)


@router.post(
    "",
    response_model=ProtocolRead,
    status_code=status.HTTP_201_CREATED,
    summary="Создать протокол",
)
async def create_protocol(
    payload: ProtocolCreate,
    current_user: ServiceUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProtocolRead:
    await _ensure_structure_exists(db, protocol_structure_id=payload.protocol_structure_id)
    structure_fields_map = await _load_structure_fields_map(
        db, protocol_structure_id=payload.protocol_structure_id
    )

    _validate_field_ids_belong_to_structure(
        field_values=payload.field_values,
        structure_fields_map=structure_fields_map,
    )
    _validate_required_for_create_or_put(
        field_values=payload.field_values,
        structure_fields_map=structure_fields_map,
    )

    now = datetime.now(timezone.utc)
    protocol = Protocol(
        service_user=current_user.id,
        protocol_structure_id=payload.protocol_structure_id,
        patient_id=payload.patient_id,
        doctor_id=payload.doctor_id,
        protocol_name=payload.protocol_name,
        status_protocol=payload.status_protocol,
        created_at=now,
        updated_at=now,
        deleted_at=None,
    )
    db.add(protocol)
    await db.flush()

    for field_id, value in payload.field_values.items():
        db.add(
            ProtocolField(
                protocol_id=protocol.id,
                field_id=field_id,
                field_value=value,
            )
        )

    await db.commit()
    await db.refresh(protocol)
    field_values = await _read_field_values(db, protocol_id=protocol.id)
    return _to_read(protocol, field_values)


@router.put(
    "/{protocol_id}",
    response_model=ProtocolRead,
    summary="Полная замена протокола",
)
async def put_protocol(
    protocol_id: UUID,
    payload: ProtocolPut,
    current_user: ServiceUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProtocolRead:
    protocol = await _load_protocol_owned(db, protocol_id=protocol_id, user_id=current_user.id)
    if protocol.protocol_structure_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Protocol has no linked structure",
        )
    structure_fields_map = await _load_structure_fields_map(
        db,
        protocol_structure_id=protocol.protocol_structure_id,
    )
    _validate_field_ids_belong_to_structure(
        field_values=payload.field_values,
        structure_fields_map=structure_fields_map,
    )
    _validate_required_for_create_or_put(
        field_values=payload.field_values,
        structure_fields_map=structure_fields_map,
    )

    protocol.patient_id = payload.patient_id
    protocol.doctor_id = payload.doctor_id
    protocol.protocol_name = payload.protocol_name
    protocol.status_protocol = payload.status_protocol
    protocol.updated_at = datetime.now(timezone.utc)

    await _replace_field_values(
        db,
        protocol_id=protocol.id,
        field_values=payload.field_values,
    )

    await db.commit()
    await db.refresh(protocol)
    field_values = await _read_field_values(db, protocol_id=protocol.id)
    return _to_read(protocol, field_values)


@router.patch(
    "/{protocol_id}",
    response_model=ProtocolRead,
    summary="Частичное обновление протокола",
)
async def patch_protocol(
    protocol_id: UUID,
    payload: ProtocolPatch,
    current_user: ServiceUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProtocolRead:
    protocol = await _load_protocol_owned(db, protocol_id=protocol_id, user_id=current_user.id)
    if protocol.protocol_structure_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Protocol has no linked structure",
        )
    structure_fields_map = await _load_structure_fields_map(
        db,
        protocol_structure_id=protocol.protocol_structure_id,
    )
    _validate_field_ids_belong_to_structure(
        field_values=payload.field_values,
        structure_fields_map=structure_fields_map,
    )
    _validate_required_for_patch(
        field_values=payload.field_values,
        structure_fields_map=structure_fields_map,
    )

    if payload.patient_id is not None:
        protocol.patient_id = payload.patient_id
    if payload.doctor_id is not None:
        protocol.doctor_id = payload.doctor_id
    if payload.protocol_name is not None:
        protocol.protocol_name = payload.protocol_name
    if payload.status_protocol is not None:
        protocol.status_protocol = payload.status_protocol
    protocol.updated_at = datetime.now(timezone.utc)

    await _upsert_field_values(
        db,
        protocol_id=protocol.id,
        field_values=payload.field_values,
    )

    await db.commit()
    await db.refresh(protocol)
    field_values = await _read_field_values(db, protocol_id=protocol.id)
    return _to_read(protocol, field_values)


@router.delete(
    "/{protocol_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Удалить протокол",
)
async def delete_protocol(
    protocol_id: UUID,
    current_user: ServiceUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    protocol = await _load_protocol_owned(db, protocol_id=protocol_id, user_id=current_user.id)
    await db.delete(protocol)
    await db.commit()
