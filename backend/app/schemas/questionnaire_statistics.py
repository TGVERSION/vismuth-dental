from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class DoctorStatisticsRow(BaseModel):
    doctor_membership_id: Optional[UUID] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    middle_name: Optional[str] = None
    completed_count: int = 0
    protocols_count: int = 0


class AbandonedStepRow(BaseModel):
    step_key: str
    ai_question_n: Optional[int] = Field(
        default=None,
        description="Номер AI-уточняющего вопроса (для шагов ai_clarify), иначе null.",
    )
    count: int


class ClinicQuestionnaireStatistics(BaseModel):
    """Статистика анкет одной клиники за период."""

    clinic_id: UUID
    period_from: datetime
    period_to: datetime
    completed_total: int = 0
    primary_count: int = Field(
        default=0,
        description="Завершенные анкеты с типом приема «первичный».",
    )
    repeat_count: int = Field(
        default=0,
        description="Завершенные анкеты с типом приема «повторный».",
    )
    protocols_total: int = 0
    by_doctor: list[DoctorStatisticsRow] = []
    abandoned_by_step: list[AbandonedStepRow] = []

    model_config = ConfigDict(from_attributes=True)


class ClinicStatisticsRow(ClinicQuestionnaireStatistics):
    clinic_name: str


class StatisticsSummary(BaseModel):
    period_from: datetime
    period_to: datetime
    completed_total: int = 0
    primary_count: int = Field(
        default=0,
        description="Сумма первичных приемов по клиникам.",
    )
    repeat_count: int = Field(
        default=0,
        description="Сумма повторных приемов по клиникам.",
    )
    protocols_total: int = 0
    abandoned_by_step: list[AbandonedStepRow] = []


class SuperAdminQuestionnaireStatistics(BaseModel):
    """Сводка по всем клиникам + summary за период."""

    period_from: datetime
    period_to: datetime
    clinics: list[ClinicStatisticsRow]
    summary: StatisticsSummary
