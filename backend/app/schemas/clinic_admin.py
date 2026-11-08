from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from .clinic import ClinicInvitationCreated, ClinicInvitationRead, QuestionnaireKind

MemberStatus = Literal["invited", "active", "deactivated"]


class SpecializationRead(BaseModel):
    id: int
    code: Optional[str] = None
    name: str

    model_config = ConfigDict(from_attributes=True)


class ClinicAdminPatch(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    phone: Optional[str] = Field(default=None, max_length=64)
    logo_url: Optional[str] = None
    brand_color: Optional[str] = Field(default=None, max_length=32, description="Фон за логотипом")
    button_color: Optional[str] = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$", description="Цвет кнопок; null — стандартный графитовый #202020")


class ClinicMemberInviteCreate(BaseModel):
    is_operator: bool = False
    email: EmailStr
    first_name: Optional[str] = Field(default=None, max_length=255)
    last_name: Optional[str] = Field(default=None, max_length=255)
    middle_name: Optional[str] = Field(default=None, max_length=255)
    photo_url: Optional[str] = None
    is_clinic_admin: bool = False
    is_doctor: bool = True
    specialization_ids: list[int] = Field(default_factory=list)


class ClinicMemberPatch(BaseModel):
    is_operator: Optional[bool] = None
    first_name: Optional[str] = Field(default=None, max_length=255)
    last_name: Optional[str] = Field(default=None, max_length=255)
    middle_name: Optional[str] = Field(default=None, max_length=255)
    photo_url: Optional[str] = None
    is_clinic_admin: Optional[bool] = None
    is_doctor: Optional[bool] = None
    specialization_ids: Optional[list[int]] = None


class ClinicMemberRead(BaseModel):
    id: UUID
    kind: Literal["membership", "invitation"]
    status: MemberStatus
    email: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    middle_name: Optional[str] = None
    photo_url: Optional[str] = None
    is_clinic_admin: bool
    is_doctor: bool
    is_operator: bool = False
    specializations: list[SpecializationRead] = Field(default_factory=list)
    public_slug: Optional[str] = None
    public_url: Optional[str] = None
    expires_at: Optional[datetime] = None
    user_id: Optional[UUID] = None


class ClinicAdminRead(BaseModel):
    id: UUID
    name: str
    phone: Optional[str]
    logo_url: Optional[str]
    brand_color: Optional[str]
    button_color: Optional[str] = None
    public_slug: str
    public_url: str
    doctors_limit: int
    doctors_count: int
    access_status_code: str
    access_status_label: str


class MyClinicRead(BaseModel):
    clinic_id: UUID
    clinic_name: str
    clinic_public_slug: str
    clinic_public_url: str
    questionnaire_kind: QuestionnaireKind = Field(
        default="general",
        description="general — обычные анкеты; dental — стоматология; mixed — оба направления",
    )
    membership_id: UUID
    is_clinic_admin: bool
    is_doctor: bool
    is_operator: bool = False
    doctor_public_slug: Optional[str] = None
    doctor_public_url: Optional[str] = None
    specializations: list[SpecializationRead] = Field(default_factory=list)


class ClinicInvitationAdminCreated(ClinicInvitationCreated):
    middle_name: Optional[str] = None
    photo_url: Optional[str] = None
    specializations: list[SpecializationRead] = Field(default_factory=list)


class ClinicInvitationAdminRead(ClinicInvitationRead):
    middle_name: Optional[str] = None
    photo_url: Optional[str] = None
    specializations: list[SpecializationRead] = Field(default_factory=list)


class PatientLinkDoctor(BaseModel):
    membership_id: UUID
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    middle_name: Optional[str] = None
    public_url: str
    specializations: list[SpecializationRead] = Field(default_factory=list)


class ClinicPatientLinks(BaseModel):
    clinic_id: UUID
    clinic_name: str
    clinic_public_url: Optional[str] = None
    doctors: list[PatientLinkDoctor] = Field(default_factory=list)
