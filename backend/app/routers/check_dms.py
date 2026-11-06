from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..deps import require_clinical_user
from ..models.service_user import ServiceUser
from ..schemas.check_dms import CheckDmsRequest, CheckDmsResponse
from ..services.clinrec_guidelines import resolve_dms_guideline
from ..services.clinrec_ml import request_check_dms
from ..services.questionnaire_limits import ensure_user_clinic_subscription_active

router = APIRouter(tags=["check_dms"])


@router.post(
    "/check_dms",
    response_model=CheckDmsResponse,
    summary="Проверка назначений ДМС по клиническим рекомендациям",
)
async def check_dms(
    payload: CheckDmsRequest,
    current_user: ServiceUser = Depends(require_clinical_user),
    db: AsyncSession = Depends(get_db),
) -> CheckDmsResponse:
    """Resolve КР по МКБ → скачать PDF из S3 → multipart в ML ``/check_dms``."""
    await ensure_user_clinic_subscription_active(db, current_user)

    try:
        guideline = await resolve_dms_guideline(db, mkb=payload.mkb)
    except HTTPException as exc:
        if (
            isinstance(exc.detail, dict)
            and exc.detail.get("code") == "guideline_not_found"
        ):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "code": "guideline_not_found",
                    "message": exc.detail.get("message", "Guideline not found"),
                },
            ) from exc
        raise

    body = await request_check_dms(
        guideline=guideline,
        mkb=payload.mkb,
        appointments=payload.appointments,
        user_id=current_user.id,
    )

    response = CheckDmsResponse(**body)
    response.guideline_code = guideline.code
    response.guideline_title = guideline.title
    return response
