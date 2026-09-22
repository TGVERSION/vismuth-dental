from typing import Literal

from pydantic import BaseModel, ConfigDict

RoleName = Literal["super_admin", "admin", "doctor", "patient"]


class RoleRead(BaseModel):
    name: RoleName
    name_ru: str

    model_config = ConfigDict(from_attributes=True)
