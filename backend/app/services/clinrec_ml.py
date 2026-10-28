"""Контракт вызовов ml-service для клинреков / ДМС.

- Legacy check: ``POST /clinrec_checking/check`` с ``protocol_text``.
- DMS check: ``POST /check_dms`` multipart (file + mkb + appointments);
  backend скачивает PDF из S3 сам.
- Index / delete index: будущие пути (admin).
"""

from __future__ import annotations

import logging
from pathlib import PurePosixPath
from typing import Any, Optional
from uuid import UUID

from fastapi import HTTPException

from ..config import settings
from ..models.clinrec_guideline import ClinrecGuideline
from .ml_proxy import (
    MlProxyLogContext,
    proxy_delete_to_ml,
    proxy_post_multipart_to_ml,
    proxy_post_to_ml,
)
from .s3 import generate_presigned_get, get_object_bytes, head_object

logger = logging.getLogger(__name__)

# Admin index (optional; ML may not implement yet).
ML_CLINREC_INDEX_PATH = "/clinrec/index"
ML_CLINREC_INDEX_DELETE_PATH = "/clinrec/index/{guideline_id}"
# Legacy protocol check.
ML_CLINREC_CHECK_LEGACY_PATH = "/clinrec_checking/check"
# DMS appointments check (multipart).
ML_CHECK_DMS_PATH = "/check_dms"


def build_index_payload(guideline: ClinrecGuideline, *, presigned_url: str) -> dict[str, Any]:
    return {
        "guideline_id": guideline.code,
        "version": guideline.version,
        "source": {"type": "s3", "url": presigned_url},
    }


def build_legacy_check_payload(*, protocol_text: str) -> dict[str, Any]:
    return {"protocol_text": protocol_text}


def prepare_presigned_source(guideline: ClinrecGuideline) -> str:
    """head_object + short-lived GET URL (admin index)."""
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
    """Вызов ``POST /clinrec/index``. Пока ML не готов — upstream 404/502."""
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
) -> dict[str, Any]:
    """Legacy proxy: только ``protocol_text`` в ML (текущий ml-service)."""
    _ = guideline
    return await proxy_post_to_ml(
        ML_CLINREC_CHECK_LEGACY_PATH,
        build_legacy_check_payload(protocol_text=protocol_text),
        log_context=MlProxyLogContext(
            user_id=user_id,
            endpoint_name="ml_clinrec_check",
        ),
    )


async def request_check_dms(
    *,
    guideline: ClinrecGuideline,
    mkb: str,
    appointments: str,
    user_id: UUID,
) -> dict[str, Any]:
    """S3 get → multipart ``POST /check_dms`` (file + mkb + appointments)."""
    pdf_bytes = get_object_bytes(
        bucket=guideline.s3_bucket,
        key=guideline.s3_key,
    )
    filename = PurePosixPath(guideline.s3_key).name or "source.pdf"
    logger.info(
        "check_dms pdf ready s3://%s/%s bytes=%s → multipart ML %s",
        guideline.s3_bucket,
        guideline.s3_key,
        len(pdf_bytes),
        ML_CHECK_DMS_PATH,
    )
    return await proxy_post_multipart_to_ml(
        ML_CHECK_DMS_PATH,
        data={
            "mkb": mkb,
            "appointments": appointments,
        },
        files={
            "file": (filename, pdf_bytes, "application/pdf"),
        },
        timeout=settings.clinrec_dms_timeout,
        log_context=MlProxyLogContext(
            user_id=user_id,
            endpoint_name="check_dms",
        ),
    )
