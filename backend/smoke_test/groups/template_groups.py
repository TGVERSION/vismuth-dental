from __future__ import annotations

from _client import SmokeContext, print_response


def run_crud(ctx: SmokeContext, *, delete: bool = True) -> None:
    if not ctx.require_token():
        return

    group_name = ctx.ids.get("group_name", "TEST_GROUP_SMOKE")

    print("=== POST /template-groups (create) ===")
    create_resp = ctx.post("/template-groups", json={"group_name": group_name})
    print_response(create_resp)

    group_id = None
    if create_resp.ok:
        group_id = create_resp.json().get("id")
        ctx.ids["group_id"] = group_id
        print("Создана группа id:", group_id)

    print("=== GET /template-groups ===")
    print_response(ctx.get("/template-groups"))

    if not group_id:
        print("GROUP_ID не получен — останавливаю CRUD.")
        return

    new_name = f"{group_name}_updated"
    print(f"=== PUT /template-groups/{{group_id}} (id={group_id}) ===")
    print_response(
        ctx.put(f"/template-groups/{group_id}", json={"group_name": new_name})
    )

    if not delete:
        print("DELETE пропущен (delete=False).")
        return

    run_delete(ctx)


def run_delete(ctx: SmokeContext) -> None:
    if not ctx.require_token():
        return
    group_id = ctx.ids.get("group_id")
    if not group_id:
        print("group_id нет.")
        return
    print(f"=== DELETE /template-groups/{{group_id}} (id={group_id}) ===")
    del_resp = ctx.delete(f"/template-groups/{group_id}")
    print("Status:", del_resp.status_code)
    if del_resp.status_code == 204:
        print("Группа удалена (204).")
        ctx.ids.pop("group_id", None)
    else:
        print_response(del_resp)
