import json
import logging
from dataclasses import dataclass
from typing import Any
from uuid import UUID

import httpx
from fastapi import HTTPException, status

from ..config import settings
from .redis_stream import (
    build_ml_response_log_payload,
    get_redis_client,
    publish_event,
)

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class MlProxyLogContext:
    user_id: UUID
    endpoint_name: str


def extract_ml_error_detail(response: httpx.Response) -> str | list[Any]:
    try:
        payload = response.json()
        if isinstance(payload, dict) and "detail" in payload:
            return payload["detail"]
    except (ValueError, TypeError):
        pass
    text = response.text.strip()
    return text or "ml-service error"


def _extract_response_payload(response: httpx.Response) -> dict | list | None:
    try:
        payload = response.json()
    except (ValueError, TypeError):
        return None
    return payload if isinstance(payload, (dict, list)) else None


def _normalize_response_comment(detail: str | list[Any] | None) -> str | None:
    if detail is None:
        return None
    if isinstance(detail, str):
        text = detail.strip()
        return text or None
    return json.dumps(detail, ensure_ascii=False)


def _extract_success_comment(payload: Any) -> str | None:
    if not isinstance(payload, dict):
        return None
    return _normalize_response_comment(payload.get("error"))


async def _publish_ml_response_log(
    *,
    log_context: MlProxyLogContext | None,
    ml_path: str,
    response_status: str,
    http_status_code: int | None = None,
    response_comment: str | None = None,
    response_payload: dict | list | None = None,
) -> None:
    if log_context is None:
        return

    redis = None
    try:
        redis = get_redis_client()
        event = build_ml_response_log_payload(
            user_id=log_context.user_id,
            endpoint_name=log_context.endpoint_name,
            ml_path=ml_path,
            http_status_code=http_status_code,
            response_status=response_status,
            response_comment=response_comment,
            response_payload=response_payload,
        )
        await publish_event(redis, event)
    except Exception:
        logger.exception(
            "Failed to publish ML response log for %s",
            log_context.endpoint_name,
        )
    finally:
        if redis is not None:
            await redis.aclose()


async def _proxy_request_to_ml(
    method: str,
    path: str,
    *,
    body: dict | None = None,
    timeout: float = 180.0,
    log_context: MlProxyLogContext | None = None,
) -> dict:
    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            response = await client.request(
                method,
                f"{settings.ml_service_url}{path}",
                json=body,
            )
            response.raise_for_status()
        except httpx.TimeoutException as exc:
            await _publish_ml_response_log(
                log_context=log_context,
                ml_path=path,
                response_status="timeout",
                response_comment="ml-service timeout",
            )
            raise HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail="ml-service timeout",
            ) from exc
        except httpx.HTTPStatusError as exc:
            detail = extract_ml_error_detail(exc.response)
            await _publish_ml_response_log(
                log_context=log_context,
                ml_path=path,
                http_status_code=exc.response.status_code,
                response_status="http_error",
                response_comment=_normalize_response_comment(detail),
                response_payload=_extract_response_payload(exc.response),
            )
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=detail,
            ) from exc
        except httpx.HTTPError as exc:
            await _publish_ml_response_log(
                log_context=log_context,
                ml_path=path,
                response_status="unavailable",
                response_comment="ml-service unavailable",
            )
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="ml-service unavailable",
            ) from exc

    if response.status_code == status.HTTP_204_NO_CONTENT or not response.content:
        await _publish_ml_response_log(
            log_context=log_context,
            ml_path=path,
            http_status_code=response.status_code,
            response_status="success",
        )
        return {}

    try:
        response_body = response.json()
    except (ValueError, TypeError):
        await _publish_ml_response_log(
            log_context=log_context,
            ml_path=path,
            http_status_code=response.status_code,
            response_status="success",
            response_comment="invalid JSON response",
        )
        raise

    await _publish_ml_response_log(
        log_context=log_context,
        ml_path=path,
        http_status_code=response.status_code,
        response_status="success",
        response_comment=_extract_success_comment(response_body),
        response_payload=(
            response_body if isinstance(response_body, (dict, list)) else None
        ),
    )
    return response_body if isinstance(response_body, dict) else {"data": response_body}


async def proxy_post_to_ml(
    path: str,
    body: dict,
    *,
    timeout: float = 180.0,
    log_context: MlProxyLogContext | None = None,
) -> dict:
    return await _proxy_request_to_ml(
        "POST",
        path,
        body=body,
        timeout=timeout,
        log_context=log_context,
    )


async def proxy_delete_to_ml(
    path: str,
    *,
    timeout: float = 60.0,
    log_context: MlProxyLogContext | None = None,
) -> dict:
    return await _proxy_request_to_ml(
        "DELETE",
        path,
        timeout=timeout,
        log_context=log_context,
    )
