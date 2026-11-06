from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from .service_user import RoleName


ClinicRole = Literal['doctor', 'operator', 'clinic_admin', 'clinic_admin_doctor']


class UserMembershipUpdate(BaseModel):
    model_config = ConfigDict(extra='forbid')

    clinic_id: UUID | None
    clinic_role: ClinicRole | None
    specialization_ids: list[int] = Field(default_factory=list, max_length=50)

    @model_validator(mode='after')
    def validate_assignment(self):
        if (self.clinic_id is None) != (self.clinic_role is None):
            raise ValueError('Выберите клинику и роль вместе')
        doctor = self.clinic_role in ('doctor', 'clinic_admin_doctor')
        if doctor != bool(self.specialization_ids):
            raise ValueError('Специализации обязательны только для врача')
        return self


class UserMembershipRead(BaseModel):
    id: UUID
    login: str
    role: RoleName
    role_name_ru: str
    is_active: bool
    clinic_id: UUID | None
    clinic_name: str | None
    membership_id: UUID | None
    clinic_role: ClinicRole | None
    specialization_ids: list[int]
