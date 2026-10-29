"""Схемы запроса и ответа проверки назначений ДМС."""

import pytest
from pydantic import ValidationError

from app.schemas import (
    AppointmentSegment,
    CheckDmsForm,
    CheckDmsResponse,
    GuidelineFragment,
)

VALID = {
    "mkb": "I10 Эссенциальная [первичная] гипертензия",
    "appointments": "Амлодипин 5 мг 1 раз в сутки; ЭКГ покоя; Плазмаферез",
}


def test_form_accepts_valid_payload() -> None:
    form = CheckDmsForm(**VALID)

    assert form.mkb == VALID["mkb"]


@pytest.mark.parametrize("missing", ["mkb", "appointments"])
def test_form_requires_every_field(missing: str) -> None:
    payload = {key: value for key, value in VALID.items() if key != missing}

    with pytest.raises(ValidationError):
        CheckDmsForm(**payload)


@pytest.mark.parametrize("field", ["mkb", "appointments"])
def test_form_rejects_blank_values(field: str) -> None:
    with pytest.raises(ValidationError):
        CheckDmsForm(**{**VALID, field: "   "})


def test_form_strips_appointments() -> None:
    form = CheckDmsForm(**{**VALID, "appointments": "  Амлодипин  "})

    assert form.appointments == "Амлодипин"


def test_form_rejects_too_long_appointments() -> None:
    with pytest.raises(ValidationError):
        CheckDmsForm(**{**VALID, "appointments": "а" * 4001})


def test_response_serializes_to_contract() -> None:
    response = CheckDmsResponse(
        appointments=[
            AppointmentSegment(text="Амлодипин 5 мг 1 раз в сутки; ", unnecessary=False),
            AppointmentSegment(text="Плазмаферез", unnecessary=True),
        ],
        fragments=[
            GuidelineFragment(
                section="3.4.2 Лекарственные средства для лечения артериальной гипертензии",
                text="…",
            )
        ],
    )

    payload = response.model_dump()

    assert set(payload) == {"appointments", "fragments"}
    assert set(payload["appointments"][0]) == {"text", "unnecessary"}
    assert set(payload["fragments"][0]) == {"section", "text"}
    assert payload["appointments"][1]["unnecessary"] is True
