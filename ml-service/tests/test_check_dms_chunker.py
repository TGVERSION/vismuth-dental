"""Парсинг PDF и разбиение текста на чанки."""

from pathlib import Path

import pytest

from app.services.check_dms.chunker import chunk_pages
from app.services.check_dms.parser import PageText

REAL_PDF = Path("КР62_3.pdf")


def _page(number: int, text: str, rows: tuple[str, ...] = ()) -> PageText:
    return PageText(number=number, text=text, table_rows=rows)


def test_chunks_follow_section_headings() -> None:
    pages = [
        _page(
            1,
            "1 Краткая информация о заболевании\n"
            "Определение болезни и её основные характеристики.\n"
            "3.4.2 Лекарственные средства для лечения артериальной гипертензии\n"
            + "Дигидропиридиновые АК рекомендуются как стартовая терапия. " * 40,
        )
    ]

    chunks = chunk_pages(pages, chunk_size=1000, overlap=120)

    assert chunks
    assert any(chunk.section == "3.4.2 Лекарственные средства для лечения артериальной гипертензии" for chunk in chunks)


def test_chunks_respect_size_limit() -> None:
    pages = [
        _page(
            1,
            "3 Лечение\n" + "Длинный абзац о терапии артериальной гипертензии. " * 200,
        )
    ]

    chunks = chunk_pages(pages, chunk_size=900, overlap=100)

    assert all(len(chunk.text) <= 900 for chunk in chunks)
    assert len(chunks) > 1


def test_overlap_between_chunks() -> None:
    text = " ".join(f"слово{index}" for index in range(400))
    pages = [_page(1, f"3 Лечение\n{text}")]

    chunks = chunk_pages(pages, chunk_size=600, overlap=100)

    first, second = [chunk for chunk in chunks if len(chunk.text) > 500][:2]
    tail = first.text[-100:].strip()
    assert tail
    assert tail in second.text


def test_table_rows_become_chunks() -> None:
    pages = [
        _page(
            1,
            "3.4.2 Лекарственные средства для лечения артериальной гипертензии\nТекст раздела.",
            rows=("Амлодипин | АГ | I | A",),
        )
    ]

    chunks = chunk_pages(pages, chunk_size=1000, overlap=0)

    assert any("Амлодипин | АГ | I | A" in chunk.text for chunk in chunks)
    assert any(
        chunk.section == "3.4.2 Лекарственные средства для лечения артериальной гипертензии"
        for chunk in chunks
    )


@pytest.mark.skipif(not REAL_PDF.exists(), reason="нет тестового PDF клинрека")
def test_real_pdf_is_parsed() -> None:
    from app.services.check_dms.parser import extract_pages

    pages = extract_pages(REAL_PDF)
    total = sum(len(page.text) for page in pages)

    assert total > 100_000
    assert any("3.4.2" in page.text for page in pages)
    assert any(page.table_rows for page in pages)


def test_chunking_rejects_bad_overlap() -> None:
    with pytest.raises(ValueError):
        chunk_pages([_page(1, "текст")], chunk_size=100, overlap=100)
