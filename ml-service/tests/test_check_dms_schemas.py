"""Схемы запроса и ответа проверки назначений ДМС."""

import pytest
from pydantic import ValidationError

from app.schemas import (
    AppointmentSegment,
    CheckDmsRequest,
    CheckDmsResponse,
    GuidelineFragment,
)

VALID = {
    "pdf_url": "http://127.0.0.1:9000/vismuth-clinrec/guidelines/62/3/source.pdf?X-Amz-Signature=abc",
    "mkb": "I10 Эссенциальная [первичная] гипертензия",
    "appointments": "Амлодипин 5 мг 1 раз в сутки; ЭКГ покоя; Плазмаферез",
}


def test_request_accepts_valid_payload() -> None:
    request = CheckDmsRequest(**VALID)

    assert request.pdf_url == VALID["pdf_url"]


@pytest.mark.parametrize("missing", ["pdf_url", "mkb", "appointments"])
def test_request_requires_every_field(missing: str) -> None:
    payload = {key: value for key, value in VALID.items() if key != missing}

    with pytest.raises(ValidationError):
        CheckDmsRequest(**payload)


@pytest.mark.parametrize("field", ["pdf_url", "mkb", "appointments"])
def test_request_rejects_blank_values(field: str) -> None:
    payload = {**VALID, field: "   "}

    with pytest.raises(ValidationError):
        CheckDmsRequest(**payload)


def test_request_rejects_non_http_url() -> None:
    with pytest.raises(ValidationError):
        CheckDmsRequest(**{**VALID, "pdf_url": "file:///tmp/source.pdf"})


def test_request_strips_appointments() -> None:
    request = CheckDmsRequest(**{**VALID, "appointments": "  Амлодипин  "})

    assert request.appointments == "Амлодипин"


def test_request_rejects_too_long_appointments() -> None:
    with pytest.raises(ValidationError):
        CheckDmsRequest(**{**VALID, "appointments": "а" * 4001})


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
