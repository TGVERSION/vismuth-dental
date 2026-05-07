from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict


class DictionaryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    oid: str
    name: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None


class RefSearchResponse(BaseModel):
    name: str
    total: int
    limit: int
    offset: int
    items: list[dict[str, Any]]
