from datetime import datetime, timezone
from uuid import UUID, uuid4
from sqlalchemy import CheckConstraint, ForeignKey, Index, String, TIMESTAMP, text
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column
from ..db import Base


class ClinicJoinLink(Base):
    __tablename__ = 'clinic_join_link'
    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    clinic_id: Mapped[UUID] = mapped_column(ForeignKey('clinic.id'), nullable=False, index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    created_by: Mapped[UUID] = mapped_column(ForeignKey('service_user.id'), nullable=False)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=lambda: datetime.now(timezone.utc))
    revoked_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True))
    __table_args__ = (Index('uq_clinic_join_link_active', 'clinic_id', unique=True, postgresql_where=text('revoked_at IS NULL')),)


class ClinicJoinRequest(Base):
    __tablename__ = 'clinic_join_request'
    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    clinic_id: Mapped[UUID] = mapped_column(ForeignKey('clinic.id'), nullable=False, index=True)
    user_id: Mapped[UUID] = mapped_column(ForeignKey('service_user.id'), nullable=False, index=True)
    requested_role: Mapped[str] = mapped_column(String(20), nullable=False)
    specialization_ids: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default='pending')
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=lambda: datetime.now(timezone.utc))
    reviewed_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True))
    reviewed_by: Mapped[UUID | None] = mapped_column(ForeignKey('service_user.id'))
    __table_args__ = (
        CheckConstraint("requested_role IN ('operator', 'doctor', 'clinic_admin', 'clinic_admin_doctor')", name='ck_join_role'),
        CheckConstraint("status IN ('pending', 'approved', 'rejected')", name='ck_join_status'),
        Index('uq_clinic_join_pending', 'clinic_id', 'user_id', unique=True, postgresql_where=text("status = 'pending'")),
    )
