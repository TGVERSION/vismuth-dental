"""Настройки логирования и сам setup.

Разделено намеренно: LogSettings — это данные из env,
setup_logging() — код. Модель не должна иметь сайд-эффектов при импорте.

env-переменные: LOG_*
"""

import logging
import sys
from contextvars import ContextVar

from pydantic import Field
from pydantic_settings import SettingsConfigDict

from .base_config import BaseConfig

# id текущего запроса. Заполняет middleware, читает фильтр логгера.
request_id_ctx: ContextVar[str] = ContextVar("request_id", default="-")

# Формат один: логи идут в stdout и уезжают в `docker logs`.
# Коллектора логов (ELK, Loki) у сервиса нет, поэтому JSON-режим не нужен.
_LOG_FORMAT = "%(asctime)s %(levelname)-8s [%(request_id)s] %(name)s: %(message)s"
_DATE_FORMAT = "%Y-%m-%d %H:%M:%S"

# библиотеки, которые слишком громкие на INFO
_NOISY_LOGGERS = (
    "chromadb",
    "httpx",
    "httpcore",
    "urllib3",
    "transformers",
    "sentence_transformers",
    "filelock",
    "asyncio",
)

# uvicorn настраивает свои логгеры и формат ещё до импорта приложения.
# Снимаем его хендлеры и уводим записи в корневой логгер, иначе будет
# два разных формата в одном потоке.
_UVICORN_LOGGERS = ("uvicorn", "uvicorn.error", "uvicorn.access")


class LogSettings(BaseConfig):
    model_config = SettingsConfigDict(extra="ignore", env_prefix="LOG_")

    level: str = Field(default="INFO", description="Корневой уровень логирования")


class RequestIdFilter(logging.Filter):
    """Подставляет request_id из contextvar в каждую запись.

    Логи внутри сервисов не знают про HTTP и про id запроса —
    он приклеивается здесь, на этапе emit.
    """

    def filter(self, record: logging.LogRecord) -> bool:
        if not hasattr(record, "request_id"):
            record.request_id = request_id_ctx.get()
        return True


def _resolve_level(level: str) -> int:
    """Опечатка в LOG_LEVEL не должна валить старт сервиса."""
    resolved = logging.getLevelNamesMapping().get(level.strip().upper())
    if resolved is None:
        logging.getLogger(__name__).warning("unknown log level=%r fallback=INFO", level)
        return logging.INFO
    return resolved


def setup_logging(config: LogSettings | None = None) -> None:
    """Настраивает корневой логгер. Вызывать один раз при старте приложения.

    Повторный вызов безопасен: force=True перезаписывает хендлеры.
    """
    config = config or LogSettings()

    # Windows-консоль и кириллица в путях: без этого logging молча глотает
    # UnicodeEncodeError и вместо строки печатает "--- Logging error ---"
    encoding = (getattr(sys.stdout, "encoding", "") or "").lower()
    if encoding not in ("utf-8", "utf8") and hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    logging.basicConfig(
        level=_resolve_level(config.level),
        format=_LOG_FORMAT,
        datefmt=_DATE_FORMAT,
        stream=sys.stdout,
        force=True,
    )

    # вывод идёт через один корневой хендлер — на нём и висит request_id
    request_id_filter = RequestIdFilter()
    for handler in logging.getLogger().handlers:
        handler.addFilter(request_id_filter)

    for name in _NOISY_LOGGERS:
        # дочерние логгеры без своего уровня наследуют этот
        logging.getLogger(name).setLevel(logging.WARNING)

    for name in _UVICORN_LOGGERS:
        uvicorn_logger = logging.getLogger(name)
        uvicorn_logger.handlers = []
        uvicorn_logger.propagate = True

    # каждый запрос логирует middleware, штатный access-лог глушим,
    # иначе будет две строки на один запрос
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
