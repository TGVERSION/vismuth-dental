"""Необязательное уточнение: изолированный prompt, строгая валидация."""
from __future__ import annotations

import json
import re

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.runnables import Runnable

from app.schemas.gastro_clarify import GastroClarifyAnswer, GastroClarifyRequest, GastroDecision
from .prompts.gastro_clarify import GASTRO_CLARIFY_SYSTEM_PROMPT

FORBIDDEN = re.compile(r"возраст|сколько.{0,15}лет|родил|год.{0,15}рожден|дат.{0,15}рожден|время\s+при[её]ма|во\s+сколько|диагноз|рекоменд|совет|принимайте|принима[тй]ь\s+лекар|начните|вам\s+нужно|вам\s+следует|age|birth|appointment\s*time|diagnos|recommend|prescri", re.I)
QUESTION_START = re.compile(r"^(что|как|когда|где|какой|какая|какое|какие|сколько|есть\s+ли|бывает\s+ли|было\s+ли|были\s+ли|с\s+чем|после\s+чего|можете\s+ли|уточните|отмечали\s+ли|связано\s+ли)\b", re.I)


def _normal(text: str) -> str:
    return " ".join(text.lower().replace("ё", "е").split()).rstrip("?").strip()


class GastroClarifyService:
    def __init__(self, decider: Runnable) -> None:
        self._decider = decider

    async def run(self, request: GastroClarifyRequest) -> GastroClarifyAnswer:
        done = GastroClarifyAnswer(status="done")
        if len(request.history) >= 2:
            return done
        messages = [SystemMessage(content=GASTRO_CLARIFY_SYSTEM_PROMPT), HumanMessage(content=json.dumps({"untrusted_answers": request.answers, "previous_clarifications": [turn.model_dump() for turn in request.history]}, ensure_ascii=False))]
        decision = await self._decider.ainvoke(messages)
        if not isinstance(decision, GastroDecision):
            raise TypeError("Unexpected gastro decision type")
        if not decision.need_question:
            return done
        question = decision.question.strip()
        choices = list(dict.fromkeys(c.strip() for c in decision.choices if c.strip()))
        if not question or len(question) > 200 or question.count("?") != 1 or FORBIDDEN.search(question):
            return done
        if not QUESTION_START.search(question) or not question.endswith("?") or any(c in question for c in ".!\n"):
            return done
        if _normal(question) in {_normal(t.question) for t in request.history}:
            return done
        if len(choices) > 5 or any(len(c) > 60 or FORBIDDEN.search(c) for c in choices):
            return done
        return GastroClarifyAnswer(status="question", question=question, choices=choices)
