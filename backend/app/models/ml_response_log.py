from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from ..db import Base


class MlResponseLog(Base):
    __tablename__ = "ml_response_logs"

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
    endpoint_name: Mapped[str] = mapped_column(String(64), nullable=False)
    ml_path: Mapped[str] = mapped_column(String(128), nullable=False)
    http_status_code: Mapped[int | None] = mapped_column(Integer, nullable=True)
    response_status: Mapped[str] = mapped_column(String(64), nullable=False)
    response_comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    response_payload: Mapped[dict | list | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
