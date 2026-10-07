from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


_FIELD_VALUES_DESC = (
    "Значения полей: ключ — UUID поля структуры протокола, значение — текст (или null)."
)


class ProtocolCreate(BaseModel):
    protocol_structure_id: UUID
    patient_id: int | None = None
    doctor_id: UUID | None = None
    protocol_name: str | None = Field(default=None, max_length=255)
    status_protocol: str | None = Field(default=None, max_length=255)
    field_values: dict[UUID, str | None] = Field(
        default_factory=dict,
        description=_FIELD_VALUES_DESC,
    )


class ProtocolPut(BaseModel):
    patient_id: int | None = None
    doctor_id: UUID | None = None
    protocol_name: str | None = Field(default=None, max_length=255)
    status_protocol: str | None = Field(default=None, max_length=255)
    field_values: dict[UUID, str | None] = Field(
        default_factory=dict,
        description=_FIELD_VALUES_DESC,
    )


class ProtocolPatch(BaseModel):
    patient_id: int | None = None
    doctor_id: UUID | None = None
    protocol_name: str | None = Field(default=None, max_length=255)
    status_protocol: str | None = Field(default=None, max_length=255)
    field_values: dict[UUID, str | None] = Field(
        default_factory=dict,
        description=_FIELD_VALUES_DESC,
    )


class ProtocolListItem(BaseModel):
    id: UUID
    service_user: UUID | None
    protocol_structure_id: UUID | None
    patient_id: int | None
    doctor_id: UUID | None
    protocol_name: str | None
    status_protocol: str | None
    created_at: datetime
    updated_at: datetime | None = None
    deleted_at: datetime | None = None
    source_questionnaire_id: UUID | None = None
    created_from_questionnaire: bool = False

    class Config:
        from_attributes = True


class ProtocolRead(BaseModel):
    id: UUID
    service_user: UUID | None
    protocol_structure_id: UUID | None
    patient_id: int | None
    doctor_id: UUID | None
    protocol_name: str | None
    status_protocol: str | None
    created_at: datetime
    updated_at: datetime | None = None
    deleted_at: datetime | None = None
    field_values: dict[UUID, str | None] = Field(description=_FIELD_VALUES_DESC)
    source_questionnaire_id: UUID | None = None
    created_from_questionnaire: bool = False

    class Config:
        from_attributes = True
