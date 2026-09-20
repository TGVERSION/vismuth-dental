from fastapi import APIRouter, HTTPException

from app.schemas import ClinrecRequest, Finding, ClinrecResponse
from app.services.clinrec_checking import get_clinrec_checking

router = APIRouter(prefix="/clinrec_checking", tags=["clinrec"])


@router.post("/check", response_model=ClinrecResponse)
async def check_protocol(request: ClinrecRequest):
    try:
        result = get_clinrec_checking(protocol_text=request.protocol_text)
        
        if "error" in result:
            raise HTTPException(status_code=500, detail=result["error"])
        
        return ClinrecResponse(
            severity_counts=result.get("severity_counts", {"critical": 0, "warning": 0, "info": 0}),
            findings=[Finding(**f) for f in result.get("findings", [])],
            compliant_sections=result.get("compliant_sections", [])
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))