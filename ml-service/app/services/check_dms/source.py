"""Скачивание PDF клинрека по presigned-ссылке.

Ссылку выдаёт backend, у ML нет S3-креденшелов: только GET.
"""

import hashlib
import logging
from pathlib import Path

import httpx

from app.config import DmsConfig

from .errors import DmsError

logger = logging.getLogger(__name__)

_PDF_SIGNATURE = b"%PDF"


async def download_pdf(
    url: str,
    config: DmsConfig,
    client: httpx.AsyncClient | None = None,
) -> tuple[bytes, str]:
    """Скачивает PDF и возвращает содержимое вместе с sha256.

    Клиент можно передать снаружи: так тесты подменяют транспорт,
    не трогая окружение.
    """
    own_client = client is None
    if client is None:
        client = httpx.AsyncClient(
            timeout=config.download_timeout,
            follow_redirects=True,
        )

    try:
        try:
            response = await client.get(url)
        except httpx.TimeoutException as exc:
            raise DmsError("s3_timeout", "S3 не ответил за отведённое время", 504) from exc
        except httpx.HTTPError as exc:
            raise DmsError("s3_failed", "Не удалось скачать PDF по ссылке", 502) from exc
    finally:
        if own_client:
            await client.aclose()

    if response.status_code == 404:
        raise DmsError("s3_not_found", "PDF не найден по ссылке", 502)
    if response.status_code >= 400:
        raise DmsError(
            "s3_failed",
            f"S3 вернул статус {response.status_code}",
            502,
        )

    content = response.content
    if len(content) > config.max_pdf_bytes:
        raise DmsError(
            "pdf_too_large",
            f"Размер PDF больше {config.max_pdf_bytes} байт",
            413,
        )
    if not content.startswith(_PDF_SIGNATURE):
        raise DmsError("pdf_invalid", "Содержимое по ссылке не является PDF", 422)

    digest = hashlib.sha256(content).hexdigest()
    logger.info("dms pdf downloaded bytes=%s sha256=%s", len(content), digest[:12])
    return content, digest


def pdf_path(digest: str, config: DmsConfig) -> Path:
    """Путь кэша PDF для документа с данным хэшем."""
    return Path(config.pdf_dir) / f"{digest}.pdf"


def save_pdf(content: bytes, digest: str, config: DmsConfig) -> Path:
    """Сохраняет PDF в локальный кэш; повторная запись того же файла не нужна."""
    path = pdf_path(digest, config)
    if path.exists():
        return path
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)
    logger.info("dms pdf cached sha256=%s path=%s", digest[:12], path.name)
    return path
