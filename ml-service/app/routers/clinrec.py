from fastapi import APIRouter, HTTPException

from app.schemas.clinrec import ClinrecRequest, ClinrecResponse
from app.services.clinrec_checking import get_clinrec_checking

router = APIRouter(prefix="/clinrec_checking", tags=["clinrec"])


@router.post("/check", response_model=ClinrecResponse)
async def check_protocol(request: ClinrecRequest):
    try:
        result = get_clinrec_checking(protocol_text=request.protocol_text)
        
        return ClinrecResponse(
            severity_counts=result.severity_counts,
            findings=result.findings,
            compliant_sections=result.compliant_sections
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))