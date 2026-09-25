from fastapi import APIRouter, Depends

from app.schemas import ChatAnswer, ChatMessages
from app.services.collect_form import CollectFormService
from app.dependencies import get_collect_form_service

router = APIRouter(prefix="/collect_form", tags=["collect_form"])


@router.post("", response_model=ChatAnswer)
async def collect_form(
    request: ChatMessages,
    service: CollectFormService = Depends(get_collect_form_service),
) -> ChatAnswer:
    return service.run(request)
