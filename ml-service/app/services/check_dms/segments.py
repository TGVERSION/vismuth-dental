"""Разметка исходного текста назначений.

Границы позиций вычисляет код по исходной строке: модель отдаёт только
номера позиций. Поэтому текст не перефразируется и не искажается.
"""

import logging
import re

logger = logging.getLogger(__name__)

Segment = tuple[str, bool]


def _pattern(item: str) -> re.Pattern[str]:
    """Ищет позицию, допуская любые пробелы между словами."""
    words = [re.escape(word) for word in item.split()]
    return re.compile(r"\s+".join(words), re.IGNORECASE)


def _locate(text: str, item: str, start_at: int) -> tuple[int, int] | None:
    match = _pattern(item).search(text, start_at)
    if match is None:
        return None
    if match.start() == match.end():
        return None
    return match.start(), match.end()


def locate_items(text: str, items: list[str]) -> list[tuple[int, int] | None]:
    """Смещения найденных позиций; для ненайденных — None."""
    spans: list[tuple[int, int] | None] = []
    cursor = 0
    for item in items:
        span = _locate(text, item, cursor)
        if span is None and cursor > 0:
            span = _locate(text, item, 0)
        if span is None:
            logger.warning("dms span not found for appointment")
            spans.append(None)
            continue
        spans.append(span)
        cursor = span[1]
    return spans


def build_segments(
    text: str,
    items: list[str],
    unnecessary: set[int],
) -> list[Segment]:
    """Возвращает сегменты исходного текста; склейка равна исходной строке."""
    spans = locate_items(text, items)

    marked = sorted(
        span
        for position, span in enumerate(spans)
        if span is not None and position in unnecessary
    )

    segments: list[Segment] = []
    cursor = 0
    for start, end in marked:
        if start < cursor:
            continue
        if start > cursor:
            segments.append((text[cursor:start], False))
        segments.append((text[start:end], True))
        cursor = end

    if cursor < len(text):
        segments.append((text[cursor:], False))

    if not segments:
        segments = [(text, False)]

    return segments
