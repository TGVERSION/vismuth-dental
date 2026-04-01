from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class TemplateGroupCreate(BaseModel):
    group_name: str = Field(..., min_length=1, max_length=255, description="Название группы")


class TemplateGroupUpdate(BaseModel):
    group_name: str = Field(..., min_length=1, max_length=255, description="Новое название группы")


class TemplateGroupRead(BaseModel):
    id: UUID
    group_name: str
    creator_id: UUID
    created_at: datetime
    updated_at: datetime | None = None
    deleted_at: datetime | None = None

    class Config:
        from_attributes = True


class TemplateGroupIdNameRead(BaseModel):
    id: UUID
    group_name: str

    class Config:
        from_attributes = True
