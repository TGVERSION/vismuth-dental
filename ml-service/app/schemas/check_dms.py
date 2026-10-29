"""Схемы проверки назначений ДМС по клиническим рекомендациям."""

from pydantic import BaseModel, Field, field_validator


class CheckDmsForm(BaseModel):
    """Текстовые поля multipart-запроса; PDF приходит отдельным файлом."""

    mkb: str = Field(
        max_length=255,
        description="Код МКБ и справочное название диагноза одной строкой",
    )
    appointments: str = Field(
        max_length=4000,
        description="Назначения врача свободным текстом: препараты и процедуры",
    )

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
