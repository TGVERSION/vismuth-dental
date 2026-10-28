"""Локальное векторное хранилище фрагментов клинреков.

Qdrant работает в файловом режиме: отдельный сервис не нужен.
Идентичность документа задаёт `file_hash` в payload, а точка —
`uuid5(file_hash, chunk_index)`, поэтому повторная запись не плодит дубли.
"""

import logging
import uuid

from qdrant_client import QdrantClient, models

from app.config import DmsConfig

from .chunker import Chunk

logger = logging.getLogger(__name__)

EMBEDDING_DIM = 1024
_HASH_FIELD = "file_hash"

_client: QdrantClient | None = None


def get_client(config: DmsConfig) -> QdrantClient:
    """Один клиент на процесс: локальный режим держит файловую блокировку."""
    global _client
    if _client is None:
        _client = QdrantClient(path=config.qdrant_path)
        logger.info("dms qdrant client opened path=%s", config.qdrant_path)
    return _client


def reset_client() -> None:
    """Закрывает клиент. Нужно тестам и корректному завершению."""
    global _client
    if _client is not None:
        _client.close()
        _client = None


def ensure_collection(client: QdrantClient, collection: str) -> None:
    if client.collection_exists(collection):
        return
    client.create_collection(
        collection_name=collection,
        vectors_config=models.VectorParams(
            size=EMBEDDING_DIM,
            distance=models.Distance.COSINE,
        ),
    )
    logger.info("dms qdrant collection created name=%s", collection)


def hash_filter(file_hash: str) -> models.Filter:
    return models.Filter(
        must=[
            models.FieldCondition(
                key=_HASH_FIELD,
                match=models.MatchValue(value=file_hash),
            )
        ]
    )


def count_by_hash(client: QdrantClient, collection: str, file_hash: str) -> int:
    """Сколько фрагментов уже сохранено для документа с этим хэшем."""
    result = client.count(
        collection_name=collection,
        count_filter=hash_filter(file_hash),
        exact=True,
    )
    return result.count


def point_id(file_hash: str, chunk_index: int) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_URL, f"{file_hash}:{chunk_index}"))


def upsert_chunks(
    client: QdrantClient,
    collection: str,
    chunks: list[Chunk],
    vectors: list[list[float]],
    file_hash: str,
) -> None:
    """Пишет фрагменты пачками; повтор с теми же id перезаписывает точки."""
    points = [
        models.PointStruct(
            id=point_id(file_hash, chunk.index),
            vector=vector,
            payload={
                _HASH_FIELD: file_hash,
                "section": chunk.section,
                "page": chunk.page,
                "chunk_index": chunk.index,
                "text": chunk.text,
            },
        )
        for chunk, vector in zip(chunks, vectors, strict=True)
    ]
    client.upsert(collection_name=collection, points=points, wait=True)
    logger.info("dms qdrant upserted points=%s", len(points))


def search_by_hash(
    client: QdrantClient,
    collection: str,
    vector: list[float],
    file_hash: str,
    limit: int,
) -> list[dict]:
    """Возвращает payload ближайших фрагментов этого документа."""
    response = client.query_points(
        collection_name=collection,
        query=vector,
        query_filter=hash_filter(file_hash),
        limit=limit,
        with_payload=True,
    )
    return [point.payload or {} for point in response.points]
