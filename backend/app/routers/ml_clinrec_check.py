from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..deps import get_current_user
from ..models.clinrec_guideline import ClinrecGuideline
from ..models.service_user import ServiceUser
from ..schemas.ml_clinrec_check import MlClinrecCheckRequest, MlClinrecCheckResponse
from ..services.clinrec_guidelines import (
    get_guideline_by_code,
    resolve_active_guideline,
)
from ..services.clinrec_ml import request_check
from ..services.questionnaire_limits import ensure_user_clinic_subscription_active

router = APIRouter(tags=["ml_clinrec_check"])


async def _resolve_guideline_for_check(
    db: AsyncSession,
    payload: MlClinrecCheckRequest,
) -> Optional[ClinrecGuideline]:
    if payload.guideline_code:
        guideline = await get_guideline_by_code(db, payload.guideline_code.strip())
        if guideline is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "code": "guideline_not_found",
                    "message": f"Guideline '{payload.guideline_code}' not found",
                },
            )
        if guideline.status != "active":
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "code": "guideline_not_active",
                    "message": (
                        f"Guideline '{guideline.code}' has status "
                        f"'{guideline.status}', expected 'active'"
                    ),
                },
            )
        return guideline

    if payload.mkb or payload.main_diagnosis:
        try:
            return await resolve_active_guideline(
                db,
                mkb=payload.mkb,
                diagnosis=payload.main_diagnosis,
            )
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

    return None


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
    """Resolve каталога + proxy в ML.

    Сейчас в ML уходит только ``protocol_text`` (legacy). Когда ml-service
    примет guideline+presigned — включить ``use_guideline_source=True`` в
    ``request_check`` ([services/clinrec_ml.py](../services/clinrec_ml.py)).
    """
    await ensure_user_clinic_subscription_active(db, current_user)

    guideline = await _resolve_guideline_for_check(db, payload)

    body = await request_check(
        protocol_text=payload.protocol_text,
        guideline=guideline,
        user_id=current_user.id,
        use_guideline_source=False,
    )

    response = MlClinrecCheckResponse(**body)
    if guideline is not None:
        response.guideline_code = guideline.code
        response.guideline_title = guideline.title
    return response
