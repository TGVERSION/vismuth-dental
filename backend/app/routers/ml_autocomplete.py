import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..db import get_db
from ..deps import get_current_user
from ..models.service_user import ServiceUser
from ..routers.ml_autocomplete_dict import autocomplete_mixed
from ..schemas.ml_mkb_code import (
    AutocompleteType,
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

router = APIRouter(tags=["ml_autocomplete"])


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
    field_name: str | None,
    prefix: str,
    suggestions_count: int,
    type_autocomplete: AutocompleteType,
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
            type_autocomplete=type_autocomplete,
        )
        await publish_event(redis, event)
    finally:
        await redis.aclose()


@router.post("/ml_autocomplete", response_model=MlAutocompleteProxyResponse)
async def proxy_ml_autocomplete(
    payload: MlAutocompleteProxyRequest,
    current_user: ServiceUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MlAutocompleteProxyResponse:
    if payload.type_autocomplete == AutocompleteType.ml_autocomplete:
        if payload.field_name is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="field_name is required for ml_autocomplete",
            )
        body = await _proxy_to_ml(
            "/autocomplete/complete",
            {
                "field": payload.field_name,
                "prefix": payload.prefix,
                "num_sequences": payload.suggestions_count,
            },
        )
    else:
        suggestions = await autocomplete_mixed(
            db,
            full_text=payload.prefix,
            limit=payload.suggestions_count,
        )
        body = {"suggestions": suggestions}

    await _publish_autocomplete_shown(
        field_name=payload.field_name,
        prefix=payload.prefix,
        suggestions_count=payload.suggestions_count,
        type_autocomplete=payload.type_autocomplete,
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
            type_autocomplete=payload.type_autocomplete,
        )
        await publish_event(redis, event)
    finally:
        await redis.aclose()
    return EventAcceptedResponse()

