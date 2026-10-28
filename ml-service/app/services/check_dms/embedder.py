"""Эмбеддинги чанков клинрека.

Модель уже загружена в `llm_setup` для legacy-пути: второй инстанс
на 0.6B параметров держать в памяти незачем, поэтому берём её оттуда
и грузим лениво — импорт модуля тесты не должен тянуть.
"""

import logging

logger = logging.getLogger(__name__)

_model = None
BATCH_SIZE = 16


def get_model():
    """Загруженная модель клинреков из общего `llm_setup`."""
    global _model
    if _model is None:
        from app.llm_services.llm_setup import clinrec_emb_model

        _model = clinrec_emb_model
        logger.info("dms embedding model borrowed from llm_setup")
    return _model


def embed(texts: list[str]) -> list[list[float]]:
    """Векторизует тексты пачками с L2-нормализацией под cosine."""
    model = get_model()
    vectors = model.encode(
        texts,
        batch_size=BATCH_SIZE,
        normalize_embeddings=True,
        show_progress_bar=False,
    )
    return vectors.tolist()
