from typing import Optional

from pydantic import BaseModel, Field, field_validator


class CheckDmsRequest(BaseModel):
    mkb: str = Field(
        ...,
        max_length=255,
        description="Код МКБ или строка «код + название» для resolve guideline",
    )
    appointments: str = Field(
        ...,
        max_length=4000,
        description="Назначения врача: препараты и процедуры",
    )

    @field_validator("mkb", "appointments")
    @classmethod
    def _non_blank(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("value must not be blank")
        return cleaned


class AppointmentSegment(BaseModel):
    text: str
    unnecessary: bool


class GuidelineFragment(BaseModel):
    section: str
    text: str


class CheckDmsResponse(BaseModel):
    appointments: list[AppointmentSegment]
    fragments: list[GuidelineFragment]
    guideline_code: Optional[str] = None
    guideline_title: Optional[str] = None
