"""Чтение PDF из multipart-запроса.

Файл не сохраняется на диск: читается чанками, `sha256` считается сразу,
превышение лимита обрывает чтение до конца загрузки.
"""

import hashlib
import logging

from fastapi import UploadFile

from app.config import DmsConfig

from .errors import DmsError

logger = logging.getLogger(__name__)

CHUNK_SIZE = 1024 * 1024
_PDF_SIGNATURE = b"%PDF"


async def read_pdf_upload(file: UploadFile, config: DmsConfig) -> tuple[bytes, str]:
    """Читает загруженный PDF и возвращает содержимое вместе с sha256."""
    digest = hashlib.sha256()
    parts: list[bytes] = []
    total = 0
    signature_checked = False

    while True:
        chunk = await file.read(CHUNK_SIZE)
        if not chunk:
            break

        if not signature_checked:
            if not chunk.startswith(_PDF_SIGNATURE):
                raise DmsError("pdf_invalid", "Загруженный файл не является PDF", 422)
            signature_checked = True

        total += len(chunk)
        if total > config.max_pdf_bytes:
            raise DmsError(
                "pdf_too_large",
                f"Размер PDF больше {config.max_pdf_bytes} байт",
                413,
            )

        digest.update(chunk)
        parts.append(chunk)

    content = b"".join(parts)
    if not content:
        raise DmsError("pdf_invalid", "Загруженный файл пуст", 422)

    file_hash = digest.hexdigest()
    logger.info("dms pdf received bytes=%s sha256=%s", len(content), file_hash[:12])
    return content, file_hash
