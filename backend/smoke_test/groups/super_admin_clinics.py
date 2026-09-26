"""Smoke: /super-admin/clinics + /auth/invitations (нужна роль super_admin)."""

from __future__ import annotations

import uuid
from datetime import date, timedelta

from _client import SmokeContext, print_response

CLINIC_KEYS = {
    "id",
    "name",
    "phone",
    "email",
    "logo_url",
    "brand_color",
    "doctors_limit",
    "access_until",
    "access_type",
    "public_slug",
    "access_status_code",
    "access_status_label",
    "doctors_count",
    "questionnaires_completed_month",
    "created_at",
    "updated_at",
    "deleted_at",
}

STATS_KEYS = {
    "clinic_id",
    "period_from",
    "period_to",
    "completed_total",
    "primary_count",
    "repeat_count",
    "protocols_total",
    "by_doctor",
    "abandoned_by_step",
}

SUPER_STATS_KEYS = {
    "period_from",
    "period_to",
    "clinics",
    "summary",
}


def _require_super_admin(ctx: SmokeContext) -> bool:
    if not ctx.require_token():
        return False
    me = ctx.get("/service_user")
    if not me.ok:
        print_response(me)
        print("Не удалось прочитать /service_user — smoke super-admin пропущен.")
        return False
    role = me.json().get("role")
    if role != "super_admin":
        print(
            f"Нужна роль super_admin (сейчас role={role}). "
            "Залогиньтесь под супер-админом и перезапустите секцию."
        )
        return False
    return True


def run_clinics_crud(ctx: SmokeContext, *, do_delete: bool = True) -> None:
    """CRUD клиник под super_admin."""
    if not _require_super_admin(ctx):
        return

    suffix = uuid.uuid4().hex[:8]
    access_until = (date.today() + timedelta(days=60)).isoformat()
    create_body = {
        "name": f"Smoke Clinic {suffix}",
        "phone": "+79001234567",
        "email": f"clinic-{suffix}@example.com",
        "doctors_limit": 3,
        "access_until": access_until,
        "access_type": "trial",
        "brand_color": "#112233",
        "logo_url": "https://example.com/logo.png",
    }

    print("=== POST /super-admin/clinics ===")
    create_resp = ctx.post("/super-admin/clinics", json=create_body)
    print_response(create_resp)
    assert create_resp.status_code == 201, create_resp.text
    clinic = create_resp.json()
    assert CLINIC_KEYS.issubset(clinic.keys()), "clinic response missing keys"
    assert clinic["name"] == create_body["name"]
    assert clinic["email"] == create_body["email"]
    assert clinic["access_type"] == "trial"
    assert clinic["access_status_code"] == "trial"
    assert clinic["public_slug"]
    assert clinic["doctors_count"] == 0
    assert clinic["questionnaires_completed_month"] == 0
    clinic_id = clinic["id"]
    public_slug = clinic["public_slug"]
    ctx.ids["clinic_id"] = clinic_id
    print("clinic_id:", clinic_id)

    print("=== GET /super-admin/clinics ===")
    list_resp = ctx.get("/super-admin/clinics")
    print_response(list_resp)
    assert list_resp.ok
    clinics = list_resp.json()
    assert isinstance(clinics, list)
    assert any(c["id"] == clinic_id for c in clinics)
    listed = next(c for c in clinics if c["id"] == clinic_id)
    assert "questionnaires_completed_month" in listed

    print(f"=== GET /super-admin/clinics/{{id}} ({clinic_id}) ===")
    get_resp = ctx.get(f"/super-admin/clinics/{clinic_id}")
    print_response(get_resp)
    assert get_resp.ok
    assert get_resp.json()["id"] == clinic_id
    assert get_resp.json()["questionnaires_completed_month"] == 0

    print("=== GET /super-admin/statistics?period=month ===")
    stats_resp = ctx.get("/super-admin/statistics", params={"period": "month"})
    print_response(stats_resp)
    assert stats_resp.ok
    stats_body = stats_resp.json()
    assert SUPER_STATS_KEYS.issubset(stats_body.keys())
    assert isinstance(stats_body["clinics"], list)
    assert "completed_total" in stats_body["summary"]
    assert "abandoned_by_step" in stats_body["summary"]

    print(f"=== GET /clinics/{{id}}/statistics?period=month ({clinic_id}) ===")
    clinic_stats = ctx.get(
        f"/clinics/{clinic_id}/statistics",
        params={"period": "month"},
    )
    print_response(clinic_stats)
    assert clinic_stats.ok
    clinic_stats_body = clinic_stats.json()
    assert STATS_KEYS.issubset(clinic_stats_body.keys())
    assert clinic_stats_body["clinic_id"] == clinic_id
    assert clinic_stats_body["completed_total"] == 0

    print("=== GET statistics period+from (ожидается 422) ===")
    bad = ctx.get(
        f"/clinics/{clinic_id}/statistics",
        params={"period": "month", "from": "2026-01-01", "to": "2026-01-31"},
    )
    print_response(bad)
    assert bad.status_code == 422

    print(f"=== PATCH /super-admin/clinics/{{id}} ({clinic_id}) ===")
    patch_resp = ctx.patch(
        f"/super-admin/clinics/{clinic_id}",
        json={
            "name": f"Smoke Clinic Patched {suffix}",
            "doctors_limit": 7,
            "access_type": "paid",
        },
    )
    print_response(patch_resp)
    assert patch_resp.ok
    patched = patch_resp.json()
    assert "Patched" in patched["name"]
    assert patched["doctors_limit"] == 7
    assert patched["access_type"] == "paid"
    assert patched["access_status_code"] == "paid"
    assert patched["public_slug"] == public_slug
    assert patched.get("updated_at") is not None

    if not do_delete:
        print("DELETE клиники пропущен (do_delete=False).")
        return

    print(f"=== DELETE /super-admin/clinics/{{id}} ({clinic_id}) ===")
    del_resp = ctx.delete(f"/super-admin/clinics/{clinic_id}")
    print_response(del_resp)
    assert del_resp.ok
    assert del_resp.json().get("deleted_at") is not None

    print("=== GET после soft-delete (ожидается 404) ===")
    after = ctx.get(f"/super-admin/clinics/{clinic_id}")
    print_response(after)
    assert after.status_code == 404
    ctx.ids.pop("clinic_id", None)


def run_invite_flow(ctx: SmokeContext) -> None:
    """Создать клинику → invite → preview → accept → resend."""
    if not _require_super_admin(ctx):
        return

    suffix = uuid.uuid4().hex[:8]
    access_until = (date.today() + timedelta(days=30)).isoformat()

    print("=== POST /super-admin/clinics (для invite) ===")
    create_resp = ctx.post(
        "/super-admin/clinics",
        json={
            "name": f"Invite Clinic {suffix}",
            "email": f"invite-clinic-{suffix}@example.com",
            "doctors_limit": 5,
            "access_until": access_until,
            "access_type": "trial",
        },
    )
    print_response(create_resp)
    assert create_resp.status_code == 201
    clinic_id = create_resp.json()["id"]
    ctx.ids["invite_clinic_id"] = clinic_id

    invite_email = f"clinic-admin-{suffix}@example.com"
    print("=== POST /super-admin/clinics/{id}/invitations ===")
    inv_resp = ctx.post(
        f"/super-admin/clinics/{clinic_id}/invitations",
        json={
            "email": invite_email,
            "first_name": "Smoke",
            "last_name": "Admin",
            "is_clinic_admin": True,
            "is_doctor": False,
        },
    )
    print_response(inv_resp)
    assert inv_resp.status_code == 201, inv_resp.text
    invitation = inv_resp.json()
    assert invitation["email"] == invite_email
    assert invitation["is_clinic_admin"] is True
    assert invitation.get("invite_url")
    assert "email_sent" in invitation
    invitation_id = invitation["id"]
    ctx.ids["invitation_id"] = invitation_id

    invite_url = invitation["invite_url"]
    token = invite_url.split("token=", 1)[-1]
    assert token, "invite_url must contain token="
    ctx.ids["invite_token"] = token
    print("invite token (start):", token[:16] + "...")

    print("=== GET /super-admin/clinics/{id}/invitations ===")
    list_inv = ctx.get(f"/super-admin/clinics/{clinic_id}/invitations")
    print_response(list_inv)
    assert list_inv.ok
    assert any(i["id"] == invitation_id for i in list_inv.json())

    print("=== GET /auth/invitations/{token} ===")
    preview = ctx.get(f"/auth/invitations/{token}", auth=False)
    print_response(preview)
    assert preview.ok
    preview_body = preview.json()
    assert preview_body["email"] == invite_email
    assert preview_body["clinic_id"] == clinic_id
    assert preview_body["first_name"] == "Smoke"

    print("=== POST /auth/invitations/accept ===")
    sa_token = ctx.token
    sa_user_id = ctx.user_id
    accept_resp = ctx.post(
        "/auth/invitations/accept",
        auth=False,
        json={
            "token": token,
            "password": "smokePass123",
        },
    )
    print_response(accept_resp)
    assert accept_resp.ok, accept_resp.text
    accept_body = accept_resp.json()
    assert accept_body.get("access_token")
    assert accept_body.get("user", {}).get("login") == invite_email
    assert accept_body["user"]["role"] == "doctor"
    ctx.ids["invited_user_id"] = accept_body["user"]["id"]

    print("=== POST /auth/invitations/accept (повтор, ожидается 404) ===")
    again = ctx.post(
        "/auth/invitations/accept",
        auth=False,
        json={"token": token, "password": "smokePass123"},
    )
    print_response(again)
    assert again.status_code == 404

    ctx.token = sa_token
    ctx.user_id = sa_user_id

    resend_email = f"clinic-admin-resend-{suffix}@example.com"
    print("=== POST invitations (второй invite для resend) ===")
    inv2 = ctx.post(
        f"/super-admin/clinics/{clinic_id}/invitations",
        json={
            "email": resend_email,
            "first_name": "Resend",
            "is_clinic_admin": True,
        },
    )
    print_response(inv2)
    assert inv2.status_code == 201
    inv2_id = inv2.json()["id"]
    old_url = inv2.json()["invite_url"]
    old_token = old_url.split("token=", 1)[-1]

    print("=== POST .../invitations/{id}/resend ===")
    resend = ctx.post(
        f"/super-admin/clinics/{clinic_id}/invitations/{inv2_id}/resend",
    )
    print_response(resend)
    assert resend.ok
    new_url = resend.json().get("invite_url")
    assert new_url
    new_token = new_url.split("token=", 1)[-1]
    assert new_token != old_token

    print("=== GET preview старого token после resend (ожидается 404) ===")
    old_preview = ctx.get(f"/auth/invitations/{old_token}", auth=False)
    print_response(old_preview)
    assert old_preview.status_code == 404

    print("=== GET preview нового token ===")
    new_preview = ctx.get(f"/auth/invitations/{new_token}", auth=False)
    print_response(new_preview)
    assert new_preview.ok
    assert new_preview.json()["email"] == resend_email

    print("Invite flow OK. clinic_id=", clinic_id)


def run_forbidden_without_super_admin(ctx: SmokeContext) -> None:
    """Если текущий user не super_admin — ожидаем 403 на list clinics."""
    if not ctx.require_token():
        return
    me = ctx.get("/service_user")
    if not me.ok:
        return
    role = me.json().get("role")
    if role == "super_admin":
        print("Текущий user — super_admin, проверку 403 пропускаем.")
        return
    print("=== GET /super-admin/clinics (ожидается 403) ===")
    resp = ctx.get("/super-admin/clinics")
    print_response(resp)
    assert resp.status_code == 403


def run_all(ctx: SmokeContext, *, do_delete_clinic: bool = True) -> None:
    """Полный suite: CRUD (с soft-delete) + invite flow."""
    run_clinics_crud(ctx, do_delete=do_delete_clinic)
    run_invite_flow(ctx)
