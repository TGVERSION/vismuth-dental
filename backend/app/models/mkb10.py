from datetime import date
from typing import Optional

from sqlalchemy import BigInteger, Date, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from ..db import Base


class Mkb10(Base):
    __tablename__ = "ref_mkb10"

    # В DDL: row_id BIGSERIAL PRIMARY KEY
    row_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)

    # Остальные поля нам нужны только для корректного маппинга схемы
    id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    rec_code: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    mkb_code: Mapped[str] = mapped_column(String(20), nullable=False)
    mkb_name: Mapped[str] = mapped_column(String(500), nullable=False)
    id_parent: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    addl_code: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    actual: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    date_column: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

