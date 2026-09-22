from __future__ import annotations

from _client import SmokeContext, print_response


def run_health(ctx: SmokeContext) -> None:
    print("=== GET /health ===")
    resp = ctx.get("/health", auth=False, timeout=10)
    print_response(resp)
