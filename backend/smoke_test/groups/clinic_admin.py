"""Smoke: статистика анкет clinic-admin / super-admin."""

from __future__ import annotations

from _client import SmokeContext, print_response

from .super_admin_clinics import _require_super_admin

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


def run_statistics(ctx: SmokeContext) -> None:
    """Проверка `/super-admin/statistics` и `/clinics/{id}/statistics`."""
    if not _require_super_admin(ctx):
        return

    print("=== GET /super-admin/clinics (для clinic_id) ===")
    list_resp = ctx.get("/super-admin/clinics")
    print_response(list_resp)
    assert list_resp.ok
    clinics = list_resp.json()
    assert clinics, "Нужна хотя бы одна клиника для smoke статистики"
    clinic_id = clinics[0]["id"]
    ctx.ids["clinic_id"] = clinic_id

    print("=== GET /super-admin/statistics?period=week ===")
    sa = ctx.get("/super-admin/statistics", params={"period": "week"})
    print_response(sa)
    assert sa.ok
    body = sa.json()
    assert SUPER_STATS_KEYS.issubset(body.keys())
    assert isinstance(body["clinics"], list)
    assert isinstance(body["summary"]["abandoned_by_step"], list)

    print(f"=== GET /clinics/{clinic_id}/statistics?period=month ===")
    clinic = ctx.get(
        f"/clinics/{clinic_id}/statistics",
        params={"period": "month"},
    )
    print_response(clinic)
    assert clinic.ok
    clinic_body = clinic.json()
    assert STATS_KEYS.issubset(clinic_body.keys())
    assert clinic_body["clinic_id"] == clinic_id
    assert isinstance(clinic_body["by_doctor"], list)
    assert isinstance(clinic_body["abandoned_by_step"], list)

    print("=== GET /clinics/{id}/statistics from/to ===")
    ranged = ctx.get(
        f"/clinics/{clinic_id}/statistics",
        params={"from": "2026-01-01", "to": "2026-01-31"},
    )
    print_response(ranged)
    assert ranged.ok
    assert ranged.json()["clinic_id"] == clinic_id

    print("Statistics smoke OK")
