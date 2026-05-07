from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class ProtocolStructureFieldCreate(BaseModel):
    field_name: str = Field(..., min_length=1, max_length=255)
    field_label: str | None = Field(default=None, max_length=500)
    description: str | None = None
    field_type: str = Field(..., min_length=1, max_length=255)
    default_value: str | None = None
    default_value_jsonb: Any | None = None
    dictionary: str | None = Field(default=None, max_length=255)
    protocol_fields_main_id: UUID | None = None
    is_required: bool = False
    sort_order: int = Field(default=0, ge=0)


class ProtocolStructureFieldPut(BaseModel):
    field_name: str = Field(..., min_length=1, max_length=255)
    field_label: str | None = Field(default=None, max_length=500)
    description: str | None = None
    field_type: str = Field(..., min_length=1, max_length=255)
    default_value: str | None = None
    default_value_jsonb: Any | None = None
    dictionary: str | None = Field(default=None, max_length=255)
    protocol_fields_main_id: UUID | None = None
    is_required: bool = False
    sort_order: int = Field(default=0, ge=0)


class ProtocolStructureFieldPatch(BaseModel):
    id: UUID
    field_name: str | None = Field(default=None, min_length=1, max_length=255)
    field_label: str | None = Field(default=None, max_length=500)
    description: str | None = None
    field_type: str | None = Field(default=None, min_length=1, max_length=255)
    default_value: str | None = None
    default_value_jsonb: Any | None = None
    dictionary: str | None = Field(default=None, max_length=255)
    protocol_fields_main_id: UUID | None = None
    is_required: bool | None = None
    sort_order: int | None = Field(default=None, ge=0)


class ProtocolStructureCreate(BaseModel):
    structure_code: str = Field(..., min_length=1, max_length=255)
    structure_name: str = Field(..., min_length=1, max_length=500)
    description: str | None = None
    version: int = Field(default=1, ge=1)
    is_active: bool = True
    fields: list[ProtocolStructureFieldCreate] = Field(default_factory=list)


class ProtocolStructurePut(BaseModel):
    structure_code: str = Field(..., min_length=1, max_length=255)
    structure_name: str = Field(..., min_length=1, max_length=500)
    description: str | None = None
    version: int = Field(default=1, ge=1)
    is_active: bool = True
    fields: list[ProtocolStructureFieldPut] = Field(default_factory=list)


class ProtocolStructurePatch(BaseModel):
    structure_code: str | None = Field(default=None, min_length=1, max_length=255)
    structure_name: str | None = Field(default=None, min_length=1, max_length=500)
    description: str | None = None
    version: int | None = Field(default=None, ge=1)
    is_active: bool | None = None
    fields_add: list[ProtocolStructureFieldCreate] = Field(default_factory=list)
    fields_update: list[ProtocolStructureFieldPatch] = Field(default_factory=list)
    fields_delete: list[UUID] = Field(default_factory=list)


class ProtocolStructureFieldRead(BaseModel):
    id: UUID
    protocol_structure_id: UUID
    field_name: str
    field_label: str | None
    description: str | None
    field_type: str
    default_value: str | None
    default_value_jsonb: Any | None
    dictionary: str | None
    protocol_fields_main_id: UUID | None
    is_required: bool
    sort_order: int

    class Config:
        from_attributes = True


class ProtocolStructureListItem(BaseModel):
    id: UUID
    creator_id: UUID
    structure_code: str
    structure_name: str
    description: str | None
    version: int
    is_active: bool
    created_at: datetime
    updated_at: datetime | None = None
    deleted_at: datetime | None = None

    class Config:
        from_attributes = True


class ProtocolStructureRead(BaseModel):
    id: UUID
    creator_id: UUID
    structure_code: str
    structure_name: str
    description: str | None
    version: int
    is_active: bool
    created_at: datetime
    updated_at: datetime | None = None
    deleted_at: datetime | None = None
    fields: list[ProtocolStructureFieldRead]

    class Config:
        from_attributes = True
