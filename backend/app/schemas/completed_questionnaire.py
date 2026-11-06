from datetime import datetime

from .questionnaire import DoctorQuestionnaireDetail, DoctorQuestionnaireListItem
from pydantic import BaseModel
from typing import Literal
from uuid import UUID


class CompletedQuestionnaireItem(DoctorQuestionnaireListItem):
    clinic_id: UUID
    clinic_name: str
    kind: Literal['general', 'gastro', 'dental']
    completed_at: datetime | None = None
    printed_at: datetime | None = None
    signed_at: datetime | None = None


class CompletedQuestionnaireDetail(DoctorQuestionnaireDetail):
    clinic_id: UUID
    clinic_name: str
    completed_at: datetime | None = None
    printed_at: datetime | None = None
    signed_at: datetime | None = None


class CompletedQuestionnairePage(BaseModel):
    items: list[CompletedQuestionnaireItem]
    total: int
    page: int
    page_size: int
