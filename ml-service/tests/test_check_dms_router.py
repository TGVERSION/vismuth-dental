"""HTTP-контракт проверки назначений ДМС."""

import pytest
from fastapi.testclient import TestClient

import app.routers.check_dms as check_dms_endpoint
from app.routers import app
from app.schemas import AppointmentSegment, CheckDmsResponse, GuidelineFragment
from app.services.check_dms.errors import DmsError

client = TestClient(app)

VALID = {
    "pdf_url": "http://127.0.0.1:9000/vismuth-clinrec/guidelines/62/3/source.pdf?X-Amz-Signature=abc",
    "mkb": "I10 Эссенциальная гипертензия",
    "appointments": "Амлодипин 5 мг 1 раз в сутки; Плазмаферез",
}


def _response() -> CheckDmsResponse:
    return CheckDmsResponse(
        appointments=[
            AppointmentSegment(text="Амлодипин 5 мг 1 раз в сутки; ", unnecessary=False),
            AppointmentSegment(text="Плазмаферез", unnecessary=True),
        ],
        fragments=[GuidelineFragment(section="3.4.2 Лекарственные средства", text="…")],
    )


def test_success_response(monkeypatch) -> None:
    async def fake_verify(request, config):
        return _response()

    monkeypatch.setattr(check_dms_endpoint, "verify_appointments", fake_verify)

    response = client.post("/check_dms", json=VALID)

    assert response.status_code == 200
    payload = response.json()
    assert payload["appointments"][1] == {"text": "Плазмаферез", "unnecessary": True}
    assert payload["fragments"][0]["section"] == "3.4.2 Лекарственные средства"


def test_request_validation_returns_400() -> None:
    response = client.post("/check_dms", json={"mkb": "I10"})

    assert response.status_code == 400
    assert response.json()["detail"]["code"] == "invalid_request"


@pytest.mark.parametrize(
    ("code", "status"),
    [
        ("pdf_too_large", 413),
        ("pdf_invalid", 422),
        ("pdf_text_empty", 422),
        ("s3_failed", 502),
        ("llm_invalid_response", 502),
        ("s3_timeout", 504),
    ],
)
def test_pipeline_errors_are_mapped(monkeypatch, code: str, status: int) -> None:
    async def fake_verify(request, config):
        raise DmsError(code, "ошибка", status)

    monkeypatch.setattr(check_dms_endpoint, "verify_appointments", fake_verify)

    response = client.post("/check_dms", json=VALID)

    assert response.status_code == status
    assert response.json()["detail"] == {"code": code, "message": "ошибка"}


def test_unexpected_error_returns_500(monkeypatch) -> None:
    async def fake_verify(request, config):
        raise RuntimeError("boom")

    monkeypatch.setattr(check_dms_endpoint, "verify_appointments", fake_verify)

    response = client.post("/check_dms", json=VALID)

    assert response.status_code == 500
    assert response.json()["detail"]["code"] == "internal_error"


def test_health_and_legacy_routes_still_work() -> None:
    assert client.get("/health").json() == {"status": "ok"}

    paths = {route.path for route in app.routes}
    assert "/clinrec_checking/check" in paths
    assert "/mkb_code" in paths
    assert "/check_dms" in paths


def test_openapi_describes_endpoint() -> None:
    schema = app.openapi()

    operation = schema["paths"]["/check_dms"]["post"]
    assert operation["summary"]
    assert "CheckDmsRequest" in schema["components"]["schemas"]
