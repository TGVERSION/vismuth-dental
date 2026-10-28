"""Сквозная проверка на реальном PDF с замоканными LLM и эмбеддингами."""

import asyncio
import time
import uuid
from pathlib import Path

import pytest
from qdrant_client import QdrantClient

from app.config import DmsConfig
from app.schemas import CheckDmsRequest
from app.services.check_dms import indexer, pipeline, retrieval, store
from app.services.check_dms.store import EMBEDDING_DIM, count_by_hash

REAL_PDF = Path("КР62_3.pdf")
TEXT = "Амлодипин 5 мг 1 раз в сутки; Денервация почечных артерий; Плазмаферез"


def _fake_embed(texts: list[str]) -> list[list[float]]:
    return [[1.0] + [0.0] * (EMBEDDING_DIM - 1) for _ in texts]


@pytest.mark.skipif(not REAL_PDF.exists(), reason="нет тестового PDF клинрека")
def test_end_to_end_with_mocked_llm(monkeypatch) -> None:
    path = Path("storage/test-qdrant") / uuid.uuid4().hex
    client = QdrantClient(path=str(path))
    file_hash = uuid.uuid5(uuid.NAMESPACE_URL, "kr62").hex

    monkeypatch.setattr(store, "_client", client)
    monkeypatch.setattr(indexer, "embed", _fake_embed)
    monkeypatch.setattr(retrieval, "embed", _fake_embed)
    monkeypatch.setattr(
        pipeline,
        "download_pdf",
        lambda url, config: asyncio.sleep(0, result=(REAL_PDF.read_bytes(), file_hash)),
    )
    monkeypatch.setattr(pipeline, "save_pdf", lambda content, digest, config: REAL_PDF)
    monkeypatch.setattr(
        pipeline,
        "split_appointments",
        lambda text: ["Амлодипин 5 мг 1 раз в сутки", "Денервация почечных артерий", "Плазмаферез"],
    )
    monkeypatch.setattr(pipeline, "judge", lambda mkb, items, found: {2})

    parsed: dict[str, list] = {}
    real_extract = pipeline.extract_pages
    monkeypatch.setattr(
        pipeline,
        "extract_pages",
        lambda path: parsed.setdefault("pages", real_extract(path)),
    )

    config = DmsConfig(
        qdrant_path=str(path),
        collection="test_e2e",
        retrieval_max_chunks=10,
    )
    request = CheckDmsRequest(
        pdf_url="https://s3.local/source.pdf",
        mkb="I10 Эссенциальная гипертензия",
        appointments=TEXT,
    )

    response = asyncio.run(pipeline.verify_appointments(request, config))

    assert "".join(segment.text for segment in response.appointments) == TEXT
    assert response.appointments[-1].unnecessary is True
    assert response.fragments
    assert response.fragments[0].section.startswith(("1", "2", "3", "4", "5", "6", "7"))

    first_count = count_by_hash(client, config.collection, file_hash)
    started = time.perf_counter()
    second = indexer.index_document(parsed["pages"], file_hash, config)
    elapsed = time.perf_counter() - started

    assert second is False
    assert count_by_hash(client, config.collection, file_hash) == first_count
    assert elapsed < 30

    client.close()
