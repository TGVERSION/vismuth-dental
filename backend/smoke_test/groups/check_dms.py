"""Smoke: POST /check_dms (каталог → S3 PDF → multipart ML).

Нужен JWT. Создание guideline — только super_admin.
PDF должен уже лежать в бакете (см. scripts/clinrec/).

По умолчанию: guidelines/62/3/source.pdf (КР62).
Пока ML ещё на pdf_url (не multipart) — ожидаем 502 от upstream;
после их переделки — 200 и структура ответа PL-315.
"""

from __future__ import annotations

import uuid
from typing import Any

from _client import SmokeContext, print_response

# Объект после download_to_s3: КР id=62, revision=3.
DEFAULT_SOURCE_ID = 62
DEFAULT_VERSION = "3"
DEFAULT_MKB = "I10"
DEFAULT_APPOINTMENTS = (
    "Амлодипин 5 мг 1 раз в сутки; "
    "Денервация почечных артерий; "
    "Плазмаферез"
)

_S3_FAIL_CODES = frozenset({"s3_object_not_found", "pdf_invalid", "s3_error"})


def _require_super_admin(ctx: SmokeContext) -> bool:
    if not ctx.require_token():
        return False
    me = ctx.get("/service_user")
    if not me.ok:
        print_response(me)
        print("Не удалось прочитать /service_user — check_dms smoke пропущен.")
        return False
    role = me.json().get("role")
    if role != "super_admin":
        print(
            f"Нужна роль super_admin (сейчас role={role}) "
            "для создания guideline в каталоге."
        )
        return False
    return True


def _detail_code(resp) -> str | None:
    if not resp.headers.get("content-type", "").startswith("application/json"):
        return None
    try:
        detail = resp.json().get("detail")
    except Exception:
        return None
    if isinstance(detail, dict):
        return detail.get("code")
    return None


def _create_guideline(
    ctx: SmokeContext,
    *,
    source_id: int,
    version: str,
    mkb_prefix: str,
) -> dict[str, Any] | None:
    suffix = uuid.uuid4().hex[:8]
    code = f"smoke-dms-{suffix}"
    s3_key = f"guidelines/{source_id}/{version}/source.pdf"

    print(f"=== POST /clinrec/guidelines ({s3_key}) ===")
    resp = ctx.post(
        "/clinrec/guidelines",
        json={
            "code": code,
            "source_id": source_id,
            "title": f"Smoke DMS KR {source_id}",
            "short_title": "smoke-dms",
            "version": version,
            "s3_key": s3_key,
            "mkb_prefixes": [mkb_prefix],
        },
    )
    print_response(resp)
    if not resp.ok:
        print(
            "Создание guideline не удалось. "
            "Проверьте S3 и уникальность source_id. "
            f"Ожидаемый ключ: {s3_key}"
        )
        return None
    return resp.json()


def _resolve_pdf_ref(ctx: SmokeContext) -> tuple[int, str]:
    """Всегда 62/3, если явно не заданы оба id (не тащим старый 10/5 из ctx)."""
    if "dms_source_id" in ctx.ids and "dms_version" in ctx.ids:
        return int(ctx.ids["dms_source_id"]), str(ctx.ids["dms_version"])
    # Сброс устаревших частичных ключей из прошлых прогонов notebook
    ctx.ids.pop("dms_source_id", None)
    ctx.ids.pop("dms_version", None)
    return DEFAULT_SOURCE_ID, DEFAULT_VERSION


def run_setup_guideline(ctx: SmokeContext) -> None:
    """Создать запись каталога на существующий S3 PDF (по умолчанию 62/3)."""
    if not _require_super_admin(ctx):
        return

    source_id, version = _resolve_pdf_ref(ctx)
    mkb_prefix = str(ctx.ids.get("dms_mkb_prefix", DEFAULT_MKB)).upper()
    print(f"PDF ref: guidelines/{source_id}/{version}/source.pdf")

    body = _create_guideline(
        ctx,
        source_id=source_id,
        version=version,
        mkb_prefix=mkb_prefix,
    )
    if body is None:
        return

    ctx.ids["dms_guideline_id"] = body["id"]
    ctx.ids["dms_guideline_code"] = body["code"]
    ctx.ids["dms_mkb"] = f"{mkb_prefix} Эссенциальная гипертензия"
    print("guideline id=", body["id"], "status=", body.get("status"))


def run_check_dms(ctx: SmokeContext) -> None:
    """Вызов POST /check_dms после setup (или с готовым mkb в ids)."""
    if not ctx.require_token():
        return

    if not ctx.ids.get("dms_guideline_id") and not ctx.ids.get("dms_skip_setup"):
        run_setup_guideline(ctx)

    mkb = ctx.ids.get("dms_mkb") or f"{DEFAULT_MKB} Эссенциальная гипертензия"
    appointments = ctx.ids.get("dms_appointments") or DEFAULT_APPOINTMENTS
    timeout = int(ctx.ids.get("dms_timeout", 600))

    print("=== POST /check_dms ===")
    resp = ctx.post(
        "/check_dms",
        json={"mkb": mkb, "appointments": appointments},
        timeout=timeout,
    )
    print_response(resp)

    if resp.status_code == 422:
        detail = (
            resp.json().get("detail")
            if resp.headers.get("content-type", "").startswith("application/json")
            else None
        )
        print(
            "422 — resolve/S3. detail=",
            detail,
            "(нет guideline с нужным mkb_prefix или PDF отсутствует в S3)",
        )
        return

    if resp.status_code in {502, 504}:
        print(
            "OK: PDF прочитан из S3 и отправлен в ML multipart "
            f"(file + mkb + appointments). Upstream ответил {resp.status_code} — "
            "ожидаемо, пока на ml-service нет /check_dms или ещё json/pdf_url."
        )
        return

    assert resp.ok, resp.text
    data = resp.json()
    assert isinstance(data.get("appointments"), list), "appointments must be list"
    assert isinstance(data.get("fragments"), list), "fragments must be list"
    joined = "".join(seg.get("text", "") for seg in data["appointments"])
    assert joined == appointments, "склейка сегментов должна совпадать с appointments"
    for seg in data["appointments"]:
        assert "text" in seg and "unnecessary" in seg
        assert isinstance(seg["unnecessary"], bool)
    if data.get("guideline_code"):
        print("guideline_code=", data["guideline_code"])
    print("check_dms OK")


def run_prove_pdf_file_sent(ctx: SmokeContext) -> None:
    """Доказать, что backend реально читает PDF из S3 и доходит до ML.

    1) Guideline на несуществующий ключ → 422 s3_object_not_found (get_object вызывается).
    2) Guideline на 62/3 → не S3-ошибка, а 200 или 502/504 (файл ушёл в multipart proxy).
    """
    if not _require_super_admin(ctx):
        return

    mkb_prefix = f"Z{uuid.uuid4().hex[:4].upper()}"
    timeout = int(ctx.ids.get("dms_timeout", 600))
    created_ids: list[str] = []

    try:
        # --- negative: нет объекта в S3 ---
        missing_source = int(ctx.ids.get("dms_missing_source_id", 999001))
        missing_version = "1"
        missing = _create_guideline(
            ctx,
            source_id=missing_source,
            version=missing_version,
            mkb_prefix=mkb_prefix,
        )
        if missing is None:
            return
        created_ids.append(missing["id"])

        print("=== POST /check_dms (ожидаем 422 s3_object_not_found) ===")
        bad = ctx.post(
            "/check_dms",
            json={
                "mkb": f"{mkb_prefix} missing pdf",
                "appointments": DEFAULT_APPOINTMENTS,
            },
            timeout=timeout,
        )
        print_response(bad)
        assert bad.status_code == 422, bad.text
        assert _detail_code(bad) == "s3_object_not_found", (
            f"ожидали s3_object_not_found, получили {_detail_code(bad)}"
        )
        print("OK: без PDF в S3 запрос падает на get_object (файл не подставляется «из воздуха»).")

        # --- positive: реальный PDF 62/3 ---
        real_prefix = f"Y{uuid.uuid4().hex[:4].upper()}"
        source_id, version = _resolve_pdf_ref(ctx)
        real = _create_guideline(
            ctx,
            source_id=source_id,
            version=version,
            mkb_prefix=real_prefix,
        )
        if real is None:
            print(
                f"Не удалось создать guideline на guidelines/{source_id}/{version}/source.pdf — "
                "проверьте бакет."
            )
            return
        created_ids.append(real["id"])

        print(
            f"=== POST /check_dms (реальный PDF guidelines/{source_id}/{version}/source.pdf) ==="
        )
        good = ctx.post(
            "/check_dms",
            json={
                "mkb": f"{real_prefix} real pdf",
                "appointments": DEFAULT_APPOINTMENTS,
            },
            timeout=timeout,
        )
        print_response(good)

        code = _detail_code(good)
        assert good.status_code != 422 or code not in _S3_FAIL_CODES, (
            f"не должны упасть на S3 при наличии PDF: status={good.status_code} code={code}"
        )
        assert good.status_code in {200, 502, 504}, (
            f"ожидали 200 (ML ok) или 502/504 (ML ещё без multipart), "
            f"получили {good.status_code}"
        )

        if good.status_code == 200:
            data = good.json()
            assert isinstance(data.get("appointments"), list)
            print(
                f"OK: файл guidelines/{source_id}/{version}/source.pdf "
                "прочитан из S3, отправлен multipart, ML вернул 200."
            )
        else:
            print(
                f"OK: файл guidelines/{source_id}/{version}/source.pdf "
                f"прочитан из S3 и отправлен в ML multipart "
                f"(upstream {good.status_code} — эндпоинта/контракта на ML пока нет)."
            )
    finally:
        for gid in created_ids:
            print(f"=== DELETE /clinrec/guidelines/{gid} (prove cleanup) ===")
            del_resp = ctx.delete(f"/clinrec/guidelines/{gid}")
            print("Status:", del_resp.status_code)


def run_cleanup_guideline(ctx: SmokeContext) -> None:
    """Удалить smoke-guideline (super_admin)."""
    guideline_id = ctx.ids.get("dms_guideline_id")
    if not guideline_id:
        print("=== cleanup skip (нет dms_guideline_id) ===")
        return
    if not _require_super_admin(ctx):
        return

    print(f"=== DELETE /clinrec/guidelines/{guideline_id} ===")
    resp = ctx.delete(f"/clinrec/guidelines/{guideline_id}")
    print("Status:", resp.status_code)
    if resp.status_code not in {204, 404}:
        print_response(resp)
    else:
        print("guideline удалён")
        ctx.ids.pop("dms_guideline_id", None)
        ctx.ids.pop("dms_guideline_code", None)


def run_all(ctx: SmokeContext, *, cleanup: bool = True) -> None:
    """setup → check_dms → prove pdf sent → optional cleanup основного guideline."""
    # Не тащить source_id=10 из старых ячеек notebook
    for key in (
        "dms_source_id",
        "dms_version",
        "dms_guideline_id",
        "dms_guideline_code",
        "dms_mkb",
    ):
        ctx.ids.pop(key, None)
    print(
        f"check_dms defaults: guidelines/{DEFAULT_SOURCE_ID}/{DEFAULT_VERSION}/source.pdf"
    )
    run_setup_guideline(ctx)
    run_check_dms(ctx)
    run_prove_pdf_file_sent(ctx)
    if cleanup:
        run_cleanup_guideline(ctx)
    print("check_dms.run_all done")
