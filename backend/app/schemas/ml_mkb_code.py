from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field


class MkbEventType(StrEnum):
    form_click = "form_click"
    autocomplete_shown = "autocomplete_shown"
    suggestion_selected = "suggestion_selected"


class MkbCodeProxyRequest(BaseModel):
    field_name: str = Field(..., min_length=1, max_length=255)
    description: str = Field(..., min_length=1)
    n_candidates: int = Field(3, ge=1, le=20)
    use_llm: bool = True


class MkbCodeSelectRequest(BaseModel):
    field_name: str = Field(..., min_length=1, max_length=255)
    description: str = Field(..., min_length=1)
    n_candidates: int = Field(..., ge=-10, le=1000)
    selected_text: str | None = None
    event_type: MkbEventType


class MkbCodeProxyResponse(BaseModel):
    extracted_diagnosis: str | None = None
    candidates: list[dict[str, Any]] = []
    best_code: str | None = None
    best_name: str | None = None


class MlAutocompleteProxyRequest(BaseModel):
    field_name: str = Field(..., min_length=1, max_length=255)
    prefix: str = Field(..., min_length=1)
    suggestions_count: int = Field(5, ge=1, le=20)


class MlAutocompleteProxyResponse(BaseModel):
    suggestions: list[str] = []


class EventAcceptedResponse(BaseModel):
    detail: str = "accepted"
