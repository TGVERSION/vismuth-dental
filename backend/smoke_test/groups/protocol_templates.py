from __future__ import annotations

from _client import SmokeContext, print_response

DEFAULT_FIELDS = [
    {"field_name": "field_name_text", "field_type": "text", "field_value": "test_text"},
    {"field_name": "field_name_number", "field_type": "number", "field_value": "123"},
    {"field_name": "field_name_date", "field_type": "date", "field_value": "2021-01-01"},
]


def run_crud(ctx: SmokeContext, *, delete: bool = True) -> None:
    if not ctx.require_token():
        return

    structure_id = ctx.ids.get("protocol_structure_id")
    group_id = ctx.ids.get("group_id")

    print("=== POST /protocol-templates ===")
    create_resp = ctx.post(
        "/protocol-templates",
        json={
            "protocol_name": "Шаблон smoke test",
            "privacy": "personal",
            "group_id": group_id,
            "protocol_structure_id": structure_id,
            "fields": DEFAULT_FIELDS,
        },
    )
    print_response(create_resp)

    template_id = None
    if create_resp.ok:
        template_id = create_resp.json().get("id")
        ctx.ids["protocol_template_id"] = template_id
        print("Создан шаблон id:", template_id)

    print("=== GET /protocol-templates ===")
    print_response(ctx.get("/protocol-templates"))

    if not template_id:
        print("PROTOCOL_TEMPLATE_ID нет — останавливаю CRUD.")
        return

    print(f"=== GET /protocol-templates/{{id}} (id={template_id}) ===")
    print_response(ctx.get(f"/protocol-templates/{template_id}"))

    print(f"=== PUT /protocol-templates/{{id}} (id={template_id}) ===")
    print_response(
        ctx.put(
            f"/protocol-templates/{template_id}",
            json={
                "protocol_name": "Шаблон smoke test (обновлён)",
                "group_id": group_id,
                "fields": [
                    {
                        "field_name": "field_name_text",
                        "field_type": "text",
                        "field_value": "updated_text",
                    },
                    {
                        "field_name": "field_name_number",
                        "field_type": "number",
                        "field_value": "999",
                    },
                ],
            },
        )
    )

    if not delete:
        print("DELETE пропущен (delete=False).")
        return

    print(f"=== DELETE /protocol-templates/{{id}} (id={template_id}) ===")
    del_resp = ctx.delete(f"/protocol-templates/{template_id}")
    print("Status:", del_resp.status_code)
    if del_resp.status_code == 204:
        print("Удалено (204).")
        ctx.ids.pop("protocol_template_id", None)
    else:
        print_response(del_resp)
