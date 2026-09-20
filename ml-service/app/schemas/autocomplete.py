from pydantic import BaseModel
from typing import List


class CompletionRequest(BaseModel):
    field: str
    prefix: str
    num_sequences: int = 5


class CompletionResponse(BaseModel):
    suggestions: List[str]
