from pydantic import BaseModel, Field


class MlFullnessComplaintsRequest(BaseModel):
    example_prompt: str = Field(..., min_length=1)


class MlFullnessComplaintsResponse(BaseModel):
    status: str
    color: str
    analysis: str
    suggested_text: str
