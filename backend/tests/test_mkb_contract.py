from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine

from app.db import get_db
from app.deps import get_identity_user
from app.main import app
from app.models.mkb10 import Mkb10
from app.routers import ml_mkb_code


@pytest.fixture
def client(monkeypatch):
    # SQLite needs these functions to exercise the same ILIKE/concat query with Cyrillic.
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
    with engine.connect() as connection:
        sqlite = connection.connection.driver_connection
        sqlite.create_function("concat", -1, lambda *parts: "".join(parts))
        sqlite.create_function("lower", 1, str.lower)
        Mkb10.__table__.create(connection)
        connection.execute(Mkb10.__table__.insert(), [
            {"row_id": 1, "mkb_code": "K29.7", "mkb_name": "Гастрит неуточнённый"},
            {"row_id": 2, "mkb_code": "K29.1", "mkb_name": "Другие острые гастриты"},
            {"row_id": 3, "mkb_code": "J00", "mkb_name": "Острый назофарингит"},
        ])

        async def execute(statement):
            return connection.execute(statement)

        monkeypatch.setitem(app.dependency_overrides, get_db, lambda: SimpleNamespace(execute=execute))
        with TestClient(app) as test_client:
            yield test_client
    engine.dispose()


def test_dictionary_search_and_pagination(client, monkeypatch):
    assert client.get("/mkb10").status_code == 401
    monkeypatch.setitem(app.dependency_overrides, get_identity_user, lambda: SimpleNamespace())

    for query, page, total, codes in [
        ("k29.1", 1, 1, ["K29.1"]),
        ("ГАСТРИТ", 1, 2, ["K29.1"]),
        ("ГАСТРИТ", 2, 2, ["K29.7"]),
        ("ГАСТРИТ", 3, 2, []),
        ("no match", 1, 0, []),
        ("", 1, 3, ["J00"]),
        (None, 1, 3, ["J00"]),
    ]:
        params = {"page": page, "size": 1}
        if query is not None:
            params["searchValue"] = query
        response = client.get("/mkb10", params=params)
        assert response.status_code == 200
        body = response.json()
        assert (body["page"], body["size"], body["totalCount"]) == (page, 1, total)
        assert [item["code"] for item in body["items"]] == codes


def test_ml_response_examples_match_contract_and_invalid_upstream_is_an_error(client, monkeypatch):
    schema = client.get("/openapi.json").json()
    operation = schema["paths"]["/ml_mkb_code"]["post"]
    responses = operation["responses"]
    assert set(responses) == {"200", "401", "403", "422", "500", "502", "503", "504"}
    models = schema["components"]["schemas"]
    response_model = models["MkbCodeProxyResponse"]
    assert set(response_model["required"]) == {"extracted_diagnosis", "candidates", "best_code", "best_name"}
    candidate = response_model["properties"]["candidates"]["items"]
    assert candidate == {"$ref": "#/components/schemas/MkbCodeCandidate"}
    assert set(models["MkbCodeCandidate"]["required"]) == {"code", "name", "distance", "similarity"}

    payload = operation["requestBody"]["content"]["application/json"]["examples"]["main_diagnosis"]["value"]
    assert client.post("/ml_mkb_code", json=payload).status_code == 401
    monkeypatch.setitem(
        app.dependency_overrides, ml_mkb_code.require_clinical_user, lambda: SimpleNamespace(id=uuid4()),
    )
    monkeypatch.setattr(ml_mkb_code, "ensure_user_clinic_subscription_active", AsyncMock())
    proxy = AsyncMock()
    monkeypatch.setattr(ml_mkb_code, "proxy_post_to_ml", proxy)
    monkeypatch.setattr(ml_mkb_code, "get_redis_client", lambda: SimpleNamespace(aclose=AsyncMock()))
    monkeypatch.setattr(ml_mkb_code, "publish_event", AsyncMock())
    for example in responses["200"]["content"]["application/json"]["examples"].values():
        proxy.return_value = example["value"]
        response = client.post("/ml_mkb_code", json=payload)
        assert response.status_code == 200
        assert response.json() == example["value"]

    proxy.return_value = {}
    response = client.post("/ml_mkb_code", json=payload)
    assert response.status_code == 502
    assert response.json() == {"detail": "Invalid ml-service response"}
