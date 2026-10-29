"""Анкеты пациентов в разделе админа клиники (регистратура)."""

from datetime import datetime
from typing import Any, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field

RegistryStatusLiteral = Literal["invited", "in_progress", "completed", "printed", "signed"]


class RegistryQuestionnaireCreate(BaseModel):
    last_name: str = Field(..., max_length=255)
    first_name: str = Field(..., max_length=255)
    middle_name: Optional[str] = Field(default=None, max_length=255)


class RegistryQuestionnaireItem(BaseModel):
    id: UUID
    status: RegistryStatusLiteral = Field(
        description="invited — ссылка отправлена; in_progress — заполняется; "
        "completed — заполнена; printed — распечатана; signed — подписана",
    )
    patient_last_name: Optional[str] = None
    patient_first_name: Optional[str] = None
    patient_middle_name: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None
    printed_at: Optional[datetime] = None
    signed_at: Optional[datetime] = None
    invite_expires_at: Optional[datetime] = None


class RegistryQuestionnaireCreated(RegistryQuestionnaireItem):
    url: str = Field(description="Персональная ссылка; показывается один раз")


class RegistryQuestionnaireDetail(RegistryQuestionnaireItem):
    structured: Optional[dict[str, Any]] = Field(
        default=None,
        description="Карточка стоматологической анкеты (как у врача)",
    )
    gaps: Optional[list[Any]] = None


class RegistryLink(BaseModel):
    url: str = Field(description="Новая ссылка; прежняя перестаёт работать")

