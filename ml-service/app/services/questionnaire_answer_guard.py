"""Классификация ответа без исполнения команд из пациентского текста."""

import asyncio
import json

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.runnables import Runnable

from app.schemas.questionnaire_answer_guard import (
    QuestionnaireAnswerGuardDecision,
    QuestionnaireAnswerGuardRequest,
)

from .prompts.questionnaire_answer_guard import QUESTIONNAIRE_ANSWER_GUARD_PROMPT

GUARD_TIMEOUT_SECONDS = 15.0


class QuestionnaireAnswerGuardService:
    def __init__(self, decider: Runnable) -> None:
        self._decider = decider

    async def run(
        self, request: QuestionnaireAnswerGuardRequest,
    ) -> QuestionnaireAnswerGuardDecision:
        messages = [
            SystemMessage(content=QUESTIONNAIRE_ANSWER_GUARD_PROMPT),
            HumanMessage(content=json.dumps({
                "step_key": request.step_key,
                "question": request.question,
                "untrusted_answer": request.answer,
            }, ensure_ascii=False)),
        ]
        result = await asyncio.wait_for(
            self._decider.ainvoke(messages), timeout=GUARD_TIMEOUT_SECONDS,
        )
        if not isinstance(result, QuestionnaireAnswerGuardDecision):
            raise TypeError("Unexpected questionnaire answer guard decision type")
        return result
