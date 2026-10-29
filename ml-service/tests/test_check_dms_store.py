"""Локальный Qdrant: запись, идемпотентность и поиск по документу."""

import uuid
from pathlib import Path

import pytest
from qdrant_client import QdrantClient

from app.services.check_dms.chunker import Chunk
from app.services.check_dms.store import (
    EMBEDDING_DIM,
    count_by_hash,
    ensure_collection,
    point_id,
    search_by_hash,
    upsert_chunks,
)

COLLECTION = "test_clinrec_dms"


@pytest.fixture()
def client() -> QdrantClient:
    path = Path("storage/test-qdrant") / uuid.uuid4().hex
    qdrant = QdrantClient(path=str(path))
    ensure_collection(qdrant, COLLECTION)
    yield qdrant
    qdrant.close()


def _chunks() -> list[Chunk]:
    return [
        Chunk(text="Амлодипин рекомендован при АГ", section="3.4.2", page=46, index=0),
        Chunk(text="Денервация почечных артерий при резистентной АГ", section="3.5", page=52, index=1),
    ]


def _vectors() -> list[list[float]]:
    first = [0.0] * EMBEDDING_DIM
    first[0] = 1.0
    second = [0.0] * EMBEDDING_DIM
    second[1] = 1.0
    return [first, second]


def test_upsert_and_count(client: QdrantClient) -> None:
    file_hash = uuid.uuid4().hex

    upsert_chunks(client, COLLECTION, _chunks(), _vectors(), file_hash)

    assert count_by_hash(client, COLLECTION, file_hash) == 2
    assert count_by_hash(client, COLLECTION, "other-hash") == 0


def test_repeated_upsert_does_not_duplicate(client: QdrantClient) -> None:
    file_hash = uuid.uuid4().hex

    upsert_chunks(client, COLLECTION, _chunks(), _vectors(), file_hash)
    upsert_chunks(client, COLLECTION, _chunks(), _vectors(), file_hash)

    assert count_by_hash(client, COLLECTION, file_hash) == 2


def test_point_id_is_stable() -> None:
    assert point_id("abc", 3) == point_id("abc", 3)
    assert point_id("abc", 3) != point_id("abc", 4)


def test_collection_survives_reopen() -> None:
    path = Path("storage/test-qdrant") / uuid.uuid4().hex
    file_hash = uuid.uuid4().hex

    first = QdrantClient(path=str(path))
    ensure_collection(first, COLLECTION)
    upsert_chunks(first, COLLECTION, _chunks(), _vectors(), file_hash)
    first.close()

    second = QdrantClient(path=str(path))
    try:
        assert count_by_hash(second, COLLECTION, file_hash) == 2
    finally:
        second.close()


def test_search_returns_only_own_document(client: QdrantClient) -> None:
    own = uuid.uuid4().hex
    foreign = uuid.uuid4().hex
    upsert_chunks(client, COLLECTION, _chunks(), _vectors(), own)
    upsert_chunks(
        client,
        COLLECTION,
        [Chunk(text="Чужой документ", section="1", page=1, index=0)],
        [[1.0] + [0.0] * (EMBEDDING_DIM - 1)],
        foreign,
    )

    found = search_by_hash(client, COLLECTION, _vectors()[0], own, limit=5)

    assert found
    assert all(point["file_hash"] == own for point in found)
    assert found[0]["text"] == "Амлодипин рекомендован при АГ"
