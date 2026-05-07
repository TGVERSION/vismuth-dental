from typing import Optional

from pydantic import BaseModel, Field


class MlClinrecCheckRequest(BaseModel):
    protocol_text: str = Field(..., min_length=1)


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
