from __future__ import annotations

from _client import SmokeContext, print_response

PRIVILEGED_ROLES = frozenset({"super_admin", "admin"})


def run_me(ctx: SmokeContext) -> None:
    if not ctx.require_token():
        return
    print("=== GET /service_user ===")
    resp = ctx.get("/service_user")
    print_response(resp)
    if resp.ok and not ctx.user_id:
        # /service_user (me) не всегда отдаёт id — user_id берём из login
        pass


def run_admin_crud(ctx: SmokeContext, *, do_delete: bool = False) -> None:
    """CRUD чужих пользователей (нужна роль admin | super_admin)."""
    if not ctx.require_token():
        return

    me_resp = ctx.get("/service_user")
    if me_resp.ok:
        role = me_resp.json().get("role")
        if role not in PRIVILEGED_ROLES:
            print(f"Текущий пользователь не privileged (role={role}) — 16.x вернут 403.")

    print("=== GET /service_user_ids ===")
    list_resp = ctx.get("/service_user_ids")
    print_response(list_resp)
    if not list_resp.ok:
        return

    users_list = list_resp.json()
    assert isinstance(users_list, list), "response must be a list"
    if not users_list:
        print("Список пользователей пуст.")
        return

    first = users_list[0]
    for key in ("id", "login", "role"):
        assert key in first, f"missing key in list item: {key}"

    target = ctx.ids.get("service_user_target_id")
    if not target:
        if ctx.user_id and any(u["id"] == ctx.user_id for u in users_list):
            target = ctx.user_id
        else:
            target = first["id"]
    ctx.ids["service_user_target_id"] = target
    print("service_user_target_id:", target)

    print(f"=== GET /service_user/{{user_id}} (user_id={target}) ===")
    get_resp = ctx.get(f"/service_user/{target}")
    print_response(get_resp)
    if not get_resp.ok:
        return

    snap = get_resp.json()
    required_keys = {
        "id",
        "login",
        "first_name",
        "last_name",
        "role",
        "is_active",
        "created_at",
        "updated_at",
        "deleted_at",
    }
    assert required_keys.issubset(snap.keys()), "service_user response has invalid structure"
    assert snap["id"] == target
    ctx.ids["service_user_snapshot"] = snap

    print(f"=== PUT /service_user/{{user_id}} (user_id={target}) ===")
    put_resp = ctx.put(
        f"/service_user/{target}",
        json={
            "login": snap["login"],
            "first_name": "NotebookFirst",
            "last_name": "NotebookLast",
            "role": snap["role"],
            "is_active": snap["is_active"],
        },
    )
    print_response(put_resp)
    if put_resp.ok:
        body = put_resp.json()
        assert body.get("first_name") == "NotebookFirst"
        assert body.get("last_name") == "NotebookLast"

    print(f"=== PATCH /service_user/{{user_id}} (user_id={target}) ===")
    patch_resp = ctx.patch(
        f"/service_user/{target}",
        json={
            "first_name": snap.get("first_name"),
            "last_name": snap.get("last_name"),
        },
    )
    print_response(patch_resp)
    if patch_resp.ok:
        body = patch_resp.json()
        assert body.get("first_name") == snap.get("first_name")
        assert body.get("last_name") == snap.get("last_name")

    delete_id = ctx.ids.get("service_user_delete_id")
    if not do_delete or not delete_id:
        print(
            "DELETE /service_user/{id} пропущен. "
            "Задайте ctx.ids['service_user_delete_id'] и do_delete=True."
        )
        return

    print(f"=== DELETE /service_user/{{user_id}} (user_id={delete_id}) ===")
    del_resp = ctx.delete(f"/service_user/{delete_id}")
    print("Status:", del_resp.status_code)
    if del_resp.status_code == 204:
        print("Удалено (204 soft delete).")
        verify = ctx.get(f"/service_user/{delete_id}")
        print("=== GET после DELETE (ожидается 404) ===")
        print_response(verify)
        assert verify.status_code == 404
    else:
        print_response(del_resp)
