"""Поиск фрагментов клинрека по каждой позиции назначений.

Поиск идёт только внутри документа с данным `file_hash` и не выходит
за лимит фрагментов, который умещается в промпт.
"""

import logging

from app.config import DmsConfig

from .embedder import embed
from .store import ensure_collection, get_client, search_by_hash

logger = logging.getLogger(__name__)


def retrieve_for_items(
    items: list[str],
    file_hash: str,
    config: DmsConfig,
) -> list[dict]:
    """Возвращает уникальные фрагменты документа для всех позиций."""
    if not items:
        return []

    client = get_client(config)
    ensure_collection(client, config.collection)
    vectors = embed(items)

    found: list[dict] = []
    seen: set[int] = set()
    for vector in vectors:
        payloads = search_by_hash(
            client,
            config.collection,
            vector,
            file_hash,
            config.retrieval_top_k,
        )
        for payload in payloads:
            chunk_index = payload.get("chunk_index")
            if chunk_index in seen:
                continue
            seen.add(chunk_index)
            found.append(payload)
            if len(found) >= config.retrieval_max_chunks:
                logger.info("dms retrieved fragments=%s limit reached", len(found))
                return found

    logger.info("dms retrieved fragments=%s", len(found))
    return found
