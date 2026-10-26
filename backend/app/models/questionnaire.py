from datetime import date, datetime, timezone
from typing import Any, Optional
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    Date,
    ForeignKey,
    Integer,
    String,
    Text,
    TIMESTAMP,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from ..db import Base

QUESTIONNAIRE_STATUSES = frozenset({"in_progress", "completed", "abandoned"})
VISIT_TYPES = frozenset({"primary", "repeat"})


class Questionnaire(Base):
    __tablename__ = "questionnaire"

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    clinic_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("clinic.id"),
        nullable=False,
    )
    doctor_membership_id: Mapped[Optional[UUID]] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("clinic_membership.id"),
        nullable=True,
    )
    specialization_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    kind: Mapped[str] = mapped_column(String(20), nullable=False, default="general")
    visit_type: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="in_progress",
    )
    current_step: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        default="choose_doctor",
    )
    ai_questions_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    ai_unavailable: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    patient_first_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    patient_middle_name: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )
    appointment_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    appointment_time: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    code: Mapped[Optional[str]] = mapped_column(String(4), nullable=True)
    session_token_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    device_id_hash: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    ip_hash: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    last_activity_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=True,
    )
    protocol_id: Mapped[Optional[UUID]] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("protocols.id", ondelete="SET NULL"),
        nullable=True,
        unique=True,
    )
    structured: Mapped[Optional[dict[str, Any]]] = mapped_column(JSONB, nullable=True)
    gaps: Mapped[Optional[list[Any]]] = mapped_column(JSONB, nullable=True)
    processing_status: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    collect_form_state: Mapped[Optional[dict[str, Any]]] = mapped_column(
        JSONB,
        nullable=True,
    )
    dental_answers: Mapped[Optional[dict[str, Any]]] = mapped_column(
        JSONB,
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[Optional[datetime]] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=True,
    )


class QuestionnaireAnswer(Base):
    __tablename__ = "questionnaire_answer"

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    questionnaire_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("questionnaire.id", ondelete="CASCADE"),
        nullable=False,
    )
    seq: Mapped[int] = mapped_column(Integer, nullable=False)
    step_key: Mapped[str] = mapped_column(String(64), nullable=False)
    kind: Mapped[str] = mapped_column(String(32), nullable=False)
    question_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    answer_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    choice: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
