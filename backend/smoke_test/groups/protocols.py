from __future__ import annotations

from _client import SmokeContext, print_response


def run_prepare_fields(ctx: SmokeContext) -> None:
    if not ctx.require_token():
        return
    sid = ctx.ids.get("protocol_structure_id")
    if not sid:
        print("protocol_structure_id не задан. Сначала protocol_structures.run_create.")
        return

    print(f"=== GET /protocol-structures/{{id}} (id={sid}) для field ids ===")
    resp = ctx.get(f"/protocol-structures/{sid}")
    print_response(resp)
    if not resp.ok:
        return

    fields = resp.json().get("fields", [])
    required = [f for f in fields if f.get("is_required")]
    optional = [f for f in fields if not f.get("is_required")]
    if required:
        ctx.ids["protocol_required_field_id"] = required[0].get("id")
    if optional:
        ctx.ids["protocol_optional_field_id"] = optional[0].get("id")
    elif len(fields) > 1:
        ctx.ids["protocol_optional_field_id"] = fields[1].get("id")

    print("protocol_required_field_id:", ctx.ids.get("protocol_required_field_id"))
    print("protocol_optional_field_id:", ctx.ids.get("protocol_optional_field_id"))


def run_negative(ctx: SmokeContext) -> None:
    if not ctx.require_token():
        return
    sid = ctx.ids.get("protocol_structure_id")
    req_id = ctx.ids.get("protocol_required_field_id")
    if not sid:
        print("Нужен protocol_structure_id.")
        return

    if req_id:
        print("=== POST /protocols (invalid unknown field_id) ===")
        print_response(
            ctx.post(
                "/protocols",
                json={
                    "protocol_structure_id": sid,
                    "protocol_name": "Протокол invalid unknown field",
                    "status_protocol": "draft",
                    "field_values": {
                        req_id: "required value",
                        "00000000-0000-0000-0000-000000000000": "bad field",
                    },
                },
            )
        )

    print("=== POST /protocols (missing required field) ===")
    print_response(
        ctx.post(
            "/protocols",
            json={
                "protocol_structure_id": sid,
                "protocol_name": "Протокол invalid missing required",
                "status_protocol": "draft",
                "field_values": {},
            },
        )
    )


def run_crud(ctx: SmokeContext, *, delete: bool = True) -> None:
    if not ctx.require_token():
        return

    if not ctx.ids.get("protocol_required_field_id"):
        run_prepare_fields(ctx)

    sid = ctx.ids.get("protocol_structure_id")
    req_id = ctx.ids.get("protocol_required_field_id")
    opt_id = ctx.ids.get("protocol_optional_field_id")
    if not sid or not req_id:
        print("Недостаточно данных: protocol_structure_id + protocol_required_field_id.")
        return

    print("=== POST /protocols ===")
    payload = {
        "protocol_structure_id": sid,
        "patient_id": 12345,
        "protocol_name": "Протокол smoke #1",
        "status_protocol": "draft",
        "field_values": {req_id: "Обязательное поле заполнено"},
    }
    if opt_id:
        payload["field_values"][opt_id] = "Опциональное поле заполнено"

    create_resp = ctx.post("/protocols", json=payload)
    print_response(create_resp)
    protocol_id = None
    if create_resp.ok:
        protocol_id = create_resp.json().get("id")
        ctx.ids["protocol_id"] = protocol_id
        print("Создан protocol id:", protocol_id)

    print("=== GET /protocols ===")
    print_response(ctx.get("/protocols"))

    if not protocol_id:
        return

    print(f"=== GET /protocols/{{id}} (id={protocol_id}) ===")
    print_response(ctx.get(f"/protocols/{protocol_id}"))

    print(f"=== PUT /protocols/{{id}} (id={protocol_id}) ===")
    print_response(
        ctx.put(
            f"/protocols/{protocol_id}",
            json={
                "patient_id": 54321,
                "protocol_name": "Протокол smoke #1 (PUT)",
                "status_protocol": "active",
                "field_values": {req_id: "Обязательное поле после PUT"},
            },
        )
    )

    if opt_id:
        print(f"=== PATCH /protocols/{{id}} (id={protocol_id}) ===")
        print_response(
            ctx.patch(
                f"/protocols/{protocol_id}",
                json={
                    "status_protocol": "archived",
                    "field_values": {opt_id: "Опциональное поле после PATCH"},
                },
            )
        )

    if not delete:
        print("DELETE пропущен (delete=False).")
        return

    print(f"=== DELETE /protocols/{{id}} (id={protocol_id}) ===")
    del_resp = ctx.delete(f"/protocols/{protocol_id}")
    print("Status:", del_resp.status_code)
    if del_resp.status_code == 204:
        print("Удалено (204).")
        ctx.ids.pop("protocol_id", None)
    else:
        print_response(del_resp)


def run_all(ctx: SmokeContext, *, delete: bool = True) -> None:
    run_prepare_fields(ctx)
    run_negative(ctx)
    run_crud(ctx, delete=delete)
