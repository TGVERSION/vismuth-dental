from datetime import datetime, timezone
from typing import Optional
from uuid import UUID, uuid4

from sqlalchemy import TIMESTAMP, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
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
    recommendations: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    prescriptions: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    disease_history: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    status_protocol: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
    deleted_at: Mapped[Optional[datetime]] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=True,
    )


class ConsultationProtocols(Base):
    __tablename__ = "consultation_protocols"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    consultation_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("consultation.id", ondelete="CASCADE"),
        nullable=False,
    )
    patient_condition: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    objective_data: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    consultation_conclusion: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )
    pathology_code: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    comment: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )


class ConsultationHabit(Base):
    __tablename__ = "consultation_habit"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    consultation_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("consultation.id", ondelete="CASCADE"),
        nullable=False,
    )
    bad_habits: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )


class ConsultationAllergyManifestation(Base):
    __tablename__ = "consultation_allergy_manifestation"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    consultation_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("consultation.id", ondelete="CASCADE"),
        nullable=False,
    )
    reaction_type: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    clinical_manifestations: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )


class ConsultationVitalSign(Base):
    __tablename__ = "consultation_vital_sign"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    consultation_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("consultation.id", ondelete="CASCADE"),
        nullable=False,
    )
    parameter_code: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    unit_code: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )


class ConsultationClinicalScale(Base):
    __tablename__ = "consultation_clinical_scale"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    consultation_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("consultation.id", ondelete="CASCADE"),
        nullable=False,
    )
    scale_type: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    unit_code: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    scale_parameter: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )


class ConsultationDiagnosis(Base):
    __tablename__ = "consultation_diagnosis"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    consultation_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("consultation.id", ondelete="CASCADE"),
        nullable=False,
    )
    diagnosis_type: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    icd10_code: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    diagnosis_validity: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )
    disease_nature: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

