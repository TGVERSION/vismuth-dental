from datetime import datetime, timezone
from typing import Any, Optional
from uuid import UUID, uuid4

from sqlalchemy import TIMESTAMP, ForeignKey, String, Text, Integer
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from ..db import Base


class Consultation(Base):
    __tablename__ = "consultation"

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )

    service_user: Mapped[Optional[UUID]] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("service_user.id"),
        nullable=True,
    )

    external_system: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    external_patient_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    external_doctor_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    external_visit_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    consultation_datetime: Mapped[Optional[datetime]] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=True,
    )

    complaints: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    disease_anamnesis: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    disease_history: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    patient_condition: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    life_anamnesis: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    bad_habits: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    allergy_anamnesis: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    vital_parameters: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    objective_data: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    clinical_assessment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    consultation_conclusion: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    main_diagnosis: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    comorbid_diagnoses: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    recommendations: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    prescriptions: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    protocol_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    status_protocol: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    protocol_template_id: Mapped[Optional[UUID]] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("protocol_template.id"),
        nullable=True,
    )
    extra_fields: Mapped[Optional[dict[str, Any]]] = mapped_column(JSONB, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at: Mapped[Optional[datetime]] = mapped_column(
        TIMESTAMP(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=True,
    )
    deleted_at: Mapped[Optional[datetime]] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=True,
    )

