from fastapi import APIRouter, Depends

from ..deps import get_current_user
from ..models.service_user import ServiceUser
from ..schemas.ml_clinrec_check import MlClinrecCheckRequest, MlClinrecCheckResponse
from ..services.ml_proxy import proxy_post_to_ml

router = APIRouter(tags=["ml_clinrec_check"])


@router.post("/ml_clinrec_check", response_model=MlClinrecCheckResponse)
async def proxy_ml_clinrec_check(
    payload: MlClinrecCheckRequest,
    _current_user: ServiceUser = Depends(get_current_user),
) -> MlClinrecCheckResponse:
    body = await proxy_post_to_ml(
        "/clinrec_checking/check",
        {
            "protocol_text": payload.protocol_text,
        },
    )
    return MlClinrecCheckResponse(**body)
