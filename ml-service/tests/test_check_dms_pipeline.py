"""Оркестрация проверки назначений."""

import asyncio
from pathlib import Path

from app.config import DmsConfig
from app.schemas import CheckDmsRequest
from app.services.check_dms import pipeline
from app.services.check_dms.parser import PageText

TEXT = "Амлодипин 5 мг 1 раз в сутки; ЭКГ покоя; Плазмаферез"


def _request() -> CheckDmsRequest:
    return CheckDmsRequest(
        pdf_url="https://s3.local/source.pdf",
        mkb="I10 Эссенциальная гипертензия",
        appointments=TEXT,
    )


def test_pipeline_builds_segments_and_fragments(monkeypatch) -> None:
    async def fake_download(url, config):
        return b"%PDF-1.7", "hash123"

    monkeypatch.setattr(pipeline, "download_pdf", fake_download)
    monkeypatch.setattr(pipeline, "save_pdf", lambda content, digest, config: Path("КР62_3.pdf"))
    monkeypatch.setattr(
        pipeline,
        "extract_pages",
        lambda path: [PageText(number=1, text="3.4.2 Лекарственные средства", table_rows=())],
    )
    monkeypatch.setattr(pipeline, "index_document", lambda pages, file_hash, config: True)
    monkeypatch.setattr(
        pipeline,
        "split_appointments",
        lambda text: ["Амлодипин 5 мг 1 раз в сутки", "ЭКГ покоя", "Плазмаферез"],
    )
    monkeypatch.setattr(
        pipeline,
        "retrieve_for_items",
        lambda items, file_hash, config: [
            {
                "chunk_index": 1,
                "section": "3.4.2 Лекарственные средства",
                "text": "Амлодипин рекомендован при АГ",
                "page": 46,
            }
        ],
    )
    monkeypatch.setattr(pipeline, "judge", lambda mkb, items, found: {2})

    response = asyncio.run(pipeline.verify_appointments(_request(), DmsConfig()))

    assert "".join(segment.text for segment in response.appointments) == TEXT
    assert response.appointments[-1].unnecessary is True
    assert response.fragments[0].section == "3.4.2 Лекарственные средства"


def test_logs_do_not_leak_appointments(monkeypatch, caplog) -> None:
    async def fake_download(url, config):
        return b"%PDF-1.7", "abcdef1234567890"

    monkeypatch.setattr(pipeline, "download_pdf", fake_download)
    monkeypatch.setattr(pipeline, "save_pdf", lambda content, digest, config: Path("КР62_3.pdf"))
    monkeypatch.setattr(
        pipeline,
        "extract_pages",
        lambda path: [PageText(number=1, text="3.4.2 Раздел", table_rows=())],
    )
    monkeypatch.setattr(pipeline, "index_document", lambda pages, file_hash, config: True)
    monkeypatch.setattr(pipeline, "split_appointments", lambda text: ["Плазмаферез"])
    monkeypatch.setattr(pipeline, "retrieve_for_items", lambda items, file_hash, config: [])
    monkeypatch.setattr(pipeline, "judge", lambda mkb, items, found: {0})

    with caplog.at_level("INFO"):
        asyncio.run(pipeline.verify_appointments(_request(), DmsConfig()))

    assert "abcdef123456" in caplog.text
    assert "Плазмаферез" not in caplog.text
    assert "Амлодипин" not in caplog.text


def test_pipeline_limits_fragments(monkeypatch) -> None:
    async def fake_download(url, config):
        return b"%PDF-1.7", "hash"

    monkeypatch.setattr(pipeline, "download_pdf", fake_download)
    monkeypatch.setattr(pipeline, "save_pdf", lambda content, digest, config: Path("КР62_3.pdf"))
    monkeypatch.setattr(
        pipeline,
        "extract_pages",
        lambda path: [PageText(number=1, text="3.4.2 Раздел", table_rows=())],
    )
    monkeypatch.setattr(pipeline, "index_document", lambda pages, file_hash, config: False)
    monkeypatch.setattr(pipeline, "split_appointments", lambda text: [TEXT])
    monkeypatch.setattr(
        pipeline,
        "retrieve_for_items",
        lambda items, file_hash, config: [
            {"chunk_index": index, "section": f"3.{index}", "text": f"фрагмент {index}", "page": 1}
            for index in range(30)
        ],
    )
    monkeypatch.setattr(pipeline, "judge", lambda mkb, items, found: set())

    response = asyncio.run(
        pipeline.verify_appointments(_request(), DmsConfig(max_fragments=3))
    )

    assert len(response.fragments) == 3
    assert response.appointments == [response.appointments[0]]
    assert response.appointments[0].unnecessary is False
