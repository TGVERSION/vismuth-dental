from datetime import datetime, timezone
from typing import Optional
from uuid import UUID, uuid4

from sqlalchemy import TIMESTAMP, Boolean, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from ..db import Base


class UserSettings(Base):
    __tablename__ = "user_settings"

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("service_user.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )

    mkb_code: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )
    autocomplete: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        default="dict_autocomplete",
    )
    fullness_complaints: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at: Mapped[Optional[datetime]] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=True,
    )
