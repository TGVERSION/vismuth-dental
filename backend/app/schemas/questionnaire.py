from datetime import date
from typing import Any, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class PublicLinkDoctor(BaseModel):
    membership_id: UUID
    public_slug: str
    photo_url: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    middle_name: Optional[str] = None
    specializations: list[dict[str, Any]] = Field(default_factory=list)


class PublicLinkResponse(BaseModel):
    link_type: Literal["clinic", "doctor"]
    clinic_id: UUID
    clinic_name: str
    phone: Optional[str] = None
    logo_url: Optional[str] = None
    brand_color: Optional[str] = None
    clinic_public_slug: str
    doctor: Optional[PublicLinkDoctor] = None
    doctors: list[PublicLinkDoctor] = Field(default_factory=list)
    blocked: bool = False
    block_code: Optional[str] = None
    block_message: Optional[str] = None


class QuestionnaireCreateRequest(BaseModel):
    slug: str = Field(..., min_length=4, max_length=32)
    doctor_membership_id: Optional[UUID] = None


class StepDescriptorResponse(BaseModel):
    step_key: str
    step_type: str
    title: Optional[str] = None
    text: Optional[str] = None
    required: bool = True
    allow_skip: bool = False
    allow_none: bool = False
    choices: list[dict[str, str]] = Field(default_factory=list)
    options: list[dict[str, Any]] = Field(default_factory=list)
    date_min: Optional[str] = None
    date_max: Optional[str] = None
    code: Optional[str] = None
    completed: bool = False
    truncated: bool = False
    ai_unavailable: bool = False


class QuestionnaireCreateResponse(BaseModel):
    id: UUID
    token: str
    step: StepDescriptorResponse


class QuestionnaireAnswerRequest(BaseModel):
    step_key: str
    value: Optional[str] = Field(default=None, max_length=5000)
    choice: Optional[str] = None
    skip: bool = False
    none: bool = False
    doctor_membership_id: Optional[UUID] = None
    specialization_id: Optional[int] = None
    first_name: Optional[str] = Field(default=None, max_length=255)
    middle_name: Optional[str] = Field(default=None, max_length=255)
    appointment_date: Optional[date] = None
    appointment_time: Optional[str] = None


class DoctorQuestionnaireListItem(BaseModel):
    id: UUID
    appointment_time: Optional[str] = None
    patient_first_name: Optional[str] = None
    patient_middle_name: Optional[str] = None
    visit_type: Optional[str] = None
    specialization_name: Optional[str] = None
    code: Optional[str] = None
    protocol_id: Optional[UUID] = None
    appointment_date: Optional[date] = None


class QuestionnaireAnswerItem(BaseModel):
    seq: int
    step_key: str
    kind: str
    question_text: Optional[str] = None
    answer_text: Optional[str] = None
    choice: Optional[str] = None


class DoctorQuestionnaireDetail(BaseModel):
    id: UUID
    visit_type: Optional[str] = None
    specialization_name: Optional[str] = None
    patient_first_name: Optional[str] = None
    patient_middle_name: Optional[str] = None
    appointment_date: Optional[date] = None
    appointment_time: Optional[str] = None
    code: Optional[str] = None
    ai_unavailable: bool
    protocol_id: Optional[UUID] = None
    structured: Optional[dict[str, Any]] = None
    gaps: Optional[list[Any]] = None
    processing_status: Optional[str] = None
    answers: list[QuestionnaireAnswerItem] = Field(default_factory=list)


class CreateProtocolFromQuestionnaireRequest(BaseModel):
    protocol_structure_id: UUID
    protocol_name: Optional[str] = Field(default=None, max_length=255)
