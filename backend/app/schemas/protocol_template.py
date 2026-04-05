from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, Field


class ProtocolPrivacy(str, Enum):
    general = "general"
    personal = "personal"


class ProtocolTemplateFieldCreate(BaseModel):
    field_name: str = Field(..., min_length=1, max_length=255)
    field_type: str = Field(..., min_length=1, max_length=255)
    field_value: str | None = Field(None, max_length=65535)


class ProtocolTemplateCreate(BaseModel):
    protocol_name: str = Field(..., min_length=1, max_length=255)
    privacy: ProtocolPrivacy
    group_id: UUID | None = None
    fields: list[ProtocolTemplateFieldCreate] = Field(default_factory=list)


class ProtocolTemplateUpdate(BaseModel):
    protocol_name: str | None = Field(default=None, min_length=1, max_length=255)
    privacy: ProtocolPrivacy | None = None
    group_id: UUID | None = None
    fields: list[ProtocolTemplateFieldCreate] | None = None


class ProtocolTemplateFieldRead(BaseModel):
    id: UUID
    field_name: str | None
    field_type: str | None
    field_value: str | None
    created_at: datetime
    updated_at: datetime | None = None
    deleted_at: datetime | None = None

    class Config:
        from_attributes = True


class ProtocolTemplateRead(BaseModel):
    id: UUID
    protocol_name: str | None
    group_id: UUID | None
    creator_id: UUID | None
    privacy: str | None
    created_at: datetime
    updated_at: datetime | None = None
    deleted_at: datetime | None = None
    fields: list[ProtocolTemplateFieldRead]

    class Config:
        from_attributes = True


class ProtocolTemplateListItem(BaseModel):
    id: UUID
    protocol_name: str | None
    group_id: UUID | None
    privacy: str | None

    class Config:
        from_attributes = True
