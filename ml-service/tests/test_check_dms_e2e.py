"""Сквозная проверка через multipart на реальном PDF с замоканными LLM."""

import hashlib
import types
import uuid
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from qdrant_client import QdrantClient

import app.routers.check_dms as check_dms_endpoint
from app.config import DmsConfig
from app.routers import app
from app.services.check_dms import indexer, pipeline, retrieval, store
from app.services.check_dms.store import EMBEDDING_DIM, count_by_hash

REAL_PDF = Path("КР62_3.pdf")
TEXT = "Амлодипин 5 мг 1 раз в сутки; Денервация почечных артерий; Плазмаферез"
CLIENT = TestClient(app)


def _fake_embed(texts: list[str]) -> list[list[float]]:
    return [[1.0] + [0.0] * (EMBEDDING_DIM - 1) for _ in texts]


@pytest.mark.skipif(not REAL_PDF.exists(), reason="нет тестового PDF клинрека")
def test_multipart_end_to_end_with_mocked_llm(monkeypatch) -> None:
    pdf = REAL_PDF.read_bytes()
    file_hash = hashlib.sha256(pdf).hexdigest()
    path = Path("storage/test-qdrant") / uuid.uuid4().hex
    qdrant = QdrantClient(path=str(path))

    config = DmsConfig(
        qdrant_path=str(path),
        collection="test_e2e",
        retrieval_max_chunks=10,
    )

    monkeypatch.setattr(store, "_client", qdrant)
    monkeypatch.setattr(indexer, "embed", _fake_embed)
    monkeypatch.setattr(retrieval, "embed", _fake_embed)
    monkeypatch.setattr(
        pipeline,
        "split_appointments",
        lambda text: ["Амлодипин 5 мг 1 раз в сутки", "Денервация почечных артерий", "Плазмаферез"],
    )
    monkeypatch.setattr(pipeline, "judge", lambda mkb, items, found: {2})
    monkeypatch.setattr(
        check_dms_endpoint,
        "settings",
        types.SimpleNamespace(dms=config),
    )

    request = {"files": {"file": ("kr.pdf", pdf, "application/pdf")}, "data": {"mkb": "I10", "appointments": TEXT}}

    first = CLIENT.post("/check_dms", **request)

    assert first.status_code == 200
    payload = first.json()
    assert "".join(segment["text"] for segment in payload["appointments"]) == TEXT
    assert payload["appointments"][-1]["unnecessary"] is True
    assert payload["fragments"]
    assert payload["fragments"][0]["section"].startswith(("1", "2", "3", "4", "5", "6", "7"))

    chunks_after_first = count_by_hash(qdrant, config.collection, file_hash)
    assert chunks_after_first > 0

    second = CLIENT.post("/check_dms", **request)

    assert second.status_code == 200
    assert count_by_hash(qdrant, config.collection, file_hash) == chunks_after_first

    qdrant.close()
