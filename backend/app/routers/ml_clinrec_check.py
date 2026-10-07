from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..deps import get_current_user
from ..models.service_user import ServiceUser
from ..schemas.ml_clinrec_check import MlClinrecCheckRequest, MlClinrecCheckResponse
from ..services.ml_proxy import MlProxyLogContext, proxy_post_to_ml
from ..services.questionnaire_limits import ensure_user_clinic_subscription_active

router = APIRouter(tags=["ml_clinrec_check"])


@router.post(
    "/ml_clinrec_check",
    response_model=MlClinrecCheckResponse,
    summary="Проверка по клиническим рекомендациям (ML-proxy)",
)
async def proxy_ml_clinrec_check(
    payload: MlClinrecCheckRequest,
    current_user: ServiceUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MlClinrecCheckResponse:
    await ensure_user_clinic_subscription_active(db, current_user)
    body = await proxy_post_to_ml(
        "/clinrec_checking/check",
        {
            "protocol_text": payload.protocol_text,
        },
        log_context=MlProxyLogContext(
            user_id=current_user.id,
            endpoint_name="ml_clinrec_check",
        ),
    )
    return MlClinrecCheckResponse(**body)
