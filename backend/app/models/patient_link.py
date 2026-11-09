from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import ForeignKey, String, TIMESTAMP
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from ..db import Base


class PatientLink(Base):
    __tablename__ = 'patient_link'

    slug: Mapped[str] = mapped_column(String(18), primary_key=True)
    clinic_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey('clinic.id', ondelete='CASCADE'), nullable=False, index=True)
    selection_key: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    selection: Mapped[dict] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
