from fastapi import APIRouter, Depends, HTTPException

from app.dependencies.gastro_clarify import get_gastro_clarify_service
from app.schemas.gastro_clarify import GastroClarifyAnswer, GastroClarifyRequest
from app.services.gastro_clarify import GastroClarifyService

router = APIRouter(prefix="/gastro_clarify", tags=["gastro_clarify"])


@router.post("", response_model=GastroClarifyAnswer)
async def gastro_clarify(request: GastroClarifyRequest, service: GastroClarifyService = Depends(get_gastro_clarify_service)) -> GastroClarifyAnswer:
    try:
        return await service.run(request)
    except Exception as exc:
        # Исключение модели может включать исходные ответы; не логируем его.
        raise HTTPException(status_code=502, detail="Gastro clarification model failed") from exc
