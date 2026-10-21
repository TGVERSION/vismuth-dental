from datetime import datetime, timezone
from typing import Optional
from uuid import UUID, uuid4

from sqlalchemy import ForeignKey, Integer, String, Text, TIMESTAMP
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db import Base

GUIDELINE_STATUSES = frozenset(
    {"draft", "uploaded", "indexing", "active", "failed", "disabled"}
)


class ClinrecGuideline(Base):
    __tablename__ = "clinrec_guideline"

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    code: Mapped[str] = mapped_column(String(64), nullable=False)
    source_id: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    short_title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft")
    version: Mapped[str] = mapped_column(String(64), nullable=False)
    s3_bucket: Mapped[str] = mapped_column(String(255), nullable=False)
    s3_key: Mapped[str] = mapped_column(String(512), nullable=False)
    index_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[Optional[datetime]] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=True,
    )

    mkb_prefixes: Mapped[list["ClinrecGuidelineMkb"]] = relationship(
        "ClinrecGuidelineMkb",
        back_populates="guideline",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class ClinrecGuidelineMkb(Base):
    __tablename__ = "clinrec_guideline_mkb"

    guideline_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("clinrec_guideline.id", ondelete="CASCADE"),
        primary_key=True,
    )
    mkb_prefix: Mapped[str] = mapped_column(String(20), primary_key=True)

    guideline: Mapped["ClinrecGuideline"] = relationship(
        "ClinrecGuideline",
        back_populates="mkb_prefixes",
    )
