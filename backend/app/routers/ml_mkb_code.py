from fastapi import APIRouter, Depends

from ..deps import get_current_user
from ..models.service_user import ServiceUser
from ..schemas.ml_mkb_code import (
    EventAcceptedResponse,
    MkbCodeProxyRequest,
    MkbCodeProxyResponse,
    MkbCodeSelectRequest,
    MkbEventType,
)
from ..services.ml_proxy import proxy_post_to_ml
from ..services.redis_stream import build_event_payload, get_redis_client, publish_event

router = APIRouter(prefix="/ml_mkb_code", tags=["ml_mkb_code"])


@router.post("", response_model=MkbCodeProxyResponse)
async def proxy_mkb_code(
    payload: MkbCodeProxyRequest,
    current_user: ServiceUser = Depends(get_current_user),
) -> MkbCodeProxyResponse:
    body = await proxy_post_to_ml(
        "/mkb_code",
        {
            "description": payload.description,
            "n_candidates": payload.n_candidates,
            "use_llm": payload.use_llm,
        },
    )

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
