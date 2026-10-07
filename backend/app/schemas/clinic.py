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
    doctors_limit: int = Field(
        default=10,
        ge=0,
        description="Максимум активных врачей (membership is_doctor) в клинике.",
    )
    access_until: date = Field(description="Дата окончания доступа (включительно по логике access).")
    access_type: AccessType = Field(description="trial | paid — тип подписки.")


class ClinicPatch(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    phone: Optional[str] = Field(default=None, max_length=64)
    email: Optional[EmailStr] = None
    logo_url: Optional[str] = None
    brand_color: Optional[str] = Field(default=None, max_length=32)
    doctors_limit: Optional[int] = Field(
        default=None,
        ge=0,
        description="Максимум активных врачей в клинике.",
    )
    access_until: Optional[date] = Field(
        default=None,
        description="Дата окончания доступа.",
    )
    access_type: Optional[AccessType] = Field(
        default=None,
        description="trial | paid.",
    )


class ClinicRead(BaseModel):
    id: UUID
    name: str
    phone: Optional[str]
    email: Optional[str]
    logo_url: Optional[str]
    brand_color: Optional[str]
    doctors_limit: int = Field(description="Лимит активных врачей.")
    access_until: date
    access_type: AccessType
    public_slug: str = Field(description="Slug публичной ссылки клиники (/public/links/{slug}).")
    access_status_code: AccessStatusCode = Field(
        description="Вычисляемый статус: trial | paid | expired.",
    )
    access_status_label: str = Field(description="Человекочитаемая подпись статуса доступа.")
    doctors_count: int = 0
    free_codes_ratio: Optional[float] = Field(
        default=None,
        description=(
            "Доля еще свободных 4-значных кодов клиники в окне уникальности "
            "(1.0 = все свободны, уменьшается по мере выдачи)."
        ),
    )
    clinic_daily_limit_exceeded: bool = Field(
        default=False,
        description="True — суточный лимит завершенных анкет клиники исчерпан.",
    )
    questionnaires_completed_month: int = Field(
        default=0,
        description="Число завершенных анкет за текущий календарный месяц.",
    )
    created_at: datetime
    updated_at: Optional[datetime]
    deleted_at: Optional[datetime]

    model_config = ConfigDict(from_attributes=True)


class ClinicInvitationCreate(BaseModel):
    email: EmailStr
    first_name: Optional[str] = Field(default=None, max_length=255)
    last_name: Optional[str] = Field(default=None, max_length=255)
    middle_name: Optional[str] = Field(default=None, max_length=255)
    photo_url: Optional[str] = None
    is_clinic_admin: bool = Field(
        default=True,
        description="Приглашаемый станет clinic admin.",
    )
    is_doctor: bool = Field(
        default=False,
        description="Приглашаемый получит роль врача (membership is_doctor).",
    )
    specialization_ids: list[int] = Field(
        default_factory=list,
        description="ID специализаций врача (если is_doctor).",
    )


class ClinicInvitationRead(BaseModel):
    id: UUID
    clinic_id: UUID
    email: str
    first_name: Optional[str]
    last_name: Optional[str]
    middle_name: Optional[str] = None
    photo_url: Optional[str] = None
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
    invite_url: str = Field(description="Ссылка для принятия приглашения (raw token в URL).")
    email_sent: bool = Field(description="True — письмо с invite ушло через SMTP.")
    email_error: Optional[str] = Field(
        default=None,
        description="Текст ошибки SMTP, если email_sent=false.",
    )
