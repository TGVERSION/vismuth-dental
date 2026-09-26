"""Smoke: клиника + врач + публичная анкета + раздел врача."""

from __future__ import annotations

import time
import uuid
from datetime import date, timedelta

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


def _require_super_admin(ctx: SmokeContext) -> bool:
    if not ctx.require_token():
        return False
    me = ctx.get("/service_user")
    if not me.ok:
        print_response(me)
        return False
    if me.json().get("role") != "super_admin":
        print(
            f"Нужен super_admin (сейчас role={me.json().get('role')}). "
            "Перелогиньтесь и перезапустите setup."
        )
        return False
    return True


def run_setup_clinic_with_doctor(ctx: SmokeContext) -> None:
    """Создать клинику → invite врача со специализацией → accept.

    Заполняет ctx.ids:
      clinic_id, clinic_public_slug,
      doctor_membership_id, doctor_public_slug,
      doctor_email, doctor_password,
      specialization_id
    Сохраняет JWT супер-админа в ctx.ids['sa_token'] и переключает ctx на врача.
    """
    if not _require_super_admin(ctx):
        return

    ctx.ids["sa_token"] = ctx.token
    ctx.ids["sa_user_id"] = ctx.user_id
    ctx.ids["sa_email"] = ctx.email
    ctx.ids["sa_password"] = ctx.password

    print("=== GET /specializations ===")
    specs_resp = ctx.get("/specializations")
    print_response(specs_resp)
    assert specs_resp.ok, specs_resp.text
    specs = specs_resp.json()
    assert isinstance(specs, list) and specs, "ref_specialization пуст — seed refs"
    specialization_id = specs[0]["id"]
    ctx.ids["specialization_id"] = specialization_id
    print("specialization_id:", specialization_id, specs[0].get("name"))

    suffix = uuid.uuid4().hex[:8]
    access_until = (date.today() + timedelta(days=60)).isoformat()
    print("=== POST /super-admin/clinics (для анкеты) ===")
    create = ctx.post(
        "/super-admin/clinics",
        json={
            "name": f"Q Smoke Clinic {suffix}",
            "phone": "+79001112233",
            "email": f"q-clinic-{suffix}@example.com",
            "doctors_limit": 5,
            "access_until": access_until,
            "access_type": "trial",
            "brand_color": "#2266aa",
        },
    )
    print_response(create)
    assert create.status_code == 201, create.text
    clinic = create.json()
    clinic_id = clinic["id"]
    clinic_slug = clinic["public_slug"]
    ctx.ids["clinic_id"] = clinic_id
    ctx.ids["clinic_public_slug"] = clinic_slug
    print("clinic_id:", clinic_id, "slug:", clinic_slug)

    doctor_email = f"q-doctor-{suffix}@example.com"
    doctor_password = "smokeDocPass123"
    print("=== POST /clinics/{id}/invitations (doctor + specialization) ===")
    inv = ctx.post(
        f"/clinics/{clinic_id}/invitations",
        json={
            "email": doctor_email,
            "first_name": "Smoke",
            "last_name": "Doctor",
            "middle_name": "Testovich",
            "is_clinic_admin": True,
            "is_doctor": True,
            "specialization_ids": [specialization_id],
        },
    )
    print_response(inv)
    assert inv.status_code == 201, inv.text
    invite_url = inv.json()["invite_url"]
    invite_token = invite_url.split("token=", 1)[-1]
    ctx.ids["doctor_email"] = doctor_email
    ctx.ids["doctor_password"] = doctor_password

    print("=== POST /auth/invitations/accept (doctor) ===")
    accept = ctx.post(
        "/auth/invitations/accept",
        auth=False,
        json={
            "token": invite_token,
            "password": doctor_password,
        },
    )
    print_response(accept)
    assert accept.ok, accept.text
    ctx.set_token_from_auth_response(accept)
    ctx.email = doctor_email
    ctx.password = doctor_password

    print("=== GET /me/clinic ===")
    me_clinic = ctx.get("/me/clinic")
    print_response(me_clinic)
    assert me_clinic.ok, me_clinic.text
    body = me_clinic.json()
    assert body["clinic_id"] == clinic_id
    assert body["is_doctor"] is True
    assert body.get("doctor_public_slug")
    assert body.get("doctor_public_url")
    ctx.ids["doctor_membership_id"] = body["membership_id"]
    ctx.ids["doctor_public_slug"] = body["doctor_public_slug"]
    print(
        "doctor_membership_id:",
        body["membership_id"],
        "doctor_slug:",
        body["doctor_public_slug"],
    )

    print("=== GET /clinics/{id}/members ===")
    members = ctx.get(f"/clinics/{clinic_id}/members")
    print_response(members)
    assert members.ok, members.text
    assert any(
        m["id"] == body["membership_id"] and m["status"] == "active"
        for m in members.json()
    )

    print("Setup OK. ctx переключён на врача.")


def restore_super_admin(ctx: SmokeContext) -> None:
    """Вернуть JWT супер-админа из ctx.ids (после setup)."""
    sa = ctx.ids.get("sa_token")
    if not sa:
        print("sa_token нет — сначала run_setup_clinic_with_doctor")
        return
    ctx.token = sa
    ctx.user_id = ctx.ids.get("sa_user_id")
    if ctx.ids.get("sa_email"):
        ctx.email = ctx.ids["sa_email"]
    if ctx.ids.get("sa_password"):
        ctx.password = ctx.ids["sa_password"]
    print("ctx.token восстановлен как super_admin")


def login_as_doctor(ctx: SmokeContext) -> None:
    """Логин под врачом из setup (нужно для /questionnaires)."""
    email = ctx.ids.get("doctor_email")
    password = ctx.ids.get("doctor_password")
    if not email or not password:
        print("doctor_email/password нет — сначала setup")
        return
    ctx.email = email
    ctx.password = password
    from _client import login

    login(ctx)


def _walk_to_code(
    ctx: SmokeContext,
    *,
    slug: str,
    doctor_membership_id: str | None,
    visit_type: str,
    device_id: str | None = None,
) -> dict:
    device_id = device_id or f"smoke-device-{uuid.uuid4().hex[:12]}"
    create_body: dict = {"slug": slug}
    if doctor_membership_id:
        create_body["doctor_membership_id"] = doctor_membership_id

    print("=== POST /public/questionnaires ===")
    create = ctx.post(
        "/public/questionnaires",
        auth=False,
        headers={"X-Device-Id": device_id},
        json=create_body,
    )
    print_response(create)
    assert create.status_code == 201, create.text
    body = create.json()
    qid = body["id"]
    token = body["token"]
    step = body["step"]
    ctx.ids["questionnaire_id"] = qid
    ctx.ids["questionnaire_token"] = token
    ctx.ids["last_device_id"] = device_id

    if step["step_key"] == "choose_doctor":
        mid = doctor_membership_id or ctx.ids.get("doctor_membership_id")
        assert mid, "нужен doctor_membership_id"
        step = _answer(
            ctx,
            qid,
            token,
            {"step_key": "choose_doctor", "doctor_membership_id": mid},
        )

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
            {"step_key": "visit_type", "choice": visit_type},
        )

    if visit_type == "primary":
        assert step["step_key"] == "complaint", step
        step = _answer(
            ctx,
            qid,
            token,
            {
                "step_key": "complaint",
                "value": "Болит голова третий день, давящая боль в висках",
            },
        )
        while step["step_key"] == "ai_clarify":
            step = _answer(
                ctx,
                qid,
                token,
                {
                    "step_key": "ai_clarify",
                    "value": "Справа, умеренная, без тошноты",
                },
            )
        for key in ("medications", "chronic", "allergy"):
            assert step["step_key"] == key, step
            step = _answer(
                ctx,
                qid,
                token,
                {"step_key": key, "none": True},
            )
    else:
        assert step["step_key"] == "repeat_change", step
        step = _answer(
            ctx,
            qid,
            token,
            {
                "step_key": "repeat_change",
                "choice": "better",
                "value": "Стало легче, меньше боли",
            },
        )
        assert step["step_key"] == "repeat_compliance", step
        step = _answer(
            ctx,
            qid,
            token,
            {"step_key": "repeat_compliance", "choice": "yes"},
        )
        assert step["step_key"] == "repeat_side_effects", step
        step = _answer(
            ctx,
            qid,
            token,
            {"step_key": "repeat_side_effects", "none": True},
        )
        while step["step_key"] == "ai_clarify":
            step = _answer(
                ctx,
                qid,
                token,
                {"step_key": "ai_clarify", "skip": True},
            )

    assert step["step_key"] == "patient_info", step
    step = _answer(
        ctx,
        qid,
        token,
        {
            "step_key": "patient_info",
            "first_name": "Иван",
            "middle_name": "Иванович",
            "appointment_date": date.today().isoformat(),
            "appointment_time": "10:00",
        },
    )
    assert step["step_key"] == "code", step
    assert step.get("code") and len(step["code"]) == 4
    ctx.ids["questionnaire_code"] = step["code"]
    print("CODE:", step["code"], "ai_unavailable:", step.get("ai_unavailable"))
    return step


def run_public_link_check(ctx: SmokeContext) -> None:
    """GET /public/links/{slug} для клиники и врача."""
    clinic_slug = ctx.ids.get("clinic_public_slug")
    doctor_slug = ctx.ids.get("doctor_public_slug")
    if not clinic_slug:
        print("Нужен clinic_public_slug — run_setup_clinic_with_doctor")
        return

    print("=== GET /public/links/{clinic_slug} ===")
    link = ctx.get(f"/public/links/{clinic_slug}", auth=False)
    print_response(link)
    assert link.ok, link.text
    body = link.json()
    assert body["blocked"] is False
    assert body["link_type"] == "clinic"
    assert body["doctors"], "ожидается список врачей"

    if doctor_slug:
        print("=== GET /public/links/{doctor_slug} ===")
        dlink = ctx.get(f"/public/links/{doctor_slug}", auth=False)
        print_response(dlink)
        assert dlink.ok, dlink.text
        dbody = dlink.json()
        assert dbody["blocked"] is False
        assert dbody["link_type"] == "doctor"
        assert dbody.get("doctor") is not None


def run_public_primary_flow(ctx: SmokeContext) -> None:
    """Первичный приём по clinic slug + doctor_membership_id."""
    clinic_slug = ctx.ids.get("clinic_public_slug")
    doctor_membership_id = ctx.ids.get("doctor_membership_id")
    if not clinic_slug or not doctor_membership_id:
        print(
            "Нужны clinic_public_slug и doctor_membership_id "
            "(run_setup_clinic_with_doctor)."
        )
        return
    _walk_to_code(
        ctx,
        slug=clinic_slug,
        doctor_membership_id=doctor_membership_id,
        visit_type="primary",
    )


def run_public_doctor_link_flow(ctx: SmokeContext) -> None:
    """Персональная ссылка врача: без choose_doctor (и часто без specialization)."""
    doctor_slug = ctx.ids.get("doctor_public_slug")
    if not doctor_slug:
        print("Нужен doctor_public_slug")
        return
    _walk_to_code(
        ctx,
        slug=doctor_slug,
        doctor_membership_id=None,
        visit_type="primary",
    )


def run_public_repeat_flow(ctx: SmokeContext) -> None:
    """Повторный приём."""
    clinic_slug = ctx.ids.get("clinic_public_slug")
    doctor_membership_id = ctx.ids.get("doctor_membership_id")
    if not clinic_slug or not doctor_membership_id:
        print("Нужны clinic_public_slug и doctor_membership_id")
        return
    _walk_to_code(
        ctx,
        slug=clinic_slug,
        doctor_membership_id=doctor_membership_id,
        visit_type="repeat",
    )


def run_doctor_list_and_protocol(ctx: SmokeContext) -> None:
    """Список анкет врача + process + создание протокола (JWT врача + structure)."""
    if not ctx.require_token():
        return
    code = ctx.ids.get("questionnaire_code")
    qid = ctx.ids.get("questionnaire_id")
    if not code or not qid:
        print("Сначала run_public_primary_flow (или другой flow до code)")
        return

    print("=== GET /questionnaires?code=… ===")
    listing = ctx.get("/questionnaires", params={"code": code})
    print_response(listing)
    assert listing.ok, listing.text
    items = listing.json()
    assert any(i["id"] == qid for i in items), items

    print("=== GET /questionnaires/{id} (processing_status) ===")
    detail = ctx.get(f"/questionnaires/{qid}")
    print_response(detail)
    assert detail.ok, detail.text
    d = detail.json()
    assert d["code"] == code
    assert isinstance(d.get("answers"), list)
    status_val = d.get("processing_status")
    assert status_val in {None, "pending", "done", "failed"}, status_val

    # short poll if still pending (background summarize)
    if status_val == "pending":
        for _ in range(15):
            time.sleep(1)
            detail = ctx.get(f"/questionnaires/{qid}")
            assert detail.ok, detail.text
            d = detail.json()
            status_val = d.get("processing_status")
            if status_val in {"done", "failed"}:
                break
        print(f"  processing_status after poll: {status_val}")

    print("=== POST /questionnaires/{id}/process ===")
    process_resp = ctx.post(f"/questionnaires/{qid}/process")
    print_response(process_resp)
    assert process_resp.status_code == 202, process_resp.text
    process_body = process_resp.json()
    assert process_body.get("processing_status") == "pending"

    structure_id = ctx.ids.get("protocol_structure_id")
    if not structure_id:
        print(
            "ctx.ids['protocol_structure_id'] не задан — "
            "сначала protocol_structures.run_create; создание протокола пропущено"
        )
        return

    # wait briefly so protocol can use structured if ML finished
    for _ in range(10):
        detail = ctx.get(f"/questionnaires/{qid}")
        assert detail.ok, detail.text
        d = detail.json()
        if d.get("processing_status") in {"done", "failed"}:
            break
        time.sleep(1)

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
    print(f"=== device limit: 5 OK, 6-я → 429 (device={device_id}) ===")
    for i in range(5):
        resp = ctx.post(
            "/public/questionnaires",
            auth=False,
            headers={"X-Device-Id": device_id},
            json={"slug": clinic_slug},
        )
        assert resp.status_code == 201, (i, resp.text)
        print(f"  started #{i + 1}: {resp.status_code}")
    sixth = ctx.post(
        "/public/questionnaires",
        auth=False,
        headers={"X-Device-Id": device_id},
        json={"slug": clinic_slug},
    )
    print_response(sixth)
    assert sixth.status_code == 429, sixth.text
    detail = sixth.json().get("detail")
    if isinstance(detail, dict):
        assert detail.get("code") == "device_limit"


def run_all(ctx: SmokeContext, *, include_device_limit: bool = False) -> None:
    """Полный suite: setup → links → primary → doctor list/protocol → repeat.

    Ожидает JWT super_admin на входе. В конце ctx — врач.
    Для протокола нужен protocol_structure_id (секция structures раньше).
    """
    run_setup_clinic_with_doctor(ctx)
    run_public_link_check(ctx)
    run_public_primary_flow(ctx)
    run_doctor_list_and_protocol(ctx)
    run_public_repeat_flow(ctx)
    run_public_doctor_link_flow(ctx)
    if include_device_limit:
        run_device_limit(ctx)
    print("questionnaire.run_all OK")
