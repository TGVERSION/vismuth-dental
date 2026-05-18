from typing import Any

import httpx
from fastapi import HTTPException, status

from ..config import settings


def extract_ml_error_detail(response: httpx.Response) -> str | list[Any]:
    try:
        payload = response.json()
        if isinstance(payload, dict) and "detail" in payload:
            return payload["detail"]
    except (ValueError, TypeError):
        pass
    text = response.text.strip()
    return text or "ml-service error"


async def proxy_post_to_ml(path: str, body: dict, *, timeout: float = 20.0) -> dict:
    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            response = await client.post(
                f"{settings.ml_service_url}{path}",
                json=body,
            )
            response.raise_for_status()
        except httpx.TimeoutException as exc:
            raise HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail="ml-service timeout",
            ) from exc
        except httpx.HTTPStatusError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=extract_ml_error_detail(exc.response),
            ) from exc
        except httpx.HTTPError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="ml-service unavailable",
            ) from exc
    return response.json()
