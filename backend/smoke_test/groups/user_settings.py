from __future__ import annotations

from _client import SmokeContext, print_response


def run_crud(ctx: SmokeContext) -> None:
    if not ctx.require_token():
        return

    user_id = ctx.user_id or ctx.ids.get("user_id")
    if not user_id:
        print("user_id неизвестен — выполните login/confirm или задайте ctx.user_id.")
        return

    print(f"=== GET /user-settings/{{user_id}} (user_id={user_id}) ===")
    get_resp = ctx.get(f"/user-settings/{user_id}")
    print_response(get_resp)

    print(f"=== POST /user-settings/{{user_id}} (user_id={user_id}) ===")
    post_resp = ctx.post(
        f"/user-settings/{user_id}",
        json={
            "mkb_code": True,
            "autocomplete": "dict_autocomplete",
            "fullness_complaints": True,
        },
    )
    print_response(post_resp)

    print(f"=== PUT /user-settings/{{user_id}} (user_id={user_id}) ===")
    put_resp = ctx.put(
        f"/user-settings/{user_id}",
        json={
            "mkb_code": False,
            "autocomplete": "ml_autocomplete",
            "fullness_complaints": False,
        },
    )
    print_response(put_resp)

    print(f"=== PATCH /user-settings/{{user_id}} (user_id={user_id}) ===")
    patch_resp = ctx.patch(
        f"/user-settings/{user_id}",
        json={
            "autocomplete": "off",
            "fullness_complaints": True,
        },
    )
    print_response(patch_resp)
