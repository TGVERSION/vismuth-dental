from datetime import datetime
from typing import Optional

from sqlalchemy import BigInteger, String, TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column

from ..db import Base


class Dictionary(Base):
    __tablename__ = "dictionary"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    oid: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)
    updated_at: Mapped[Optional[datetime]] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=True,
    )
    deleted_at: Mapped[Optional[datetime]] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=True,
    )
