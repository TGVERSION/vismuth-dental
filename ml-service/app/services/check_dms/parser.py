"""Извлечение текста и таблиц из PDF клинического рекомендации.

Плоский text layer перемешивает колонки таблиц, поэтому таблицы читаются
отдельно и превращаются в строки «ячейка | ячейка | …».
"""

import logging
from dataclasses import dataclass
from pathlib import Path

import pdfplumber

from .errors import DmsError

logger = logging.getLogger(__name__)

_CELL_SEPARATOR = " | "
_PDF_WHITESPACE = "\u00a0"


@dataclass(frozen=True)
class PageText:
    """Текст одной страницы PDF."""

    number: int
    text: str
    table_rows: tuple[str, ...]


def _table_rows(page: pdfplumber.page.Page) -> tuple[str, ...]:
    """Строки таблиц страницы в виде «ячейка | ячейка»."""
    rows: list[str] = []
    for table in page.extract_tables() or []:
        for row in table:
            cells = [str(cell).strip() if cell else "" for cell in row]
            line = _CELL_SEPARATOR.join(cells).strip(" |")
            if line:
                rows.append(line)
    return tuple(rows)


def extract_pages(path: Path) -> list[PageText]:
    """Читает PDF постранично; пустой документ считается ошибкой."""
    pages: list[PageText] = []
    try:
        with pdfplumber.open(path) as pdf:
            for index, page in enumerate(pdf.pages, start=1):
                text = (page.extract_text() or "").replace(_PDF_WHITESPACE, " ")
                pages.append(
                    PageText(
                        number=index,
                        text=text,
                        table_rows=_table_rows(page),
                    )
                )
    except DmsError:
        raise
    except Exception as exc:
        raise DmsError("pdf_unreadable", "Не удалось прочитать PDF", 422) from exc

    total = sum(len(page.text) for page in pages)
    logger.info("dms pdf parsed pages=%s chars=%s", len(pages), total)

    if total == 0:
        raise DmsError("pdf_text_empty", "В PDF нет текстового слоя", 422)

    return pages
