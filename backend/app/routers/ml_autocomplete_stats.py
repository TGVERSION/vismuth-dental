import httpx
from fastapi import APIRouter, Depends, HTTPException, status

from ..config import settings
from ..deps import get_current_user
from ..models.service_user import ServiceUser
from ..schemas.ml_mkb_code import (
    EventAcceptedResponse,
    MlAutocompleteProxyRequest,
    MlAutocompleteProxyResponse,
    MkbCodeSelectRequest,
    MkbEventType,
)
from ..services.redis_stream import (
    build_event_payload,
    get_redis_client,
    publish_event,
)

router = APIRouter(tags=["ml_autocomplete_stats"])


async def _proxy_to_ml(path: str, body: dict) -> dict:
    async with httpx.AsyncClient(timeout=20.0) as client:
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
                detail=f"ml-service error: {exc.response.text}",
            ) from exc
        except httpx.HTTPError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="ml-service unavailable",
            ) from exc
    return response.json()


async def _publish_autocomplete_shown(
    *,
    field_name: str,
    prefix: str,
    suggestions_count: int,
    current_user: ServiceUser,
) -> None:
    redis = get_redis_client()
    try:
        event = build_event_payload(
            user_id=current_user.id,
            field_name=field_name,
            description=prefix,
            n_candidates=suggestions_count,
            selected_text=None,
            event_type=MkbEventType.autocomplete_shown,
        )
        await publish_event(redis, event)
    finally:
        await redis.aclose()


@router.post("/ml_autocomplete", response_model=MlAutocompleteProxyResponse)
async def proxy_ml_autocomplete(
    payload: MlAutocompleteProxyRequest,
    current_user: ServiceUser = Depends(get_current_user),
) -> MlAutocompleteProxyResponse:
    body = await _proxy_to_ml(
        "/autocomplete/complete",
        {
            "field": payload.field_name,
            "prefix": payload.prefix,
            "num_sequences": payload.suggestions_count,
        },
    )
    await _publish_autocomplete_shown(
        field_name=payload.field_name,
        prefix=payload.prefix,
        suggestions_count=payload.suggestions_count,
        current_user=current_user,
    )
    return MlAutocompleteProxyResponse(**body)


@router.post(
    "/ml_autocomplete_stats",
    response_model=EventAcceptedResponse,
    summary="Push Selected Field Or Selected Event",
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


