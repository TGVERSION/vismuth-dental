from __future__ import annotations

from _client import SmokeContext, print_response


def run_create(ctx: SmokeContext) -> None:
    if not ctx.require_token():
        return

    print("=== POST /protocol-structures ===")
    create_payload = {
        "structure_code": "smoke_structure_0",
        "structure_name": "Smoke structure",
        "description": "Тестовая структура для smoke",
        "version": 1,
        "is_active": True,
        "fields": [
            {
                "field_name": "complaints",
                "field_label": "Жалобы",
                "description": "Раздел жалоб",
                "field_type": "checkbox",
                "default_value": None,
                "default_value_jsonb": ["тест0", "тест1", "тест2"],
                "dictionary": None,
                "protocol_fields_main_id": None,
                "is_required": True,
                "sort_order": 1,
            },
            {
                "field_name": "main_diagnosis",
                "field_label": "Основной диагноз",
                "description": "Раздел диагноза",
                "field_type": "text",
                "default_value": None,
                "dictionary": None,
                "protocol_fields_main_id": None,
                "is_required": False,
                "sort_order": 2,
            },
        ],
    }
    create_resp = ctx.post("/protocol-structures", json=create_payload)
    print_response(create_resp)
    if create_resp.ok:
        sid = create_resp.json().get("id")
        ctx.ids["protocol_structure_id"] = sid
        print("Создана структура id:", sid)
        _cache_field_ids(ctx, create_resp.json())


def run_list(ctx: SmokeContext) -> None:
    if not ctx.require_token():
        return
    print("=== GET /protocol-structures ===")
    print_response(ctx.get("/protocol-structures"))


def run_get(ctx: SmokeContext) -> None:
    if not ctx.require_token():
        return
    sid = ctx.ids.get("protocol_structure_id")
    if not sid:
        print("protocol_structure_id нет — сначала run_create.")
        return
    print(f"=== GET /protocol-structures/{{id}} (id={sid}) ===")
    resp = ctx.get(f"/protocol-structures/{sid}")
    print_response(resp)
    if resp.ok:
        _cache_field_ids(ctx, resp.json())


def run_put(ctx: SmokeContext) -> None:
    if not ctx.require_token():
        return
    sid = ctx.ids.get("protocol_structure_id")
    if not sid:
        print("protocol_structure_id нет — сначала run_create.")
        return

    print(f"=== PUT /protocol-structures/{{id}} (id={sid}) ===")
    put_resp = ctx.put(
        f"/protocol-structures/{sid}",
        json={
            "structure_code": "smoke_structure_put",
            "structure_name": "Smoke structure (PUT)",
            "description": "Полная замена полей через PUT",
            "version": 2,
            "is_active": True,
            "fields": [
                {
                    "field_name": "complaints",
                    "field_label": "Жалобы (PUT)",
                    "description": "Обновленный раздел",
                    "field_type": "text",
                    "default_value": "",
                    "dictionary": None,
                    "protocol_fields_main_id": None,
                    "is_required": True,
                    "sort_order": 1,
                },
                {
                    "field_name": "recommendations",
                    "field_label": "Рекомендации",
                    "description": "Новый раздел после PUT",
                    "field_type": "text",
                    "default_value": None,
                    "dictionary": None,
                    "protocol_fields_main_id": None,
                    "is_required": False,
                    "sort_order": 2,
                },
            ],
        },
    )
    print_response(put_resp)
    if put_resp.ok:
        _cache_field_ids(ctx, put_resp.json())
        ctx.ids["protocol_structure_put_resp"] = put_resp.json()


def run_patch(ctx: SmokeContext) -> None:
    if not ctx.require_token():
        return
    sid = ctx.ids.get("protocol_structure_id")
    if not sid:
        print("protocol_structure_id нет — сначала run_create.")
        return

    put_body = ctx.ids.get("protocol_structure_put_resp") or {}
    field_ids = [f.get("id") for f in put_body.get("fields", []) if f.get("id")]
    if len(field_ids) < 2:
        # fallback: GET
        get_resp = ctx.get(f"/protocol-structures/{sid}")
        if get_resp.ok:
            field_ids = [f.get("id") for f in get_resp.json().get("fields", []) if f.get("id")]

    if len(field_ids) < 2:
        print("Пропускаю PATCH: нужно минимум 2 field id.")
        return

    print(f"=== PATCH /protocol-structures/{{id}} (id={sid}) ===")
    patch_resp = ctx.patch(
        f"/protocol-structures/{sid}",
        json={
            "structure_name": "Smoke structure (PATCH)",
            "description": "Частичное обновление через PATCH",
            "is_active": False,
            "fields_update": [
                {"id": field_ids[0], "field_label": "Жалобы (PATCH)", "sort_order": 10}
            ],
            "fields_add": [
                {
                    "field_name": "clinical_assessment",
                    "field_label": "Клиническая оценка",
                    "description": "Добавлено через PATCH",
                    "field_type": "radiobutton",
                    "default_value": None,
                    "default_value_jsonb": ["тест0", "тест1", "тест2"],
                    "dictionary": None,
                    "protocol_fields_main_id": None,
                    "is_required": False,
                    "sort_order": 30,
                }
            ],
            "fields_delete": [field_ids[1]],
        },
    )
    print_response(patch_resp)
    if patch_resp.ok:
        _cache_field_ids(ctx, patch_resp.json())


def run_delete(ctx: SmokeContext) -> None:
    if not ctx.require_token():
        return
    sid = ctx.ids.get("protocol_structure_id")
    if not sid:
        print("protocol_structure_id нет.")
        return
    print(f"=== DELETE /protocol-structures/{{id}} (id={sid}) ===")
    del_resp = ctx.delete(f"/protocol-structures/{sid}")
    print("Status:", del_resp.status_code)
    if del_resp.status_code == 204:
        print("Удалено (204).")
        ctx.ids.pop("protocol_structure_id", None)
    else:
        print_response(del_resp)


def run_crud(ctx: SmokeContext, *, delete: bool = True) -> None:
    run_create(ctx)
    run_list(ctx)
    run_get(ctx)
    run_put(ctx)
    run_patch(ctx)
    if delete:
        run_delete(ctx)
    else:
        print("DELETE структуры пропущен (delete=False) — id сохранён для protocols/templates.")


def _cache_field_ids(ctx: SmokeContext, body: dict) -> None:
    fields = body.get("fields") or []
    required = [f for f in fields if f.get("is_required")]
    optional = [f for f in fields if not f.get("is_required")]
    if required:
        ctx.ids["protocol_required_field_id"] = required[0].get("id")
    if optional:
        ctx.ids["protocol_optional_field_id"] = optional[0].get("id")
    elif len(fields) > 1:
        ctx.ids["protocol_optional_field_id"] = fields[1].get("id")
