import asyncio
import logging
import time

import chromadb
from chromadb.utils import embedding_functions
from sentence_transformers import SentenceTransformer

from app.config import settings

from .llm_factory import LLMFactory, LLMRole

logger = logging.getLogger(__name__)


class QwenEmbeddingFunction(embedding_functions.EmbeddingFunction):
    def __init__(self, model):
        self.model = model
    
    def __call__(self, input):
        return self.model.encode(input).tolist()


def _load_embedding_model(model_path: str) -> SentenceTransformer:
    """Загрузка локальной модели — самая долгая часть старта, логируем время."""
    started = time.perf_counter()
    logger.info("loading embedding model path=%s", model_path)
    model = SentenceTransformer(model_path)
    model.to("cpu")
    logger.info(
        "embedding model loaded path=%s ms=%.0f",
        model_path,
        (time.perf_counter() - started) * 1000,
    )
    return model


def _open_collection(db_path: str, collection: str, embedding_function=None):
    started = time.perf_counter()
    logger.info("opening chroma collection path=%s collection=%s", db_path, collection)
    client = chromadb.PersistentClient(path=db_path)
    opened = client.get_collection(collection, embedding_function=embedding_function)
    logger.info(
        "chroma collection opened path=%s collection=%s count=%s ms=%.0f",
        db_path,
        collection,
        opened.count(),
        (time.perf_counter() - started) * 1000,
    )
    return client, opened


gc = settings.gigachat
# Все чаты приходят из фабрики: она знает, какая модель и лимиты нужны роли.
llm_factory = LLMFactory(gc)

llm_mkb = llm_factory.get_chat(LLMRole.MKB)
llm_fullness = llm_factory.get_chat(LLMRole.FULLNESS)
llm_clinrec = llm_factory.get_chat(LLMRole.CLINREC)
llm_dms_split = llm_factory.get_chat(LLMRole.DMS_SPLIT)
llm_dms = llm_factory.get_chat(LLMRole.DMS)

mkb_chroma = settings.mkb_chroma
mkb_emb_model = _load_embedding_model(mkb_chroma.embedding_model)
mkb_client, mkb_collection = _open_collection(mkb_chroma.db_path, mkb_chroma.collection)

clinrec_chroma = settings.clinrec_chroma
clinrec_emb_model = _load_embedding_model(clinrec_chroma.embedding_model)
clinrec_client, clinrec_collection = _open_collection(
    clinrec_chroma.db_path,
    clinrec_chroma.collection,
    embedding_function=QwenEmbeddingFunction(clinrec_emb_model),
)


async def log_available_models(timeout: float = 10.0) -> None:
    """Пишет в лог модели, доступные текущему токену GigaChat.

    Токен один на все клиенты, поэтому спрашиваем через любой.
    Никогда не валит старт: сеть или авторизация упали — пишем и идём дальше.
    """
    try:
        # SDK сам держит таймаут GIGACHAT_TIMEOUT, здесь — внешняя страховка
        models = await asyncio.wait_for(llm_mkb.aget_models(), timeout)
    except Exception:
        logger.exception("failed to get available gigachat models")
        return

    logger.info(
        "gigachat available models count=%d models=%s",
        len(models.data),
        [model.id_ for model in models.data],
    )
