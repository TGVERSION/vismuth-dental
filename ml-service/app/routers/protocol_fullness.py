from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict
from app.services.complaints_fullness import get_complaints_fullness

router = APIRouter(prefix="/fullness", tags=["fullness"])

class ComplaintsRequest(BaseModel):
    example_prompt: str

class ComplaintsResponse(BaseModel):
    status: str
    color: str
    analysis: str
    suggested_text: str

@router.post("/complaints", response_model=ComplaintsResponse)
async def complaints_fullness(request: ComplaintsRequest):
    try:
        result = await get_complaints_fullness(request.example_prompt)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))