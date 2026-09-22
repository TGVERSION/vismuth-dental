from datetime import date, datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field

AccessType = Literal["trial", "paid"]
AccessStatusCode = Literal["trial", "paid", "expired"]


class ClinicCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    phone: Optional[str] = Field(default=None, max_length=64)
    email: Optional[EmailStr] = None
    logo_url: Optional[str] = None
    brand_color: Optional[str] = Field(default=None, max_length=32)
    doctors_limit: int = Field(default=10, ge=0)
    access_until: date
    access_type: AccessType


class ClinicPatch(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    phone: Optional[str] = Field(default=None, max_length=64)
    email: Optional[EmailStr] = None
    logo_url: Optional[str] = None
    brand_color: Optional[str] = Field(default=None, max_length=32)
    doctors_limit: Optional[int] = Field(default=None, ge=0)
    access_until: Optional[date] = None
    access_type: Optional[AccessType] = None


class ClinicRead(BaseModel):
    id: UUID
    name: str
    phone: Optional[str]
    email: Optional[str]
    logo_url: Optional[str]
    brand_color: Optional[str]
    doctors_limit: int
    access_until: date
    access_type: AccessType
    public_slug: str
    access_status_code: AccessStatusCode
    access_status_label: str
    doctors_count: int = 0
    created_at: datetime
    updated_at: Optional[datetime]
    deleted_at: Optional[datetime]

    model_config = ConfigDict(from_attributes=True)


class ClinicInvitationCreate(BaseModel):
    email: EmailStr
    first_name: Optional[str] = Field(default=None, max_length=255)
    last_name: Optional[str] = Field(default=None, max_length=255)
    is_clinic_admin: bool = True
    is_doctor: bool = False


class ClinicInvitationRead(BaseModel):
    id: UUID
    clinic_id: UUID
    email: str
    first_name: Optional[str]
    last_name: Optional[str]
    is_clinic_admin: bool
    is_doctor: bool
    expires_at: datetime
    used_at: Optional[datetime]
    created_by_user_id: Optional[UUID]
    created_at: datetime
    updated_at: Optional[datetime]
    deleted_at: Optional[datetime]

    model_config = ConfigDict(from_attributes=True)


class ClinicInvitationCreated(ClinicInvitationRead):
    invite_url: str
    email_sent: bool
    email_error: Optional[str] = None
