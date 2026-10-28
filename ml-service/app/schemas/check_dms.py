"""Схемы проверки назначений ДМС по клиническим рекомендациям."""

from pydantic import BaseModel, Field, field_validator

_URL_PREFIXES = ("http://", "https://")


class CheckDmsRequest(BaseModel):
    """Вход проверки: PDF клинрека, код МКБ и текст назначений."""

    pdf_url: str = Field(
        max_length=2048,
        description="Presigned-ссылка на PDF клинического рекомендации",
    )
    mkb: str = Field(
        max_length=255,
        description="Код МКБ и справочное название диагноза одной строкой",
    )
    appointments: str = Field(
        max_length=4000,
        description="Назначения врача свободным текстом: препараты и процедуры",
    )

    @field_validator("pdf_url")
    @classmethod
    def _validate_pdf_url(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("pdf_url must not be empty")
        if not cleaned.startswith(_URL_PREFIXES):
            raise ValueError("pdf_url must be an http(s) URL")
        return cleaned

    @field_validator("mkb", "appointments")
    @classmethod
    def _validate_text(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("value must not be blank")
        return cleaned


class AppointmentSegment(BaseModel):
    """Фрагмент исходного текста назначений с признаком «лишнее»."""

    text: str = Field(description="Часть исходного текста назначений без изменений")
    unnecessary: bool = Field(
        description="True, если назначение не подтверждается клиническими рекомендациями",
    )


class GuidelineFragment(BaseModel):
    """Фрагмент клинического рекомендации, подтверждающий вердикт."""

    section: str = Field(description="Номер и заголовок раздела клинрека")
    text: str = Field(description="Текст фрагмента")


class CheckDmsResponse(BaseModel):
    """Результат проверки назначений."""

    appointments: list[AppointmentSegment] = Field(
        description="Назначения, разбитые на сегменты в исходном порядке",
    )
    fragments: list[GuidelineFragment] = Field(
        description="Фрагменты клинрека, использованные при вынесении вердикта",
    )
