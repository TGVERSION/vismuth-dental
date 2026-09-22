from __future__ import annotations

from _client import SmokeContext, print_response


def run_list(ctx: SmokeContext) -> None:
    if not ctx.require_token():
        return

    print("=== GET /protocol-fields-main ===")
    list_resp = ctx.get("/protocol-fields-main")
    print_response(list_resp)

    field_id = None
    if list_resp.ok:
        data = list_resp.json()
        if isinstance(data, list) and data:
            field_id = data[0].get("id")
            ctx.ids["protocol_field_main_id"] = field_id
            print("Выбран id для detail:", field_id)
        else:
            print("Список protocol-fields-main пуст.")

    if not field_id:
        return

    print(f"=== GET /protocol-fields-main/{{id}} (id={field_id}) ===")
    print_response(ctx.get(f"/protocol-fields-main/{field_id}"))
