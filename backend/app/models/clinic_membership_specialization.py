from uuid import UUID

from sqlalchemy import ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from ..db import Base


class ClinicMembershipSpecialization(Base):
    __tablename__ = "clinic_membership_specialization"

    membership_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("clinic_membership.id", ondelete="CASCADE"),
        primary_key=True,
    )
    specialization_id: Mapped[int] = mapped_column(Integer, primary_key=True)


class ClinicInvitationSpecialization(Base):
    __tablename__ = "clinic_invitation_specialization"

    invitation_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("clinic_invitation.id", ondelete="CASCADE"),
        primary_key=True,
    )
    specialization_id: Mapped[int] = mapped_column(Integer, primary_key=True)
