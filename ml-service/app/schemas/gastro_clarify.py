"""Строгий контракт необязательного гастроуточнения."""
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class GastroTurn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    question: str = Field(max_length=200)
    answer: str = Field(default="", max_length=1000)


class GastroClarifyRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    answers: str = Field(max_length=150000)
    history: list[GastroTurn] = Field(default_factory=list, max_length=2)


class GastroDecision(BaseModel):
    model_config = ConfigDict(extra="forbid")
    need_question: bool
    question: str = Field(default="", max_length=500)
    choices: list[str] = Field(default_factory=list, max_length=10)


class GastroClarifyAnswer(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status: Literal["question", "done"]
    question: str | None = None
    choices: list[str] = Field(default_factory=list)
