from typing import Annotated

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..deps import require_clinical_user
from ..models.service_user import ServiceUser
from ..schemas.auth import MessageResponse
from ..schemas.ml_mkb_code import (
    EventAcceptedResponse,
    MkbCodeProxyRequest,
    MkbCodeProxyResponse,
    MkbCodeSelectRequest,
    MkbEventType,
    MkbServiceErrorResponse,
    MkbSubscriptionExpiredResponse,
)
from ..services.ml_proxy import MlProxyLogContext, proxy_post_to_ml
from ..services.questionnaire_limits import ensure_user_clinic_subscription_active
from ..services.redis_stream import build_event_payload, get_redis_client, publish_event

router = APIRouter(prefix="/ml_mkb_code", tags=["ml_mkb_code"])

MKB_NO_MATCH_EXAMPLE = MkbCodeProxyResponse(
    extracted_diagnosis="",
    candidates=[],
    best_code=None,
    best_name=None,
).model_dump(mode="json")


@router.post(
    "",
    response_model=MkbCodeProxyResponse,
    summary="Подбор кода МКБ (ML-proxy)",
    description=(
        "Подбирает ближайшие по смыслу диагнозы. Порог сходства не применяется. "
        "Истёкшая подписка любой клиники, в которой у пользователя есть активное "
        "членство, блокирует подбор. При отсутствии активных членств проверка "
        "подписки пропускается."
    ),
    responses={
        200: {
            "description": "Подбор выполнен. Все поля присутствуют в ответе.",
            "content": {"application/json": {"examples": {
                "match": {"value": {
                    "extracted_diagnosis": "Острый гастрит",
                    "candidates": [{
                        "code": "K29.1", "name": "Другие острые гастриты",
                        "distance": 0.25, "similarity": 0.75,
                    }],
                    "best_code": "K29.1",
                    "best_name": "Другие острые гастриты",
                }},
                "no_match": {"value": MKB_NO_MATCH_EXAMPLE},
            }}},
        },
        401: {"model": MessageResponse, "description": "Ошибка аутентификации Bearer."},
        403: {"model": MessageResponse, "description": "Доступ к врачебному инструменту запрещён."},
        500: {
            "description": "Внутренняя ошибка приложения, например сбой записи события.",
            "content": {"text/plain": {"schema": {"type": "string"}}},
        },
        502: {"model": MkbServiceErrorResponse, "description": "Ошибка связи или некорректный ответ ML-сервиса."},
        503: {"model": MkbSubscriptionExpiredResponse, "description": "Истекла подписка клиники."},
        504: {
            "model": MessageResponse,
            "description": "Истекло время ожидания ML-сервиса.",
            "content": {"application/json": {"example": {"detail": "ml-service timeout"}}},
        },
    },
)
async def proxy_mkb_code(
    payload: Annotated[MkbCodeProxyRequest, Body(openapi_examples={
        "main_diagnosis": {"value": {
            "field_name": "main_diagnosis",
            "description": "Острый гастрит",
            "n_candidates": 3,
            "use_llm": False,
        }},
    })],
    current_user: ServiceUser = Depends(require_clinical_user),
    db: AsyncSession = Depends(get_db),
) -> MkbCodeProxyResponse:
    await ensure_user_clinic_subscription_active(db, current_user)
    try:
        body = await proxy_post_to_ml(
            "/mkb_code",
            {
                "description": payload.description,
                "n_candidates": payload.n_candidates,
                "use_llm": payload.use_llm,
            },
            log_context=MlProxyLogContext(
                user_id=current_user.id,
                endpoint_name="ml_mkb_code",
            ),
        )
        result = MkbCodeProxyResponse.model_validate(body)
    except ValueError as exc:
        raise HTTPException(status_code=502, detail="Invalid ml-service response") from exc

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

    return result


@router.post(
    "/select",
    response_model=EventAcceptedResponse,
    include_in_schema=False,
)
async def push_selected_event(
    payload: MkbCodeSelectRequest,
    current_user: ServiceUser = Depends(require_clinical_user),
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
