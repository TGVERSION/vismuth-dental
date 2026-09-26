"""Smoke: публичная анкета + раздел врача (нужны clinic + doctor membership)."""

from __future__ import annotations

import uuid
from datetime import date

from _client import SmokeContext, print_response


def _answer(ctx: SmokeContext, qid: str, token: str, body: dict) -> dict:
    resp = ctx.post(
        f"/public/questionnaires/{qid}/answer",
        auth=False,
        headers={"X-Questionnaire-Token": token},
        json=body,
        timeout=60,
    )
    print_response(resp)
    assert resp.ok, resp.text
    return resp.json()


def run_public_primary_flow(ctx: SmokeContext) -> None:
    """Первичный приём по clinic slug; AI может быть unavailable."""
    clinic_slug = ctx.ids.get("clinic_public_slug")
    doctor_membership_id = ctx.ids.get("doctor_membership_id")
    if not clinic_slug or not doctor_membership_id:
        print(
            "Нужны ctx.ids['clinic_public_slug'] и "
            "ctx.ids['doctor_membership_id'] "
            "(создайте клинику/врача через super_admin / clinic-admin smoke)."
        )
        return

    device_id = f"smoke-device-{uuid.uuid4().hex[:12]}"
    print("=== GET /public/links/{slug} ===")
    link = ctx.get(f"/public/links/{clinic_slug}", auth=False)
    print_response(link)
    assert link.ok, link.text
    assert link.json()["blocked"] is False

    print("=== POST /public/questionnaires ===")
    create = ctx.post(
        "/public/questionnaires",
        auth=False,
        headers={"X-Device-Id": device_id},
        json={
            "slug": clinic_slug,
            "doctor_membership_id": doctor_membership_id,
        },
    )
    print_response(create)
    assert create.status_code == 201, create.text
    body = create.json()
    qid = body["id"]
    token = body["token"]
    step = body["step"]
    ctx.ids["questionnaire_id"] = qid
    ctx.ids["questionnaire_token"] = token

    # skip choose_doctor if already set; may be choose_specialization or visit_type
    if step["step_key"] == "choose_specialization":
        specs = step.get("options") or []
        assert specs, "doctor must have specializations"
        step = _answer(
            ctx,
            qid,
            token,
            {
                "step_key": "choose_specialization",
                "specialization_id": specs[0]["id"],
            },
        )

    if step["step_key"] == "visit_type":
        step = _answer(
            ctx,
            qid,
            token,
            {"step_key": "visit_type", "choice": "primary"},
        )

    assert step["step_key"] == "complaint"
    step = _answer(
        ctx,
        qid,
        token,
        {
            "step_key": "complaint",
            "value": "Болит голова третий день, давящая боль в висках",
        },
    )

    # ai_clarify (0..6) or medications if AI off / done
    while step["step_key"] == "ai_clarify":
        step = _answer(
            ctx,
            qid,
            token,
            {"step_key": "ai_clarify", "value": "Справа, умеренная, без тошноты"},
        )

    for key, value in [
        ("medications", "нет"),
        ("chronic", "нет"),
        ("allergy", "нет"),
    ]:
        assert step["step_key"] == key, step
        none = value == "нет"
        step = _answer(
            ctx,
            qid,
            token,
            {
                "step_key": key,
                "none": none,
                "value": None if none else value,
            },
        )

    assert step["step_key"] == "patient_info"
    appt = date.today().isoformat()
    step = _answer(
        ctx,
        qid,
        token,
        {
            "step_key": "patient_info",
            "first_name": "Иван",
            "middle_name": "Иванович",
            "appointment_date": appt,
            "appointment_time": "10:00",
        },
    )
    assert step["step_key"] == "code"
    assert step.get("code") and len(step["code"]) == 4
    ctx.ids["questionnaire_code"] = step["code"]
    print("CODE:", step["code"], "ai_unavailable:", step.get("ai_unavailable"))


def run_doctor_list_and_protocol(ctx: SmokeContext) -> None:
    """Список анкет врача + создание протокола (нужен JWT врача и structure)."""
    if not ctx.require_token():
        return
    code = ctx.ids.get("questionnaire_code")
    qid = ctx.ids.get("questionnaire_id")
    structure_id = ctx.ids.get("protocol_structure_id")
    if not code or not qid:
        print("Сначала run_public_primary_flow")
        return

    print("=== GET /questionnaires?code=… ===")
    listing = ctx.get("/questionnaires", params={"code": code})
    print_response(listing)
    assert listing.ok, listing.text
    items = listing.json()
    assert any(i["id"] == qid for i in items), items

    print("=== GET /questionnaires/{id} ===")
    detail = ctx.get(f"/questionnaires/{qid}")
    print_response(detail)
    assert detail.ok, detail.text
    assert detail.json()["code"] == code

    if not structure_id:
        print(
            "ctx.ids['protocol_structure_id'] не задан — "
            "создание протокола пропущено"
        )
        return

    print("=== POST /questionnaires/{id}/protocol ===")
    proto = ctx.post(
        f"/questionnaires/{qid}/protocol",
        json={"protocol_structure_id": structure_id},
    )
    print_response(proto)
    assert proto.status_code == 201, proto.text
    body = proto.json()
    assert body.get("created_from_questionnaire") is True
    assert body.get("source_questionnaire_id") == qid
    ctx.ids["protocol_from_questionnaire_id"] = body["id"]

    print("=== POST /questionnaires/{id}/protocol (повтор → 409) ===")
    again = ctx.post(
        f"/questionnaires/{qid}/protocol",
        json={"protocol_structure_id": structure_id},
    )
    print_response(again)
    assert again.status_code == 409, again.text


def run_device_limit(ctx: SmokeContext) -> None:
    """6-я анкета с одного device за час → 429."""
    clinic_slug = ctx.ids.get("clinic_public_slug")
    if not clinic_slug:
        print("Нужен clinic_public_slug")
        return
    device_id = f"smoke-limit-{uuid.uuid4().hex[:8]}"
    for i in range(5):
        resp = ctx.post(
            "/public/questionnaires",
            auth=False,
            headers={"X-Device-Id": device_id},
            json={"slug": clinic_slug},
        )
        assert resp.status_code == 201, (i, resp.text)
    sixth = ctx.post(
        "/public/questionnaires",
        auth=False,
        headers={"X-Device-Id": device_id},
        json={"slug": clinic_slug},
    )
    print_response(sixth)
    assert sixth.status_code == 429, sixth.text
