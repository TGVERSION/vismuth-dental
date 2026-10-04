from fastapi import APIRouter, Depends

from app.schemas import CollectFormAnswer, CollectFormRequest
from app.services.collect_form import CollectFormService
from app.dependencies import get_collect_form_service

router = APIRouter(prefix="/collect_form", tags=["collect_form"])


@router.post("", response_model=CollectFormAnswer)
async def collect_form(
    request: CollectFormRequest,
    service: CollectFormService = Depends(get_collect_form_service),
) -> CollectFormAnswer:
    return await service.run(request)
