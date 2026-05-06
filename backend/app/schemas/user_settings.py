from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, field_validator

AUTOCOMPLETE_VALUES = frozenset({"ml_autocomplete", "dict_autocomplete", "off"})


def _validate_autocomplete(value: Optional[str]) -> Optional[str]:
    if value is None:
        return value
    if value not in AUTOCOMPLETE_VALUES:
        allowed = ", ".join(sorted(AUTOCOMPLETE_VALUES))
        raise ValueError(f"autocomplete must be one of: {allowed}")
    return value


class UserSettingsRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    mkb_code: bool
    autocomplete: str
    fullness_complaints: bool
    created_at: datetime
    updated_at: Optional[datetime] = None


class UserSettingsCreate(BaseModel):
    mkb_code: Optional[bool] = None
    autocomplete: Optional[str] = None
    fullness_complaints: Optional[bool] = None

    @field_validator("autocomplete")
    @classmethod
    def _check_autocomplete(cls, value: Optional[str]) -> Optional[str]:
        return _validate_autocomplete(value)


class UserSettingsUpdate(BaseModel):
    mkb_code: bool
    autocomplete: str
    fullness_complaints: bool

    @field_validator("autocomplete")
    @classmethod
    def _check_autocomplete(cls, value: str) -> str:
        return _validate_autocomplete(value)


class UserSettingsPatch(BaseModel):
    mkb_code: Optional[bool] = None
    autocomplete: Optional[str] = None
    fullness_complaints: Optional[bool] = None

    @field_validator("autocomplete")
    @classmethod
    def _check_autocomplete(cls, value: Optional[str]) -> Optional[str]:
        return _validate_autocomplete(value)
