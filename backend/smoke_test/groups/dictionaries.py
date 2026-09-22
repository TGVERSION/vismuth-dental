from __future__ import annotations

from _client import SmokeContext, print_response


def run_dictionary(ctx: SmokeContext) -> None:
    if not ctx.require_token():
        return

    print("=== GET /dictionary ===")
    dictionary_resp = ctx.get("/dictionary")
    print_response(dictionary_resp)

    active = dictionary_resp.json() if dictionary_resp.ok else []
    ctx.ids["dictionaries"] = active
    if dictionary_resp.ok:
        print(f"\nВсего словарей: {len(active)}")

    if not active:
        print("Словари не найдены — пропускаю ref-поиск")
        return

    target = active[0]
    print("\n=== GET /ref/{name}?search=&limit=&offset= ===")
    ref_resp = ctx.get(
        f"/ref/{target['name']}",
        params={"search": "а", "limit": 5, "offset": 0},
    )
    print_response(ref_resp)


def run_mkb10(ctx: SmokeContext) -> None:
    if not ctx.require_token():
        return

    cases = [
        {"page": 1, "size": 10, "searchValue": "A32"},
        {"page": 1, "size": 10, "searchValue": "холер"},
        {"page": 2, "size": 12, "searchValue": ""},
    ]
    for params in cases:
        label = params["searchValue"] or "(empty)"
        print(f"=== GET /mkb10 (searchValue={label!r}) ===")
        resp = ctx.get("/mkb10", params=params)
        print_response(resp)
        if resp.ok:
            data = resp.json()
            print(
                f"page={data.get('page')} size={data.get('size')} "
                f"totalCount={data.get('totalCount')} items={len(data.get('items') or [])}"
            )


def run_all(ctx: SmokeContext) -> None:
    run_dictionary(ctx)
    run_mkb10(ctx)
