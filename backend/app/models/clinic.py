from datetime import date, datetime, timezone
from typing import Optional
from uuid import UUID, uuid4

from sqlalchemy import Date, Integer, String, Text, TIMESTAMP
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from ..db import Base

ACCESS_TYPES = frozenset({"trial", "paid"})
MEMBERSHIP_STATUSES = frozenset({"active", "deactivated"})


class Clinic(Base):
    __tablename__ = "clinic"

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    logo_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    brand_color: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    doctors_limit: Mapped[int] = mapped_column(Integer, nullable=False, default=10)
    access_until: Mapped[date] = mapped_column(Date, nullable=False)
    access_type: Mapped[str] = mapped_column(String(20), nullable=False)
    public_slug: Mapped[str] = mapped_column(String(32), nullable=False)
    questionnaire_kind: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="general",
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
    deleted_at: Mapped[Optional[datetime]] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=True,
    )
