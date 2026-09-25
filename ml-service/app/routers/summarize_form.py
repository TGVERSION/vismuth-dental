from fastapi import APIRouter, Depends

from app.schemas import ChatMessages, PatientFormSummary
from app.services.summarize_form import SummarizeFormService
from app.dependencies import get_summarize_form_service

router = APIRouter(prefix="/summarize_form", tags=["summarize_form"])


@router.post("", response_model=PatientFormSummary)
async def summarize_form(
    request: ChatMessages,
    service: SummarizeFormService = Depends(get_summarize_form_service),
) -> PatientFormSummary:
    return service.run(request)
