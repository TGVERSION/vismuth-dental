import httpx
from fastapi import APIRouter, Depends, HTTPException, status

from ..config import settings
from ..deps import get_current_user
from ..models.service_user import ServiceUser
from ..schemas.ml_fullness_complaints import (
    MlFullnessComplaintsRequest,
    MlFullnessComplaintsResponse,
)
from ..services.redis_stream import (
    build_fullness_complaints_payload,
    get_redis_client,
    publish_event,
)

router = APIRouter(tags=["ml_fullness"])


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


@router.post(
    "/ml_fullness_complaints",
    response_model=MlFullnessComplaintsResponse,
)
async def proxy_ml_fullness_complaints(
    payload: MlFullnessComplaintsRequest,
    current_user: ServiceUser = Depends(get_current_user),
) -> MlFullnessComplaintsResponse:
    body = await _proxy_to_ml(
        "/fullness/complaints",
        {
            "example_prompt": payload.example_prompt,
        },
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
