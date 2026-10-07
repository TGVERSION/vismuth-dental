from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..deps import get_current_user
from ..models.service_user import ServiceUser
from ..schemas.ml_fullness_complaints import (
    MlFullnessComplaintsRequest,
    MlFullnessComplaintsResponse,
)
from ..services.ml_proxy import MlProxyLogContext, proxy_post_to_ml
from ..services.questionnaire_limits import ensure_user_clinic_subscription_active
from ..services.redis_stream import (
    build_fullness_complaints_payload,
    get_redis_client,
    publish_event,
)

router = APIRouter(tags=["ml_fullness"])


@router.post(
    "/ml_fullness_complaints",
    response_model=MlFullnessComplaintsResponse,
    summary="Оценка полноты жалоб (ML-proxy)",
)
async def proxy_ml_fullness_complaints(
    payload: MlFullnessComplaintsRequest,
    current_user: ServiceUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MlFullnessComplaintsResponse:
    await ensure_user_clinic_subscription_active(db, current_user)
    body = await proxy_post_to_ml(
        "/fullness/complaints",
        {
            "example_prompt": payload.example_prompt,
        },
        log_context=MlProxyLogContext(
            user_id=current_user.id,
            endpoint_name="ml_fullness_complaints",
        ),
    )

    redis = get_redis_client()
    try:
        event = build_fullness_complaints_payload(
            user_id=current_user.id,
            status=body["status"],
            color=body["color"],
            analysis=body["analysis"],
            suggested_text=body["suggested_text"],
        )
        await publish_event(redis, event)
    finally:
        await redis.aclose()

    return MlFullnessComplaintsResponse(**body)
