from fastapi import APIRouter, Depends

from ..deps import get_current_user
from ..models.service_user import ServiceUser
from ..schemas.service_user import ServiceUserMeResponse

router = APIRouter(tags=["service_user"])


@router.get("/service_user", response_model=ServiceUserMeResponse)
async def get_service_user_me(
    current_user: ServiceUser = Depends(get_current_user),
) -> ServiceUserMeResponse:
    return ServiceUserMeResponse.model_validate(current_user)
