from __future__ import annotations

from datetime import date, timedelta

from _client import SmokeContext, login, print_response


def _assert_subscription_expired(resp) -> None:
    assert resp.status_code == 503, resp.text
    detail = resp.json().get("detail")
    assert isinstance(detail, dict), detail
    assert detail.get("code") == "subscription_expired", detail


def _assert_not_subscription_expired(resp) -> None:
    if resp.status_code != 503:
        return
    detail = resp.json().get("detail")
    if isinstance(detail, dict):
        assert detail.get("code") != "subscription_expired", detail


def run_mkb_code(ctx: SmokeContext) -> None:
    if not ctx.require_token():
        return

    field_name = ctx.ids.get("ml_field_name", "test_field_123")
    description = ctx.ids.get("ml_mkb_description", "ОРВИ")
    n_candidates = ctx.ids.get("ml_mkb_n_candidates", 1)
    use_llm = ctx.ids.get("ml_mkb_use_llm", True)

    print("=== POST /ml_mkb_code ===")
    resp = ctx.post(
        "/ml_mkb_code",
        json={
            "field_name": field_name,
            "description": description,
            "n_candidates": n_candidates,
            "use_llm": use_llm,
        },
        timeout=60,
    )
    print_response(resp)

    selected_text = None
    if resp.ok:
        body = resp.json()
        candidates = body.get("candidates") or []
        if candidates:
            selected_text = (
                candidates[0].get("name")
                or candidates[0].get("code")
                or body.get("best_name")
            )
        else:
            selected_text = body.get("best_name") or body.get("best_code")
        ctx.ids["ml_mkb_selected_text"] = selected_text

    print("=== POST /ml_mkb_code/select ===")
    select_resp = ctx.post(
        "/ml_mkb_code/select",
        json={
            "field_name": field_name,
            "description": description,
            "n_candidates": n_candidates,
            "selected_text": selected_text,
            "event_type": "suggestion_selected",
            "type_autocomplete": "ml_autocomplete",
        },
    )
    print_response(select_resp)


def run_autocomplete(ctx: SmokeContext) -> None:
    if not ctx.require_token():
        return

    field_name = ctx.ids.get("ml_field_name", "test_field_123")
    prefix = ctx.ids.get("ml_autocomplete_prefix", "боль в")
    count = ctx.ids.get("ml_autocomplete_suggestions_count", 3)

    print("=== POST /ml_autocomplete (type_autocomplete=ml_autocomplete) ===")
    print_response(
        ctx.post(
            "/ml_autocomplete",
            json={
                "field_name": field_name,
                "prefix": prefix,
                "suggestions_count": count,
                "type_autocomplete": "ml_autocomplete",
            },
            timeout=60,
        )
    )

    print("=== POST /ml_autocomplete (type_autocomplete=dict_autocomplete) ===")
    print_response(
        ctx.post(
            "/ml_autocomplete",
            json={
                "field_name": None,
                "prefix": prefix,
                "suggestions_count": count,
                "type_autocomplete": "dict_autocomplete",
            },
            timeout=60,
        )
    )

    print("=== POST /ml_autocomplete_stats ===")
    print_response(
        ctx.post(
            "/ml_autocomplete_stats",
            json={
                "field_name": field_name,
                "description": ctx.ids.get("ml_mkb_description", "ОРВИ"),
                "n_candidates": ctx.ids.get("ml_mkb_n_candidates", 1),
                "selected_text": ctx.ids.get("ml_mkb_selected_text") or "",
                "event_type": "form_click",
            },
        )
    )


def run_autocomplete_dict(ctx: SmokeContext) -> None:
    """Публичный POST /autocomplete_dict/complete_dict (без JWT)."""
    print("=== POST /autocomplete_dict/complete_dict ===")
    print_response(
        ctx.post(
            "/autocomplete_dict/complete_dict",
            auth=False,
            json={
                "full_text": ctx.ids.get("autocomplete_dict_text", "боль в гол"),
                "limit": 6,
            },
        )
    )


def run_fullness(ctx: SmokeContext) -> None:
    if not ctx.require_token():
        return
    prompt = ctx.ids.get(
        "fullness_prompt",
        "Боль в поясничной области, с иррадиацией в правую ногу, до 7 баллов.",
    )
    print("=== POST /ml_fullness_complaints ===")
    print_response(
        ctx.post(
            "/ml_fullness_complaints",
            json={"example_prompt": prompt},
            timeout=60,
        )
    )


def run_clinrec(ctx: SmokeContext) -> None:
    if not ctx.require_token():
        return

    print("=== POST /ml_clinrec_check ===")
    payload = {
        "protocol_text": (
            "Жалобы: головная боль, тошнота. "
            "Анамнез: симптоматика 2 дня. "
            "Объективно: температура 37.8, АД 130/80. "
            "Назначения: общий анализ крови, симптоматическая терапия."
        )
    }
    resp = ctx.post("/ml_clinrec_check", json=payload, timeout=60)
    print_response(resp)

    if not resp.ok:
        return

    data = resp.json()
    assert isinstance(data.get("severity_counts"), dict), "severity_counts must be dict"
    assert isinstance(data.get("findings"), list), "findings must be list"
    assert isinstance(data.get("compliant_sections"), list), "compliant_sections must be list"
    for level in ("critical", "warning", "info"):
        assert level in data["severity_counts"], f"missing severity key: {level}"
    if data["findings"]:
        required_keys = {
            "severity",
            "section",
            "issue",
            "recommendation",
            "guideline_ref",
            "guideline_quote",
        }
        assert required_keys.issubset(data["findings"][0].keys()), "finding has invalid structure"


def run_subscription_expired(ctx: SmokeContext) -> None:
    """Врач с истёкшим доступом клиники: ML → 503; dict/select/SA — без subscription_expired.

    Нужны ids после questionnaire.setup: clinic_id, sa_token, doctor_email/password.
    Без них — skip (ячейка ML часто под супер-админом без клиники).
    """
    clinic_id = ctx.ids.get("clinic_id")
    sa_token = ctx.ids.get("sa_token")
    doctor_email = ctx.ids.get("doctor_email")
    doctor_password = ctx.ids.get("doctor_password")
    if not clinic_id or not sa_token or not doctor_email or not doctor_password:
        print(
            "=== subscription_expired skip "
            "(нужны clinic_id, sa_token, doctor_email после questionnaire setup) ==="
        )
        return

    saved_token = ctx.token
    saved_user_id = ctx.user_id
    saved_email = ctx.email
    saved_password = ctx.password
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    restored_until = (date.today() + timedelta(days=60)).isoformat()

    field_name = ctx.ids.get("ml_field_name", "test_field_123")
    prefix = ctx.ids.get("ml_autocomplete_prefix", "боль в")
    count = ctx.ids.get("ml_autocomplete_suggestions_count", 3)
    description = ctx.ids.get("ml_mkb_description", "ОРВИ")
    n_candidates = ctx.ids.get("ml_mkb_n_candidates", 1)
    prompt = ctx.ids.get(
        "fullness_prompt",
        "Боль в поясничной области, с иррадиацией в правую ногу, до 7 баллов.",
    )

    try:
        print("=== PATCH clinic access_until=yesterday (super_admin) ===")
        ctx.token = sa_token
        patch = ctx.patch(
            f"/super-admin/clinics/{clinic_id}",
            json={"access_until": yesterday},
        )
        print_response(patch)
        assert patch.ok, patch.text
        assert patch.json().get("access_status_code") == "expired"

        print("=== login as doctor (expired clinic) ===")
        ctx.email = doctor_email
        ctx.password = doctor_password
        login(ctx)

        print("=== POST /ml_mkb_code (expect subscription_expired) ===")
        mkb = ctx.post(
            "/ml_mkb_code",
            json={
                "field_name": field_name,
                "description": description,
                "n_candidates": n_candidates,
                "use_llm": True,
            },
            timeout=60,
        )
        print_response(mkb)
        _assert_subscription_expired(mkb)

        print("=== POST /ml_autocomplete ml (expect subscription_expired) ===")
        ml_ac = ctx.post(
            "/ml_autocomplete",
            json={
                "field_name": field_name,
                "prefix": prefix,
                "suggestions_count": count,
                "type_autocomplete": "ml_autocomplete",
            },
            timeout=60,
        )
        print_response(ml_ac)
        _assert_subscription_expired(ml_ac)

        print("=== POST /ml_fullness_complaints (expect subscription_expired) ===")
        fullness = ctx.post(
            "/ml_fullness_complaints",
            json={"example_prompt": prompt},
            timeout=60,
        )
        print_response(fullness)
        _assert_subscription_expired(fullness)

        print("=== POST /ml_clinrec_check (expect subscription_expired) ===")
        clinrec = ctx.post(
            "/ml_clinrec_check",
            json={
                "protocol_text": (
                    "Жалобы: головная боль. Анамнез: 2 дня. "
                    "Объективно: t 37.8. Назначения: ОАК."
                ),
            },
            timeout=60,
        )
        print_response(clinrec)
        _assert_subscription_expired(clinrec)

        qid = ctx.ids.get("questionnaire_id")
        if qid:
            print("=== POST /questionnaires/{id}/process (expect subscription_expired) ===")
            process = ctx.post(f"/questionnaires/{qid}/process")
            print_response(process)
            _assert_subscription_expired(process)
        else:
            print("=== process skip (нет questionnaire_id) ===")

        print("=== POST /ml_autocomplete dict (не subscription_expired) ===")
        dict_ac = ctx.post(
            "/ml_autocomplete",
            json={
                "field_name": None,
                "prefix": prefix,
                "suggestions_count": count,
                "type_autocomplete": "dict_autocomplete",
            },
            timeout=60,
        )
        print_response(dict_ac)
        _assert_not_subscription_expired(dict_ac)

        print("=== POST /autocomplete_dict/complete_dict (не subscription_expired) ===")
        public_dict = ctx.post(
            "/autocomplete_dict/complete_dict",
            auth=False,
            json={"full_text": "боль в гол", "limit": 6},
        )
        print_response(public_dict)
        _assert_not_subscription_expired(public_dict)

        print("=== POST /ml_mkb_code/select (не subscription_expired) ===")
        select_resp = ctx.post(
            "/ml_mkb_code/select",
            json={
                "field_name": field_name,
                "description": description,
                "n_candidates": n_candidates,
                "selected_text": "",
                "event_type": "suggestion_selected",
                "type_autocomplete": "ml_autocomplete",
            },
        )
        print_response(select_resp)
        _assert_not_subscription_expired(select_resp)

        print("=== POST /ml_mkb_code as super_admin (не subscription_expired) ===")
        ctx.token = sa_token
        sa_mkb = ctx.post(
            "/ml_mkb_code",
            json={
                "field_name": field_name,
                "description": description,
                "n_candidates": n_candidates,
                "use_llm": True,
            },
            timeout=60,
        )
        print_response(sa_mkb)
        _assert_not_subscription_expired(sa_mkb)
    finally:
        print("=== restore clinic access_until ===")
        ctx.token = sa_token
        restore = ctx.patch(
            f"/super-admin/clinics/{clinic_id}",
            json={"access_until": restored_until, "access_type": "trial"},
        )
        print_response(restore)
        ctx.token = saved_token
        ctx.user_id = saved_user_id
        ctx.email = saved_email
        ctx.password = saved_password
        print("ctx token/email восстановлены")


def run_all(ctx: SmokeContext) -> None:
    run_autocomplete_dict(ctx)
    run_mkb_code(ctx)
    run_autocomplete(ctx)
    run_fullness(ctx)
    run_clinrec(ctx)
    run_subscription_expired(ctx)
