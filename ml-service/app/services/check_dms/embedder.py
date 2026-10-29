"""Эмбеддинги клинреков через GigaChat API.

Локальная модель для этой задачи не нужна: API отдаёт 2560 измерений
и обрабатывает пачку текстов за один запрос. Клиент один на процесс,
токен и его обновление держит SDK.
"""

import logging

from gigachat import GigaChat
from gigachat.exceptions import GigaChatException

from app.config import settings

from .errors import DmsError

logger = logging.getLogger(__name__)

_client: GigaChat | None = None


def get_client() -> GigaChat:
    """Один клиент на процесс: SDK сам обновляет access token."""
    global _client
    if _client is None:
        _client = GigaChat(
            credentials=settings.gigachat.token.get_secret_value(),
            model=settings.gigachat.dms_embedding_model,
            verify_ssl_certs=False,
        )
        logger.info("dms embeddings client created model=%s", settings.gigachat.dms_embedding_model)
    return _client


def reset_client() -> None:
    """Закрывает клиент; нужно тестам и корректному завершению."""
    global _client
    if _client is not None:
        _client.close()
        _client = None


def _request(texts: list[str]) -> list[list[float]]:
    """Один запрос к API; вынесен для подмены в тестах."""
    try:
        response = get_client().embeddings(texts, model=settings.gigachat.dms_embedding_model)
    except GigaChatException as exc:
        raise DmsError("embeddings_unavailable", "Сервис эмбеддингов GigaChat недоступен", 502) from exc
    return [item.embedding for item in response.data]


def embed(texts: list[str]) -> list[list[float]]:
    """Векторизует тексты пачками в порядке исходного списка."""
    if not texts:
        return []

    batch_size = settings.gigachat.dms_embedding_batch
    vectors: list[list[float]] = []
    for start in range(0, len(texts), batch_size):
        batch = texts[start:start + batch_size]
        vectors.extend(_request(batch))

    logger.info("dms embedded texts=%s", len(texts))
    return vectors
