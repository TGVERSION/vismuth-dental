import httpx
from fastapi import APIRouter, Depends, HTTPException, status

from ..config import settings
from ..deps import get_current_user
from ..models.service_user import ServiceUser
from ..schemas.ml_clinrec_check import MlClinrecCheckRequest, MlClinrecCheckResponse

router = APIRouter(tags=["ml_clinrec_check"])


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


@router.post("/ml_clinrec_check", response_model=MlClinrecCheckResponse)
async def proxy_ml_clinrec_check(
    payload: MlClinrecCheckRequest,
    _current_user: ServiceUser = Depends(get_current_user),
) -> MlClinrecCheckResponse:
    body = await _proxy_to_ml(
        "/clinrec_checking/check",
        {
            "protocol_text": payload.protocol_text,
        },
    )
    return MlClinrecCheckResponse(**body)
