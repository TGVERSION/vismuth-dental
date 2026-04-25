from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class ProtocolFieldMainListItem(BaseModel):
    id: UUID
    field_name: str | None
    field_label: str | None
    description: str | None
    endpoint_link: str | None
    created_at: datetime
    updated_at: datetime | None = None
    deleted_at: datetime | None = None

    class Config:
        from_attributes = True


class ProtocolFieldMainRead(BaseModel):
    id: UUID
    field_name: str | None
    field_label: str | None
    description: str | None
    endpoint_link: str | None
    created_at: datetime
    updated_at: datetime | None = None
    deleted_at: datetime | None = None

    class Config:
        from_attributes = True
