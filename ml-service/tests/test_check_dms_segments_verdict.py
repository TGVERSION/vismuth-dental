"""Разметка текста назначений и вердикт модели."""

import sys
import types

import pytest

from app.services.check_dms import verdict
from app.services.check_dms.errors import DmsError
from app.services.check_dms.segments import build_segments
from app.services.check_dms.verdict import VerdictItem, VerdictResult

TEXT = "Амлодипин 5 мг 1 раз в сутки; ЭКГ покоя; Плазмаферез"
ITEMS = ["Амлодипин 5 мг 1 раз в сутки", "ЭКГ покоя", "Плазмаферез"]


def test_segments_keep_original_text() -> None:
    segments = build_segments(TEXT, ITEMS, {2})

    assert "".join(text for text, _ in segments) == TEXT
    assert segments[-1] == ("Плазмаферез", True)


def test_segments_without_unnecessary() -> None:
    segments = build_segments(TEXT, ITEMS, set())

    assert segments == [(TEXT, False)]


def test_segments_keep_user_brackets() -> None:
    text = "Амлодипин [5 мг]; Плазмаферез"
    items = ["Амлодипин [5 мг]", "Плазмаферез"]

    segments = build_segments(text, items, {1})

    assert "".join(part for part, _ in segments) == text
    assert any(part == "Плазмаферез" and marked for part, marked in segments)


def test_segments_match_case_insensitive() -> None:
    text = "АМЛОДИПИН 5 МГ; Плазмаферез"
    items = ["амлодипин 5 мг", "плазмаферез"]

    segments = build_segments(text, items, {0})

    assert segments[0] == ("АМЛОДИПИН 5 МГ", True)


def test_segments_survive_missing_item() -> None:
    segments = build_segments(TEXT, ["нечто отсутствующее", "Плазмаферез"], {1})

    assert "".join(part for part, _ in segments) == TEXT
    assert segments[-1] == ("Плазмаферез", True)


def test_verdict_accepts_valid_indices(monkeypatch) -> None:
    monkeypatch.setattr(
        verdict,
        "_ask_model",
        lambda prompt: VerdictResult(
            unnecessary=[VerdictItem(index=3, text="Плазмаферез", reason="нет в КР")]
        ),
    )

    assert verdict.judge("I10", ITEMS, []) == {2}


def test_verdict_ignores_out_of_range(monkeypatch) -> None:
    monkeypatch.setattr(
        verdict,
        "_ask_model",
        lambda prompt: VerdictResult(unnecessary=[VerdictItem(index=9, text="лишнее")]),
    )

    assert verdict.judge("I10", ITEMS, []) == set()


def test_verdict_trusts_index_over_text(monkeypatch) -> None:
    monkeypatch.setattr(
        verdict,
        "_ask_model",
        lambda prompt: VerdictResult(unnecessary=[VerdictItem(index=2, text="перефраз")]),
    )

    assert verdict.judge("I10", ITEMS, []) == {1}


def _fake_llm(monkeypatch, structured) -> None:
    """Подменяет llm_setup, чтобы не грузить реальные модели."""
    module = types.ModuleType("app.llm_services.llm_setup")
    module.llm_dms = types.SimpleNamespace(with_structured_output=lambda schema: structured)
    monkeypatch.setitem(sys.modules, "app.llm_services.llm_setup", module)


def test_ask_model_retries_once(monkeypatch) -> None:
    calls: list[int] = []

    class FlakyStructured:
        def invoke(self, messages):
            calls.append(1)
            if len(calls) == 1:
                raise RuntimeError("bad json")
            return VerdictResult(unnecessary=[VerdictItem(index=3, text="Плазмаферез")])

    _fake_llm(monkeypatch, FlakyStructured())

    assert verdict.judge("I10", ITEMS, []) == {2}
    assert len(calls) == 2


def test_ask_model_raises_after_retry(monkeypatch) -> None:
    class BrokenStructured:
        def invoke(self, messages):
            raise RuntimeError("bad json")

    _fake_llm(monkeypatch, BrokenStructured())

    with pytest.raises(DmsError) as error:
        verdict.judge("I10", ITEMS, [])

    assert error.value.code == "llm_invalid_response"


def test_verdict_without_items() -> None:
    assert verdict.judge("I10", [], []) == set()
