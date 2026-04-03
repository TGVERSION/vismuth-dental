from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict
from app.services.mkb_service import get_mkb_code

router = APIRouter(prefix="/mkb_code", tags=["mkb"])


class MKBRequest(BaseModel):
    description: str
    n_candidates: int = 3
    use_llm: bool = True


class MKBResponse(BaseModel):
    extracted_diagnosis: Optional[str] = None
    candidates: List[Dict] = []
    best_code: Optional[str] = None
    best_name: Optional[str] = None


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