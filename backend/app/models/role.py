from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db import Base

if TYPE_CHECKING:
    from .service_user import ServiceUser


ALLOWED_ROLE_NAMES = frozenset({"super_admin", "admin", "doctor", "patient"})
PRIVILEGED_ROLE_NAMES = frozenset({"super_admin", "admin"})


class Role(Base):
    __tablename__ = "role"

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    name_ru: Mapped[str] = mapped_column(String(100), nullable=False)

    user_links: Mapped[list["ServiceUserRole"]] = relationship(
        "ServiceUserRole",
        back_populates="role",
    )


class ServiceUserRole(Base):
    __tablename__ = "service_user_role"

    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("service_user.id", ondelete="CASCADE"),
        primary_key=True,
    )
    role_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("role.id"),
        nullable=False,
    )

    user: Mapped["ServiceUser"] = relationship(
        "ServiceUser",
        back_populates="user_role_link",
    )
    role: Mapped[Role] = relationship(
        "Role",
        back_populates="user_links",
        lazy="selectin",
    )
