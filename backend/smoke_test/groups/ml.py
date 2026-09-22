from __future__ import annotations

from _client import SmokeContext, print_response


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


def run_all(ctx: SmokeContext) -> None:
    run_autocomplete_dict(ctx)
    run_mkb_code(ctx)
    run_autocomplete(ctx)
    run_fullness(ctx)
    run_clinrec(ctx)
