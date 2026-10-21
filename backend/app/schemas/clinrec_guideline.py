from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

GUIDELINE_STATUSES = (
    "draft",
    "uploaded",
    "indexing",
    "active",
    "failed",
    "disabled",
)


def normalize_mkb_prefix(value: str) -> str:
    text = value.strip().upper().replace(" ", "")
    if not text:
        raise ValueError("mkb_prefix must not be empty")
    return text


class ClinrecGuidelineCreate(BaseModel):
    code: str = Field(..., min_length=1, max_length=64)
    source_id: int = Field(..., ge=1)
    title: str = Field(..., min_length=1, max_length=500)
    short_title: Optional[str] = Field(None, max_length=255)
    version: str = Field(..., min_length=1, max_length=64)
    s3_key: str = Field(..., min_length=1, max_length=512)
    mkb_prefixes: list[str] = Field(default_factory=list)

    @field_validator("code")
    @classmethod
    def _strip_code(cls, value: str) -> str:
        text = value.strip()
        if not text:
            raise ValueError("code must not be empty")
        return text

    @field_validator("version")
    @classmethod
    def _strip_version(cls, value: str) -> str:
        text = value.strip()
        if not text:
            raise ValueError("version must not be empty")
        return text

    @field_validator("s3_key")
    @classmethod
    def _strip_s3_key(cls, value: str) -> str:
        text = value.strip()
        if not text:
            raise ValueError("s3_key must not be empty")
        return text

    @field_validator("mkb_prefixes")
    @classmethod
    def _normalize_prefixes(cls, values: list[str]) -> list[str]:
        normalized: list[str] = []
        seen: set[str] = set()
        for raw in values:
            prefix = normalize_mkb_prefix(raw)
            if prefix not in seen:
                seen.add(prefix)
                normalized.append(prefix)
        return normalized


class ClinrecGuidelinePatch(BaseModel):
    code: Optional[str] = Field(None, min_length=1, max_length=64)
    source_id: Optional[int] = Field(None, ge=1)
    title: Optional[str] = Field(None, min_length=1, max_length=500)
    short_title: Optional[str] = Field(None, max_length=255)
    version: Optional[str] = Field(None, min_length=1, max_length=64)
    s3_key: Optional[str] = Field(None, min_length=1, max_length=512)
    status: Optional[str] = Field(None)
    mkb_prefixes: Optional[list[str]] = None

    @field_validator("code")
    @classmethod
    def _strip_code(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        text = value.strip()
        if not text:
            raise ValueError("code must not be empty")
        return text

    @field_validator("version")
    @classmethod
    def _strip_version(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        text = value.strip()
        if not text:
            raise ValueError("version must not be empty")
        return text

    @field_validator("s3_key")
    @classmethod
    def _strip_s3_key(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        text = value.strip()
        if not text:
            raise ValueError("s3_key must not be empty")
        return text

    @field_validator("status")
    @classmethod
    def _validate_status(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        if value not in GUIDELINE_STATUSES:
            raise ValueError(f"status must be one of {GUIDELINE_STATUSES}")
        return value

    @field_validator("mkb_prefixes")
    @classmethod
    def _normalize_prefixes(cls, values: Optional[list[str]]) -> Optional[list[str]]:
        if values is None:
            return None
        normalized: list[str] = []
        seen: set[str] = set()
        for raw in values:
            prefix = normalize_mkb_prefix(raw)
            if prefix not in seen:
                seen.add(prefix)
                normalized.append(prefix)
        return normalized


class ClinrecGuidelineRead(BaseModel):
    id: UUID
    code: str
    source_id: int
    title: str
    short_title: Optional[str] = None
    status: str
    version: str
    s3_bucket: str
    s3_key: str
    index_error: Optional[str] = None
    mkb_prefixes: list[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ClinrecGuidelineIndexResponse(BaseModel):
    id: UUID
    code: str
    status: str
    version: str
    chunks: Optional[int] = None
    index_error: Optional[str] = None
