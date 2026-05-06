from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from ..db import Base


class AutocompleteStats(Base):
    __tablename__ = "autocomplete_stats"

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("service_user.id"),
        nullable=False,
    )
    field_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    prefix: Mapped[str] = mapped_column(Text, nullable=False)
    suggestions_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    selected_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    event_type: Mapped[str] = mapped_column(String(64), nullable=False)
    type_autocomplete: Mapped[str] = mapped_column(String(64), nullable=False)
    shown_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
