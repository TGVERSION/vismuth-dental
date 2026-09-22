from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from .auth import TokenResponse


class InvitationPreview(BaseModel):
    email: str
    clinic_name: str
    clinic_id: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    is_clinic_admin: bool
    is_doctor: bool
    expires_at: datetime

    model_config = ConfigDict(from_attributes=True)


class InvitationAcceptRequest(BaseModel):
    token: str = Field(..., min_length=16, max_length=256)
    password: str = Field(..., min_length=8, max_length=128)
    first_name: Optional[str] = Field(default=None, max_length=255)
    last_name: Optional[str] = Field(default=None, max_length=255)


class InvitationAcceptResponse(TokenResponse):
    pass
