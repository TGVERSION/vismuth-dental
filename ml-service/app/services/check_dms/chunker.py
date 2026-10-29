"""Разбиение текста клинрека на чанки по разделам.

Чанк помнит раздел и страницу: по ним строится ссылка на рекомендацию.
Таблицы идут отдельными чанками, чтобы строка «препарат | показание»
не тонула в сплошном тексте.
"""

import logging
import re
from dataclasses import dataclass

from .parser import PageText

logger = logging.getLogger(__name__)

_HEADING_RE = re.compile(r"^(\d+(?:\.\d+)*)\.?\s+([А-ЯЁ][^\n]{2,200})$")
_TOC_RE = re.compile(r"\.{4,}")
WORD_SEPARATOR = " "


@dataclass(frozen=True)
class Chunk:
    """Фрагмент документа с привязкой к разделу и странице."""

    text: str
    section: str
    page: int
    index: int


@dataclass(frozen=True)
class _Block:
    text: str
    section: str
    page: int


def _heading_of(line: str) -> str | None:
    """Возвращает «номер + заголовок», если строка — заголовок раздела."""
    if _TOC_RE.search(line):
        return None
    match = _HEADING_RE.match(line)
    if match is None:
        return None
    number, title = match.group(1), match.group(2).strip()
    return f"{number} {title}"


def _blocks(pages: list[PageText]) -> list[_Block]:
    blocks: list[_Block] = []
    section = ""
    for page in pages:
        paragraph: list[str] = []

        for line in page.text.splitlines():
            stripped = line.strip()
            if not stripped:
                if paragraph:
                    blocks.append(_Block(WORD_SEPARATOR.join(paragraph), section, page.number))
                    paragraph = []
                continue
            heading = _heading_of(stripped)
            if heading is not None:
                if paragraph:
                    blocks.append(_Block(WORD_SEPARATOR.join(paragraph), section, page.number))
                    paragraph = []
                section = heading
                blocks.append(_Block(heading, section, page.number))
                continue
            paragraph.append(stripped)

        if paragraph:
            blocks.append(_Block(WORD_SEPARATOR.join(paragraph), section, page.number))

        for row in page.table_rows:
            blocks.append(_Block(row, section, page.number))
    return blocks


def _cut(text: str, size: int, overlap: int) -> list[str]:
    """Режет длинный текст по словам, сохраняя перекрытие."""
    parts: list[str] = []
    start = 0
    while start < len(text):
        end = min(start + size, len(text))
        if end < len(text):
            space = text.rfind(WORD_SEPARATOR, start + size // 2, end)
            if space != -1:
                end = space
        parts.append(text[start:end].strip())
        if end >= len(text):
            break
        start = max(end - overlap, start + 1)
    return [part for part in parts if part]


def chunk_pages(
    pages: list[PageText],
    *,
    chunk_size: int,
    overlap: int,
) -> list[Chunk]:
    """Собирает блоки в чанки не длиннее `chunk_size`."""
    if overlap >= chunk_size:
        raise ValueError("overlap must be smaller than chunk_size")

    chunks: list[Chunk] = []
    buffer = ""
    section = ""
    page_number = 0

    def emit() -> str:
        """Отдаёт готовый чанк и возвращает хвост для перекрытия."""
        nonlocal buffer
        text = buffer.strip()
        if not text:
            buffer = ""
            return ""
        chunks.append(
            Chunk(
                text=text,
                section=section,
                page=page_number,
                index=len(chunks),
            )
        )
        buffer = text[-overlap:] if overlap else ""
        return buffer

    for block in _blocks(pages):
        if not block.text:
            continue

        if len(block.text) > chunk_size:
            emit()
            buffer = ""
            section = block.section
            page_number = block.page
            for part in _cut(block.text, chunk_size, overlap):
                chunks.append(
                    Chunk(
                        text=part,
                        section=block.section,
                        page=block.page,
                        index=len(chunks),
                    )
                )
            continue

        if len(buffer) + len(block.text) + 1 > chunk_size:
            emit()
            section = block.section
            page_number = block.page

        if not buffer.strip():
            section = block.section
            page_number = block.page

        buffer = f"{buffer} {block.text}".strip()

    if buffer.strip():
        chunks.append(
            Chunk(
                text=buffer.strip(),
                section=section,
                page=page_number,
                index=len(chunks),
            )
        )

    logger.info("dms chunks prepared count=%s", len(chunks))
    return chunks
