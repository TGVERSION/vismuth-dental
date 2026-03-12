from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class ServiceUserRead(BaseModel):
    id: UUID
    login: str
    first_name: Optional[str]
    last_name: Optional[str]
    role: str
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime]
    deleted_at: Optional[datetime]

    class Config:
        from_attributes = True


class ServiceUserIdRead(BaseModel):
    id: UUID


class ServiceUserCreate(BaseModel):
    login: str = Field(..., description="Логин пользователя")
    password_hash: str = Field(
        ...,
        description="Хэш пароля (для тестов можно передавать произвольную строку)",
    )
    first_name: Optional[str] = Field(
        default=None,
        description="Имя пользователя",
    )
    last_name: Optional[str] = Field(
        default=None,
        description="Фамилия пользователя",
    )
    role: Optional[str] = Field(
        default="admin",
        description="Роль пользователя (admin/operator/viewer)",
    )
    is_active: Optional[bool] = Field(
        default=True,
        description="Флаг активности пользователя",
    )


class ServiceUserUpdate(BaseModel):
    login: Optional[str] = Field(
        default=None,
        description="Логин пользователя",
    )
    password_hash: Optional[str] = Field(
        default=None,
        description="Хэш пароля (для тестов можно передавать произвольную строку)",
    )
    first_name: Optional[str] = Field(
        default=None,
        description="Имя пользователя",
    )
    last_name: Optional[str] = Field(
        default=None,
        description="Фамилия пользователя",
    )
    role: Optional[str] = Field(
        default=None,
        description="Роль пользователя (admin/operator/viewer)",
    )
    is_active: Optional[bool] = Field(
        default=None,
        description="Флаг активности пользователя",
    )

