from pydantic import BaseModel


class FullnessRequest(BaseModel):
    example_prompt: str


class FullnessResponse(BaseModel):
    status: str
    color: str
    analysis: str
    suggested_text: str





