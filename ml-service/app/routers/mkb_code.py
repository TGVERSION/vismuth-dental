from fastapi import APIRouter, HTTPException

from app.schemas import MKBRequest, MKBResponse
from app.services.mkb_service import get_mkb_code

router = APIRouter(prefix="/mkb_code", tags=["mkb"])


@router.post("", response_model=MKBResponse)
async def get_mkb_code_endpoint(request: MKBRequest):
    """Получение кода МКБ по описанию диагноза"""
    try:
        result = get_mkb_code(
            description=request.description,
            n_candidates=request.n_candidates,
            use_llm=request.use_llm
        )
        return MKBResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))