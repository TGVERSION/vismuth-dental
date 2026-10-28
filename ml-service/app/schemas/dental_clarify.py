"""Уточняющий вопрос стоматологической анкеты.

Анкета собирает ответы кнопками; нейросеть иногда задаёт пациенту один
короткий вопрос, если в ответах есть что уточнить для стоматолога.
"""

from typing import Literal

from pydantic import BaseModel, Field


class ClarifyTurn(BaseModel):
    """Уже заданный вопрос и ответ пациента."""

    question: str = Field(max_length=500, description="Вопрос, который задали")
    answer: str = Field(
        default="",
        max_length=1500,
        description="Ответ пациента; пусто — пациент пропустил вопрос",
    )


class DentalClarifyRequest(BaseModel):
    """Ответы анкеты текстом и прошлые уточнения."""

    answers: str = Field(
        max_length=8000,
        description="Ответы пациента одним текстом: повод, боль, здоровье, уточнения",
    )
    history: list[ClarifyTurn] = Field(
        default_factory=list,
        max_length=5,
        description="Заданные уточняющие вопросы и ответы на них",
    )


class DentalDecision(BaseModel):
    """Решение модели: нужен ли вопрос и какой."""

    need_question: bool = Field(
        description="true — в ответах не хватает важного для стоматолога; false — спрашивать нечего",
    )
    question: str = Field(
        default="",
        description="Один короткий вопрос пациенту на «вы»; пусто, если need_question=false",
    )
    choices: list[str] = Field(
        default_factory=list,
        description="2–5 коротких вариантов ответа; пусто, если вариантов нет",
    )


class DentalClarifyAnswer(BaseModel):
    """Итог: вопрос с вариантами ответа или «спрашивать нечего»."""

    status: Literal["question", "done"] = Field(
        description="question — задать вопрос; done — уточнять нечего",
    )
    question: str | None = Field(default=None, description="Вопрос; null при done")
    choices: list[str] = Field(default_factory=list, description="Варианты ответа")
