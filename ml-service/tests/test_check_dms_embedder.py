"""Эмбеддинги через GigaChat API: батчинг и ошибки."""

import types

import pytest
from gigachat.exceptions import GigaChatException

from app.services.check_dms import embedder
from app.services.check_dms.errors import DmsError
from app.services.check_dms.store import EMBEDDING_DIM


def _settings(batch: int = 64) -> types.SimpleNamespace:
    return types.SimpleNamespace(
        gigachat=types.SimpleNamespace(
            dms_embedding_model="EmbeddingsGigaR",
            dms_embedding_batch=batch,
        )
    )


def test_embed_returns_vectors_in_order(monkeypatch) -> None:
    monkeypatch.setattr(embedder, "settings", _settings())
    monkeypatch.setattr(
        embedder,
        "_request",
        lambda texts: [[float(index)] * EMBEDDING_DIM for index, _ in enumerate(texts)],
    )

    vectors = embedder.embed(["a", "b", "c"])

    assert len(vectors) == 3
    assert len(vectors[0]) == EMBEDDING_DIM


def test_embed_splits_into_batches(monkeypatch) -> None:
    calls: list[int] = []

    def fake_request(texts: list[str]) -> list[list[float]]:
        calls.append(len(texts))
        return [[0.0] * EMBEDDING_DIM for _ in texts]

    monkeypatch.setattr(embedder, "settings", _settings(batch=2))
    monkeypatch.setattr(embedder, "_request", fake_request)

    vectors = embedder.embed(["a", "b", "c", "d", "e"])

    assert len(vectors) == 5
    assert calls == [2, 2, 1]


def test_embed_without_texts(monkeypatch) -> None:
    monkeypatch.setattr(embedder, "settings", _settings())
    assert embedder.embed([]) == []


def test_api_error_becomes_dms_error(monkeypatch) -> None:
    class BrokenClient:
        def embeddings(self, texts, model):
            raise GigaChatException("fail")

    monkeypatch.setattr(embedder, "settings", _settings())
    monkeypatch.setattr(embedder, "get_client", lambda: BrokenClient())

    with pytest.raises(DmsError) as error:
        embedder.embed(["a"])

    assert error.value.code == "embeddings_unavailable"
    assert error.value.status_code == 502
