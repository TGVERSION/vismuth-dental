from datetime import datetime
from typing import Literal
from uuid import UUID
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class JoinSubmission(BaseModel):
    model_config = ConfigDict(extra='forbid')
    token: str = Field(min_length=32, max_length=128)
    requested_role: Literal['operator', 'doctor']
    specialization_ids: list[int] = Field(default_factory=list, max_length=50)


class JoinRegistration(JoinSubmission):
    login: EmailStr
    password: str = Field(min_length=8, max_length=128)
    first_name: str = Field(min_length=1, max_length=255)
    last_name: str = Field(min_length=1, max_length=255)
    middle_name: str | None = Field(default=None, max_length=255)

    @field_validator('first_name', 'last_name', 'middle_name')
    @classmethod
    def clean_name(cls, value):
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError('Имя не может быть пустым')
        return value


class JoinRequestRead(BaseModel):
    id: UUID
    clinic_id: UUID
    clinic_name: str
    user_id: UUID
    email: str
    first_name: str | None
    last_name: str | None
    middle_name: str | None
    requested_role: Literal['operator', 'doctor']
    specialization_ids: list[int]
    status: Literal['pending', 'approved', 'rejected']
    created_at: datetime
    reviewed_at: datetime | None


class JoinRole(BaseModel):
    value: Literal['operator', 'doctor']
    label: str


class JoinPreview(BaseModel):
    clinic_id: UUID
    clinic_name: str
    roles: list[JoinRole]
    specializations: list[dict]


class JoinStatus(BaseModel):
    restricted: bool
    requests: list[JoinRequestRead]


class JoinRequestList(BaseModel):
    items: list[JoinRequestRead]
    total: int
