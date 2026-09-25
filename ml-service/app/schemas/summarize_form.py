from pydantic import BaseModel, Field


class PatientFormSummary(BaseModel):
    """Саммаризация анкеты пациента по истории чата."""

    complaints: str = Field(
        description="Жалобы пациента: что беспокоит, локализация, характер, давность",
    )
    medications: str = Field(
        description="Принимаемые препараты: названия и дозы",
    )
    allergy_anamnesis: str = Field(
        description="Аллергоанамнез: аллергии и непереносимость, реакция",
    )
