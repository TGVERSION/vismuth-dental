from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, Field


class MkbEventType(StrEnum):
    form_click = "form_click"
    autocomplete_shown = "autocomplete_shown"
    suggestion_selected = "suggestion_selected"


class AutocompleteType(StrEnum):
    ml_autocomplete = "ml_autocomplete"
    dict_autocomplete = "dict_autocomplete"


class MkbCodeProxyRequest(BaseModel):
    field_name: str = Field(
        min_length=1,
        max_length=255,
        description=(
            "Идентификатор поля для события аналитики. "
            "Для основного диагноза интерфейс передаёт main_diagnosis. "
            "Допустима любая строка указанной длины. На подбор не влияет."
        ),
    )
    description: str = Field(min_length=1, description="Текст для подбора диагноза.")
    n_candidates: int = Field(3, ge=1, le=20, description="Максимум кандидатов.")
    use_llm: bool = Field(True, description="Извлечь формулировку диагноза из текста перед поиском.")


class MkbCodeSelectRequest(BaseModel):
    field_name: str = Field(..., min_length=1, max_length=255)
    description: str = Field(..., min_length=1)
    n_candidates: int = Field(..., ge=-10, le=1000)
    selected_text: str | None = None
    event_type: MkbEventType
    type_autocomplete: AutocompleteType = AutocompleteType.ml_autocomplete


class MkbCodeCandidate(BaseModel):
    code: str = Field(description="Код МКБ-10.")
    name: str = Field(description="Название диагноза.")
    distance: float = Field(description="Расстояние до кандидата в векторном поиске.")
    similarity: float = Field(description="Оценка сходства, равная 1 минус distance.")


class MkbCodeProxyResponse(BaseModel):
    extracted_diagnosis: str | None = Field(
        description="Текст, извлечённый LLM. При use_llm=false возвращается исходный description.",
    )
    candidates: list[MkbCodeCandidate] = Field(
        description="Кандидаты в порядке ранжирования ML. При отсутствии результатов список пуст.",
    )
    best_code: str | None = Field(
        description="Код первого кандидата. При пустом списке возвращается null.",
    )
    best_name: str | None = Field(
        description="Название первого кандидата. При пустом списке возвращается null.",
    )


class MkbSubscriptionExpiredDetail(BaseModel):
    code: Literal["subscription_expired"]
    message: str
    phone: str | None


class MkbSubscriptionExpiredResponse(BaseModel):
    detail: MkbSubscriptionExpiredDetail


class MkbServiceValidationError(BaseModel):
    loc: list[str | int]
    msg: str
    type: str


class MkbServiceErrorResponse(BaseModel):
    detail: str | list[MkbServiceValidationError] = Field(
        description="Сообщение о сбое ML или список ошибок валидации от ML-сервиса.",
    )


class MlAutocompleteProxyRequest(BaseModel):
    field_name: str | None = Field(None, min_length=1, max_length=255)
    prefix: str = Field(..., min_length=1)
    suggestions_count: int = Field(5, ge=1, le=20)
    type_autocomplete: AutocompleteType = AutocompleteType.ml_autocomplete


class MlAutocompleteProxyResponse(BaseModel):
    suggestions: list[str] = []


class EventAcceptedResponse(BaseModel):
    detail: str = "accepted"
