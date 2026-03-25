from typing import List

from pydantic import BaseModel, Field


class Mkb10ItemRead(BaseModel):
    code: str = Field(description="Код диагноза по МКБ-10")
    name: str = Field(description="Название диагноза по МКБ-10")


class Mkb10SearchResponse(BaseModel):
    page: int
    size: int
    totalCount: int
    items: List[Mkb10ItemRead]

