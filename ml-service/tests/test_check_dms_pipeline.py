"""Оркестрация проверки назначений."""

import asyncio

from app.config import DmsConfig
from app.schemas import CheckDmsForm
from app.services.check_dms import pipeline
from app.services.check_dms.parser import PageText

TEXT = "Амлодипин 5 мг 1 раз в сутки; ЭКГ покоя; Плазмаферез"
PDF = b"%PDF-1.7"


def _form() -> CheckDmsForm:
    return CheckDmsForm(
        mkb="I10 Эссенциальная гипертензия",
        appointments=TEXT,
    )


def _stub_extract(monkeypatch) -> None:
    monkeypatch.setattr(
        pipeline,
        "extract_pages",
        lambda pdf: [PageText(number=1, text="3.4.2 Лекарственные средства", table_rows=())],
    )


def test_pipeline_builds_segments_and_fragments(monkeypatch) -> None:
    _stub_extract(monkeypatch)
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

    response = asyncio.run(pipeline.verify_appointments(PDF, "hash123", _form(), DmsConfig()))

    assert "".join(segment.text for segment in response.appointments) == TEXT
    assert response.appointments[-1].unnecessary is True
    assert response.fragments[0].section == "3.4.2 Лекарственные средства"


def test_logs_do_not_leak_appointments(monkeypatch, caplog) -> None:
    _stub_extract(monkeypatch)
    monkeypatch.setattr(pipeline, "index_document", lambda pages, file_hash, config: True)
    monkeypatch.setattr(pipeline, "split_appointments", lambda text: ["Плазмаферез"])
    monkeypatch.setattr(pipeline, "retrieve_for_items", lambda items, file_hash, config: [])
    monkeypatch.setattr(pipeline, "judge", lambda mkb, items, found: {0})

    with caplog.at_level("INFO"):
        asyncio.run(
            pipeline.verify_appointments(PDF, "abcdef1234567890", _form(), DmsConfig())
        )

    assert "abcdef123456" in caplog.text
    assert "Плазмаферез" not in caplog.text
    assert "Амлодипин" not in caplog.text


def test_pipeline_limits_fragments(monkeypatch) -> None:
    _stub_extract(monkeypatch)
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
        pipeline.verify_appointments(PDF, "hash", _form(), DmsConfig(max_fragments=3))
    )

    assert len(response.fragments) == 3
    assert response.appointments == [response.appointments[0]]
    assert response.appointments[0].unnecessary is False
