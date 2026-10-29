"""Индексация документа клинрека в Qdrant.

Повторная индексация того же содержимого не выполняется: хэш лежит
в payload, а проверка занимает один запрос к Qdrant.
"""

import logging

from app.config import DmsConfig

from .chunker import chunk_pages
from .embedder import embed
from .parser import PageText
from .store import count_by_hash, ensure_collection, get_client, upsert_chunks

logger = logging.getLogger(__name__)


def index_document(
    pages: list[PageText],
    file_hash: str,
    config: DmsConfig,
) -> bool:
    """Индексирует документ, если его ещё нет.

    Возвращает True, когда индексация действительно выполнена.
    """
    client = get_client(config)
    ensure_collection(client, config.collection)

    if count_by_hash(client, config.collection, file_hash) > 0:
        logger.info("dms index skipped sha256=%s", file_hash[:12])
        return False

    chunks = chunk_pages(
        pages,
        chunk_size=config.chunk_size,
        overlap=config.chunk_overlap,
    )
    if not chunks:
        return False

    vectors = embed([chunk.text for chunk in chunks])
    upsert_chunks(client, config.collection, chunks, vectors, file_hash)
    logger.info("dms indexed sha256=%s chunks=%s", file_hash[:12], len(chunks))
    return True
