"""Прямые вызовы ML-сервиса (порт 8001), не через backend proxy."""

from __future__ import annotations

from _client import SmokeContext, print_response

DEFAULT_ML_BASE_URL = "http://localhost:8001"


def make_ml_context(base_url: str = DEFAULT_ML_BASE_URL) -> SmokeContext:
    return SmokeContext(base_url=base_url)


def run_health(ctx: SmokeContext) -> None:
    print("=== GET /health (ml-service) ===")
    print_response(ctx.get("/health", auth=False, timeout=10))


def run_autocomplete(ctx: SmokeContext) -> None:
    cases = [
        {"field": "complaints", "prefix": "бол", "num_sequences": 5},
        {"field": "main_diagnosis", "prefix": "ост", "num_sequences": 3},
        {"field": "complaints", "prefix": "а", "num_sequences": 5},
    ]
    for payload in cases:
        print(f"=== POST /autocomplete/complete {payload} ===")
        print_response(
            ctx.post("/autocomplete/complete", auth=False, json=payload, timeout=30)
        )


def run_all(ctx: SmokeContext) -> None:
    run_health(ctx)
    run_autocomplete(ctx)
