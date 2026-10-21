"""Контракт вызовов ml-service для клинреков.

ML-эндпоинты index / расширенный check ещё не реализованы на стороне ml-service.
Здесь зафиксированы пути и тела запросов, чтобы подключить их одной правкой,
когда контракт появится.

Пока:
- check идёт в legacy ``POST /clinrec_checking/check`` только с ``protocol_text``;
- index / delete index вызывают будущие пути (будут 502, пока ML не готов).
"""

from __future__ import annotations

from typing import Any, Optional
from uuid import UUID

from fastapi import HTTPException

from ..config import settings
from ..models.clinrec_guideline import ClinrecGuideline
from .ml_proxy import MlProxyLogContext, proxy_delete_to_ml, proxy_post_to_ml
from .s3 import generate_presigned_get, head_object

# Будущие пути ml-service (ещё не существуют).
ML_CLINREC_INDEX_PATH = "/clinrec/index"
ML_CLINREC_INDEX_DELETE_PATH = "/clinrec/index/{guideline_id}"
# Legacy check — единственный рабочий путь сейчас.
ML_CLINREC_CHECK_LEGACY_PATH = "/clinrec_checking/check"
# Целевой check с guideline + source (когда ML примет контракт).
ML_CLINREC_CHECK_PATH = "/clinrec_checking/check"


def build_index_payload(guideline: ClinrecGuideline, *, presigned_url: str) -> dict[str, Any]:
    return {
        "guideline_id": guideline.code,
        "version": guideline.version,
        "source": {"type": "s3", "url": presigned_url},
    }


def build_check_payload_with_guideline(
    *,
    protocol_text: str,
    guideline: ClinrecGuideline,
    presigned_url: str,
) -> dict[str, Any]:
    """Целовое тело для будущего ML check (файл не в body — только presigned GET)."""
    return {
        "protocol_text": protocol_text,
        "guideline": {
            "code": guideline.code,
            "version": guideline.version,
            "title": guideline.title,
            "source": {"type": "s3", "url": presigned_url},
        },
    }


def build_legacy_check_payload(*, protocol_text: str) -> dict[str, Any]:
    return {"protocol_text": protocol_text}


def prepare_presigned_source(guideline: ClinrecGuideline) -> str:
    """head_object + short-lived GET URL для ML."""
    head_object(bucket=guideline.s3_bucket, key=guideline.s3_key)
    return generate_presigned_get(
        bucket=guideline.s3_bucket,
        key=guideline.s3_key,
    )


async def request_index(
    guideline: ClinrecGuideline,
    *,
    user_id: UUID,
) -> dict[str, Any]:
    """Вызов будущего ``POST /clinrec/index``. Пока ML не готов — upstream 404/502."""
    presigned_url = prepare_presigned_source(guideline)
    return await proxy_post_to_ml(
        ML_CLINREC_INDEX_PATH,
        build_index_payload(guideline, presigned_url=presigned_url),
        timeout=settings.clinrec_index_timeout,
        log_context=MlProxyLogContext(
            user_id=user_id,
            endpoint_name="clinrec_index",
        ),
    )


async def request_delete_index(
    guideline_code: str,
    *,
    user_id: UUID,
) -> None:
    """Best-effort удаление индекса. Пока эндпоинта нет — молча игнорируем ошибки."""
    path = ML_CLINREC_INDEX_DELETE_PATH.format(guideline_id=guideline_code)
    try:
        await proxy_delete_to_ml(
            path,
            log_context=MlProxyLogContext(
                user_id=user_id,
                endpoint_name="clinrec_index_delete",
            ),
        )
    except HTTPException:
        pass


async def request_check(
    *,
    protocol_text: str,
    guideline: Optional[ClinrecGuideline],
    user_id: UUID,
    use_guideline_source: bool = False,
) -> dict[str, Any]:
    """Прокси check в ML.

    ``use_guideline_source=False`` (default): legacy body — работает с текущим ml-service.
    ``use_guideline_source=True``: целевой body с guideline+presigned (включать, когда ML готов).
    """
    if use_guideline_source and guideline is not None:
        presigned_url = prepare_presigned_source(guideline)
        body = build_check_payload_with_guideline(
            protocol_text=protocol_text,
            guideline=guideline,
            presigned_url=presigned_url,
        )
        path = ML_CLINREC_CHECK_PATH
    else:
        body = build_legacy_check_payload(protocol_text=protocol_text)
        path = ML_CLINREC_CHECK_LEGACY_PATH

    return await proxy_post_to_ml(
        path,
        body,
        log_context=MlProxyLogContext(
            user_id=user_id,
            endpoint_name="ml_clinrec_check",
        ),
    )
