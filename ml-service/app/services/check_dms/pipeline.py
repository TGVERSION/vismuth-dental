"""Оркестрация проверки назначений ДМС.

Порядок: прочитать PDF из запроса -> проверить хэш -> разбить назначения ->
найти фрагменты -> получить вердикт -> разметить исходный текст.
"""

import asyncio
import logging
import time

from app.config import DmsConfig
from app.schemas import (
    AppointmentSegment,
    CheckDmsForm,
    CheckDmsResponse,
    GuidelineFragment,
)

from .indexer import index_document
from .parser import extract_pages
from .retrieval import retrieve_for_items
from .segments import build_segments
from .split import split_appointments
from .verdict import judge

logger = logging.getLogger(__name__)


def _elapsed_ms(started: float) -> float:
    return (time.perf_counter() - started) * 1000


def _fragments(found: list[dict], limit: int) -> list[GuidelineFragment]:
    unique: list[GuidelineFragment] = []
    seen: set[tuple[str, str]] = set()
    for payload in found:
        section = str(payload.get("section") or "")
        text = str(payload.get("text") or "")
        key = (section, text)
        if key in seen or not text:
            continue
        seen.add(key)
        unique.append(GuidelineFragment(section=section, text=text))
        if len(unique) >= limit:
            break
    return unique


async def verify_appointments(
    pdf: bytes,
    file_hash: str,
    form: CheckDmsForm,
    config: DmsConfig,
) -> CheckDmsResponse:
    """Проверяет назначения по содержимому PDF и размечает исходный текст."""
    started = time.perf_counter()

    pages = await asyncio.to_thread(extract_pages, pdf)
    indexed = await asyncio.to_thread(index_document, pages, file_hash, config)

    items = await asyncio.to_thread(split_appointments, form.appointments)
    found = await asyncio.to_thread(retrieve_for_items, items, file_hash, config)
    unnecessary = await asyncio.to_thread(judge, form.mkb, items, found)

    segments = build_segments(form.appointments, items, unnecessary)

    logger.info(
        "dms check done sha256=%s indexed=%s items=%s fragments=%s unnecessary=%s ms=%.0f",
        file_hash[:12],
        indexed,
        len(items),
        len(found),
        len(unnecessary),
        _elapsed_ms(started),
    )

    return CheckDmsResponse(
        appointments=[
            AppointmentSegment(text=text, unnecessary=marked)
            for text, marked in segments
        ],
        fragments=_fragments(found, config.max_fragments),
    )
