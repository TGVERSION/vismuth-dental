from __future__ import annotations

from _client import SmokeContext, print_response


def run_list(ctx: SmokeContext) -> None:
    if not ctx.require_token():
        return
    print("=== GET /roles ===")
    resp = ctx.get("/roles")
    print_response(resp)
