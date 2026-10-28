"""Индексация документа: пропуск повторной векторизации по хэшу."""

import uuid
from pathlib import Path

import pytest
from qdrant_client import QdrantClient

from app.config import DmsConfig
from app.services.check_dms import indexer
from app.services.check_dms.parser import PageText
from app.services.check_dms.store import EMBEDDING_DIM, count_by_hash


@pytest.fixture()
def qdrant() -> QdrantClient:
    path = Path("storage/test-qdrant") / uuid.uuid4().hex
    client = QdrantClient(path=str(path))
    yield client
    client.close()


@pytest.fixture()
def patch_client(monkeypatch, qdrant: QdrantClient):
    monkeypatch.setattr(indexer, "get_client", lambda config: qdrant)
    return qdrant


def _pages() -> list[PageText]:
    return [
        PageText(
            number=1,
            text="3.4.2 Лекарственные средства\n" + "Амлодипин рекомендован. " * 100,
            table_rows=(),
        )
    ]


def test_first_call_indexes_and_second_is_skipped(monkeypatch, patch_client) -> None:
    config = DmsConfig()
    file_hash = uuid.uuid4().hex
    embed_calls: list[list[str]] = []

    def fake_embed(texts: list[str]) -> list[list[float]]:
        embed_calls.append(texts)
        return [[1.0] + [0.0] * (EMBEDDING_DIM - 1) for _ in texts]

    monkeypatch.setattr(indexer, "embed", fake_embed)

    first = indexer.index_document(_pages(), file_hash, config)
    second = indexer.index_document(_pages(), file_hash, config)

    assert first is True
    assert second is False
    assert len(embed_calls) == 1
    assert count_by_hash(patch_client, config.collection, file_hash) > 0


def test_skip_does_not_chunk_or_embed(monkeypatch, patch_client) -> None:
    config = DmsConfig()
    file_hash = uuid.uuid4().hex
    called: list[str] = []

    monkeypatch.setattr(
        indexer,
        "embed",
        lambda texts: [[1.0] + [0.0] * (EMBEDDING_DIM - 1) for _ in texts],
    )
    indexer.index_document(_pages(), file_hash, config)

    monkeypatch.setattr(indexer, "chunk_pages", lambda *args, **kwargs: called.append("chunk") or [])
    monkeypatch.setattr(indexer, "embed", lambda texts: called.append("embed") or [])

    result = indexer.index_document(_pages(), file_hash, config)

    assert result is False
    assert called == []
