"""DB-обёртка гастроанкеты и необязательный фоновый вызов модели."""
from __future__ import annotations

import json
import hashlib
import logging
import re
from copy import deepcopy
from datetime import date, datetime, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..db import AsyncSessionLocal
from ..models.questionnaire import Questionnaire
from .gastro.flow import GastroAnswerError, answer, descriptor, values
from .gastro.summary import build_summary
from .ml_proxy import proxy_post_to_ml
from .questionnaire_code import allocate_code
from .questionnaire_step import StepDescriptor

logger = logging.getLogger(__name__)
_FORBIDDEN_QUESTION = re.compile(r"возраст|сколько.{0,15}лет|родил|год.{0,15}рожден|дат.{0,15}рожден|время\s+при[её]ма|во\s+сколько|диагноз|рекоменд|совет|принимайте|начните|вам\s+нужно|вам\s+следует|age|birth|appointment\s*time|diagnos|recommend|prescri", re.I)
_QUESTION_START = re.compile(r"^(что|как|когда|где|какой|какая|какое|какие|сколько|есть\s+ли|бывает\s+ли|было\s+ли|были\s+ли|с\s+чем|после\s+чего|можете\s+ли|уточните|отмечали\s+ли|связано\s+ли)\b", re.I)


def submission_fingerprint(selections: dict | None, texts: dict | None, choice: str | None) -> str:
    value = json.dumps({"selections": selections or {}, "texts": texts or {}, "choice": choice or "continue"}, ensure_ascii=False, sort_keys=True)
    return hashlib.sha256(value.encode()).hexdigest()


def build_gastro_descriptor(questionnaire: Questionnaire) -> StepDescriptor:
    if questionnaire.status == "completed":
        return StepDescriptor(step_key="code", step_type="code", title="Назовите этот код врачу на приёме", code=questionnaire.code, completed=True)
    result = descriptor(questionnaire.current_step, questionnaire.gastro_answers or {})
    if questionnaire.current_step == "gastro_identity":
        result.date_min = date.today().isoformat()
        result.date_max = (date.today() + timedelta(days=settings.questionnaire_appointment_days_ahead)).isoformat()
    result.ai_unavailable = questionnaire.ai_unavailable
    return result


async def apply_gastro(db: AsyncSession, q: Questionnaire, *, step_key: str, revision: int | None, selections: dict, texts: dict, choice: str | None = None) -> None:
    try:
        state, next_step = answer(q.gastro_answers or {}, step_key, revision=revision, selections=selections, texts=texts, choice=choice)
    except GastroAnswerError as exc:
        raise HTTPException(status_code=409 if "revision" in str(exc) else 400, detail=str(exc)) from exc
    if step_key == "gastro_identity" and choice not in {"back"}:
        vals = values(state, step_key)
        appointment = date.fromisoformat(vals["appointment_date"])
        if not date.today() <= appointment <= date.today() + timedelta(days=settings.questionnaire_appointment_days_ahead):
            raise HTTPException(status_code=400, detail="appointment_date out of range")
        q.patient_first_name = vals["first_name"].strip()
        q.patient_middle_name = vals.get("middle_name", "").strip() or None
        q.appointment_date = appointment
        q.appointment_time = None
    if next_step == "code":
        identity = values(state, "gastro_identity")
        if not identity.get("first_name") or not identity.get("appointment_date"):
            raise HTTPException(status_code=400, detail="Name and appointment date required before submission")
        q.code = q.code or await allocate_code(db, q.clinic_id)
        q.structured, q.gaps = build_summary(state)
        q.processing_status = "done"
        q.status = "completed"
        q.completed_at = datetime.now(timezone.utc)
        state["submission_revision"] = revision
        state["submission_fingerprint"] = submission_fingerprint(selections, texts, choice)
    q.gastro_answers = state
    q.current_step = next_step
    if next_step in {"visit_type", "choose_doctor", "choose_specialization"}:
        q.kind = "general"
        if next_step in {"choose_doctor", "choose_specialization"}:
            q.specialization_id = None
        if next_step == "choose_doctor":
            q.doctor_membership_id = None
    now = datetime.now(timezone.utc)
    q.last_activity_at = now
    q.updated_at = now


def clarify_payload(state: dict) -> dict:
    # Вопросы пациента и идентификаторы никогда не передаются модели.
    sections = {key: section for key, section in state.get("sections", {}).items() if key not in {"gastro_identity", "gastro_review", "gastro_questions"}}
    return {"answers": json.dumps(sections, ensure_ascii=False), "history": [{"question": turn["question"], "answer": turn.get("answer", "")} for turn in state.get("ai", [])]}


def publish_ai(q: Questionnaire, revision: int, response: dict | None) -> bool:
    state = deepcopy(q.gastro_answers or {})
    if q.kind != "gastro" or q.status != "in_progress" or q.current_step != "gastro_ai_wait" or state.get("revision", 0) != revision or state.get("ai_terminal"):
        return False
    question = response.get("question") if isinstance(response, dict) and response.get("status") == "question" else None
    choices = response.get("choices", []) if isinstance(response, dict) else []
    valid = isinstance(question, str) and 0 < len(question) <= 200 and question.count("?") == 1 and not _FORBIDDEN_QUESTION.search(question)
    valid = valid and bool(_QUESTION_START.search(question)) and question.endswith("?") and not any(c in question for c in ".!\n")
    valid = valid and isinstance(choices, list) and len(choices) <= 5 and all(isinstance(c, str) and 0 < len(c) <= 60 and not _FORBIDDEN_QUESTION.search(c) for c in choices)
    valid = valid and len(state.get("ai", [])) < 2 and question not in {t["question"] for t in state.get("ai", [])}
    if valid:
        state.setdefault("ai", []).append({"question": question, "choices": choices})
        state.setdefault("sections", {}).pop("gastro_ai_question", None)
        state.setdefault("drafts", {}).pop("gastro_ai_question", None)
        q.current_step = "gastro_ai_question"
        q.ai_questions_count = len(state["ai"])
    else:
        state["ai_terminal"] = True
        q.current_step = "gastro_identity"
    if response is None:
        q.ai_unavailable = True
    state["revision"] = revision + 1
    q.gastro_answers = state
    q.updated_at = datetime.now(timezone.utc)
    return True


async def run_gastro_clarification(questionnaire_id: UUID, revision: int) -> None:
    # Не удерживаем блокировку строки и DB-сессию, пока отвечает модель.
    async with AsyncSessionLocal() as db:
        q = await db.get(Questionnaire, questionnaire_id)
        if q is None or q.current_step != "gastro_ai_wait" or (q.gastro_answers or {}).get("revision") != revision:
            return
        payload = clarify_payload(q.gastro_answers or {})
    try:
        response = await proxy_post_to_ml("/gastro_clarify", payload, timeout=settings.questionnaire_ai_timeout)
    except Exception:
        # Не печатаем exception/payload: они могут содержать медицинский текст.
        logger.warning("gastro clarification unavailable questionnaire=%s", questionnaire_id)
        response = None
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Questionnaire).where(Questionnaire.id == questionnaire_id).with_for_update())
        q = result.scalar_one_or_none()
        if q is not None and publish_ai(q, revision, response):
            await db.commit()
