from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field

RoleName = Literal["super_admin", "admin", "doctor", "patient"]


class ServiceUserMeResponse(BaseModel):
    login: str
    first_name: Optional[str]
    last_name: Optional[str]
    role: RoleName
    role_name_ru: str
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime]
    deleted_at: Optional[datetime]

    model_config = ConfigDict(from_attributes=True)


class ServiceUserIdRead(BaseModel):
    id: UUID
    login: str
    role: RoleName
    role_name_ru: str

    model_config = ConfigDict(from_attributes=True)


class ServiceUserRead(BaseModel):
    id: UUID
    login: str
    first_name: Optional[str]
    last_name: Optional[str]
    role: RoleName
    role_name_ru: str
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime]
    deleted_at: Optional[datetime]

    model_config = ConfigDict(from_attributes=True)


class ServiceUserUpdate(BaseModel):
    login: EmailStr
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: RoleName
    is_active: bool
    password: Optional[str] = Field(default=None, min_length=8, max_length=128)


class ServiceUserPatch(BaseModel):
    login: Optional[EmailStr] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: Optional[RoleName] = None
    is_active: Optional[bool] = None
    password: Optional[str] = Field(default=None, min_length=8, max_length=128)
