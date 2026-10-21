from typing import Optional

from pydantic import BaseModel, Field


class MlClinrecCheckRequest(BaseModel):
    protocol_text: str = Field(..., min_length=1)
    mkb: Optional[str] = Field(
        default=None,
        description="Код МКБ-10 для resolve guideline (предпочтительный вход с UI)",
    )
    guideline_code: Optional[str] = Field(
        default=None,
        min_length=1,
        description="Код guideline из каталога; если задан — должен быть active",
    )
    main_diagnosis: Optional[str] = Field(
        default=None,
        description="Строка диагноза с ведущим МКБ, если mkb/guideline_code не заданы",
    )


class ClinrecFinding(BaseModel):
    severity: str
    section: str
    issue: str
    recommendation: str
    guideline_ref: str
    guideline_quote: str


class MlClinrecCheckResponse(BaseModel):
    severity_counts: dict[str, int]
    findings: list[ClinrecFinding]
    compliant_sections: list[str]
    error: Optional[str] = None
    guideline_code: Optional[str] = None
    guideline_title: Optional[str] = None
