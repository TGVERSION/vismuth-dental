"""HTTP-контракт проверки назначений ДМС (multipart)."""

import pytest
from fastapi.testclient import TestClient

import app.routers.check_dms as check_dms_endpoint
from app.routers import app
from app.schemas import AppointmentSegment, CheckDmsResponse, GuidelineFragment
from app.services.check_dms.errors import DmsError

client = TestClient(app)

PDF = b"%PDF-1.7\n"
FILES = {"file": ("kr.pdf", PDF, "application/pdf")}
DATA = {
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


def _patch(monkeypatch, *, read=None, verify=None) -> None:
    if read is not None:
        monkeypatch.setattr(check_dms_endpoint, "read_pdf_upload", read)
    if verify is not None:
        monkeypatch.setattr(check_dms_endpoint, "verify_appointments", verify)


def test_success_response(monkeypatch) -> None:
    async def fake_read(file, config):
        return PDF, "hash"

    async def fake_verify(content, file_hash, form, config):
        assert content == PDF
        assert form.mkb == DATA["mkb"]
        return _response()

    _patch(monkeypatch, read=fake_read, verify=fake_verify)

    response = client.post("/check_dms", files=FILES, data=DATA)

    assert response.status_code == 200
    payload = response.json()
    assert payload["appointments"][1] == {"text": "Плазмаферез", "unnecessary": True}
    assert payload["fragments"][0]["section"] == "3.4.2 Лекарственные средства"


@pytest.mark.parametrize(
    "payload",
    [
        {"files": FILES, "data": {"mkb": "I10"}},
        {"files": FILES, "data": {"appointments": "Амлодипин"}},
        {"files": FILES, "data": {"mkb": "I10", "appointments": "   "}},
        {"data": DATA},
    ],
)
def test_request_validation_returns_400(payload: dict) -> None:
    response = client.post("/check_dms", **payload)

    assert response.status_code == 400
    assert response.json()["detail"]["code"] == "invalid_request"


@pytest.mark.parametrize(
    ("code", "status"),
    [
        ("pdf_too_large", 413),
        ("pdf_invalid", 422),
    ],
)
def test_upload_errors_are_mapped(monkeypatch, code: str, status: int) -> None:
    async def fake_read(file, config):
        raise DmsError(code, "ошибка чтения", status)

    _patch(monkeypatch, read=fake_read)

    response = client.post("/check_dms", files=FILES, data=DATA)

    assert response.status_code == status
    assert response.json()["detail"] == {"code": code, "message": "ошибка чтения"}


@pytest.mark.parametrize(
    ("code", "status"),
    [
        ("pdf_text_empty", 422),
        ("llm_invalid_response", 502),
        ("llm_unavailable", 502),
        ("s3_timeout", 504),
    ],
)
def test_pipeline_errors_are_mapped(monkeypatch, code: str, status: int) -> None:
    async def fake_read(file, config):
        return PDF, "hash"

    async def fake_verify(content, file_hash, form, config):
        raise DmsError(code, "ошибка пайплайна", status)

    _patch(monkeypatch, read=fake_read, verify=fake_verify)

    response = client.post("/check_dms", files=FILES, data=DATA)

    assert response.status_code == status
    assert response.json()["detail"] == {"code": code, "message": "ошибка пайплайна"}


def test_unexpected_error_returns_500(monkeypatch) -> None:
    async def fake_read(file, config):
        return PDF, "hash"

    async def fake_verify(content, file_hash, form, config):
        raise RuntimeError("boom")

    _patch(monkeypatch, read=fake_read, verify=fake_verify)

    response = client.post("/check_dms", files=FILES, data=DATA)

    assert response.status_code == 500
    assert response.json()["detail"]["code"] == "internal_error"


def test_health_and_legacy_routes_still_work() -> None:
    assert client.get("/health").json() == {"status": "ok"}

    paths = {route.path for route in app.routes}
    assert "/clinrec_checking/check" in paths
    assert "/mkb_code" in paths
    assert "/check_dms" in paths


def test_openapi_describes_multipart_endpoint() -> None:
    schema = app.openapi()

    operation = schema["paths"]["/check_dms"]["post"]
    content = operation["requestBody"]["content"]
    assert "multipart/form-data" in content

    ref = content["multipart/form-data"]["schema"]["$ref"].split("/")[-1]
    properties = schema["components"]["schemas"][ref]["properties"]

    assert {"file", "mkb", "appointments"} <= set(properties)
    assert "CheckDmsResponse" in schema["components"]["schemas"]
