"""Разбиение назначений и поиск фрагментов клинрека."""

from app.config import DmsConfig
from app.services.check_dms import retrieval, split
from app.services.check_dms.split import SplitResult, fallback_split, split_appointments


def test_fallback_split_by_delimiters() -> None:
    items = fallback_split("Амлодипин 5 мг; ЭКГ покоя\nПлазмаферез")

    assert items == ["Амлодипин 5 мг", "ЭКГ покоя", "Плазмаферез"]


def test_fallback_split_single_position() -> None:
    assert fallback_split("Амлодипин 5 мг 1 раз в сутки") == ["Амлодипин 5 мг 1 раз в сутки"]


def test_split_uses_model_result(monkeypatch) -> None:
    monkeypatch.setattr(
        split,
        "_ask_model",
        lambda text: SplitResult(items=["Амлодипин 5 мг", "Плазмаферез"]),
    )

    assert split_appointments("Амлодипин 5 мг, Плазмаферез") == ["Амлодипин 5 мг", "Плазмаферез"]


def test_split_falls_back_when_model_fails(monkeypatch) -> None:
    def boom(text: str) -> SplitResult:
        raise RuntimeError("model down")

    monkeypatch.setattr(split, "_ask_model", boom)

    assert split_appointments("Амлодипин 5 мг; Плазмаферез") == ["Амлодипин 5 мг", "Плазмаферез"]


def test_split_falls_back_on_empty_model_result(monkeypatch) -> None:
    monkeypatch.setattr(split, "_ask_model", lambda text: SplitResult(items=[]))

    assert split_appointments("Амлодипин 5 мг") == ["Амлодипин 5 мг"]


def test_retrieval_deduplicates_and_respects_limit(monkeypatch) -> None:
    def fake_search(client, collection, vector, file_hash, limit):
        return [
            {"chunk_index": 1, "text": "first", "section": "3.4.2", "page": 46},
            {"chunk_index": 2, "text": "second", "section": "3.4.2", "page": 46},
        ]

    monkeypatch.setattr(retrieval, "get_client", lambda config: object())
    monkeypatch.setattr(retrieval, "ensure_collection", lambda client, collection: None)
    monkeypatch.setattr(retrieval, "embed", lambda items: [[0.0] for _ in items])
    monkeypatch.setattr(retrieval, "search_by_hash", fake_search)

    config = DmsConfig(retrieval_top_k=2, retrieval_max_chunks=3)
    found = retrieval.retrieve_for_items(["a", "b", "c"], "hash", config)

    assert [item["chunk_index"] for item in found] == [1, 2]


def test_retrieval_stops_at_chunk_limit(monkeypatch) -> None:
    counter = {"value": 0}

    def fake_search(client, collection, vector, file_hash, limit):
        counter["value"] += 1
        return [{"chunk_index": counter["value"], "text": "chunk", "section": "3.4.2", "page": 46}]

    monkeypatch.setattr(retrieval, "get_client", lambda config: object())
    monkeypatch.setattr(retrieval, "ensure_collection", lambda client, collection: None)
    monkeypatch.setattr(retrieval, "embed", lambda items: [[0.0] for _ in items])
    monkeypatch.setattr(retrieval, "search_by_hash", fake_search)

    config = DmsConfig(retrieval_top_k=1, retrieval_max_chunks=2)
    found = retrieval.retrieve_for_items(["a", "b", "c"], "hash", config)

    assert len(found) == 2


def test_retrieval_without_items_returns_empty() -> None:
    assert retrieval.retrieve_for_items([], "hash", DmsConfig()) == []
