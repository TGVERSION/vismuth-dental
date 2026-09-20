from pydantic import BaseModel
from typing import Optional, List, Dict


class MKBRequest(BaseModel):
    description: str
    n_candidates: int = 3
    use_llm: bool = True


class MKBResponse(BaseModel):
    extracted_diagnosis: Optional[str] = None
    candidates: List[Dict] = []
    best_code: Optional[str] = None
    best_name: Optional[str] = None
