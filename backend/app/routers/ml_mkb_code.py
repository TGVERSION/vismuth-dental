import httpx
from fastapi import APIRouter, Depends, HTTPException, status

from ..config import settings
from ..deps import get_current_user
from ..models.service_user import ServiceUser
from ..schemas.ml_mkb_code import (
    EventAcceptedResponse,
    MkbCodeProxyRequest,
    MkbCodeProxyResponse,
    MkbCodeSelectRequest,
    MkbEventType,
)
from ..services.redis_stream import build_event_payload, get_redis_client, publish_event

router = APIRouter(prefix="/ml_mkb_code", tags=["ml_mkb_code"])


@router.post("", response_model=MkbCodeProxyResponse)
async def proxy_mkb_code(
    payload: MkbCodeProxyRequest,
    current_user: ServiceUser = Depends(get_current_user),
) -> MkbCodeProxyResponse:
    async with httpx.AsyncClient(timeout=20.0) as client:
        try:
            response = await client.post(
                f"{settings.ml_service_url}/mkb_code",
                json={
                    "description": payload.description,
                    "n_candidates": payload.n_candidates,
                    "use_llm": payload.use_llm,
                },
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
                detail=f"ml-service error: {exc.response.text}",
            ) from exc
        except httpx.HTTPError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="ml-service unavailable",
            ) from exc

    body = response.json()

    redis = get_redis_client()
    try:
        event = build_event_payload(
            user_id=current_user.id,
            field_name=payload.field_name,
            description=payload.description,
            n_candidates=payload.n_candidates,
            selected_text=None,
            event_type=MkbEventType.autocomplete_shown,
        )
        await publish_event(redis, event)
    finally:
        await redis.aclose()

    return MkbCodeProxyResponse(**body)


@router.post(
    "/select",
    response_model=EventAcceptedResponse,
    include_in_schema=False,
)
async def push_selected_event(
    payload: MkbCodeSelectRequest,
    current_user: ServiceUser = Depends(get_current_user),
) -> EventAcceptedResponse:
    redis = get_redis_client()
    try:
        event = build_event_payload(
            user_id=current_user.id,
            field_name=payload.field_name,
            description=payload.description,
            n_candidates=payload.n_candidates,
            selected_text=payload.selected_text,
            event_type=payload.event_type,
        )
        await publish_event(redis, event)
    finally:
        await redis.aclose()
    return EventAcceptedResponse()
