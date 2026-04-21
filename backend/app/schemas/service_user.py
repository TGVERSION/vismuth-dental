from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class ServiceUserMeResponse(BaseModel):
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
