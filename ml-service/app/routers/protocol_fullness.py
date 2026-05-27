from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict
from app.services.complaints_fullness import get_complaints_fullness
from app.services.dis_anamnes_fullness import get_dis_anamnes_fullness
from app.services.life_anamnes_fullness import get_life_anamnes_fullness

router = APIRouter(prefix="/fullness", tags=["fullness"])

class FullnessRequest(BaseModel):
    example_prompt: str

class FullnessResponse(BaseModel):
    status: str
    color: str
    analysis: str
    suggested_text: str


@router.post("/complaints", response_model=FullnessResponse)
async def complaints_fullness(request: FullnessRequest):
    try:
        result = await get_complaints_fullness(request.example_prompt)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@router.post("/dis_anamnes", response_model=FullnessResponse)
async def dis_anamnes_fullness(request: FullnessRequest):
    try:
        result = await get_dis_anamnes_fullness(request.example_prompt)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@router.post("/life_anamnes", response_model=FullnessResponse)
async def life_anamnes_fullness(request: FullnessRequest):
    try:
        result = await get_life_anamnes_fullness(request.example_prompt)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))