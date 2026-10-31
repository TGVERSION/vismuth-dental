"""Чистая машина состояний. Ревизия защищает от старой вкладки."""
from __future__ import annotations

import json
from copy import deepcopy
from datetime import date, datetime, timezone
from typing import Any

from ..questionnaire_step import StepDescriptor
from .questions import BRANCHES, COMPLAINTS, FIELDS, TITLES, field, options, single


class GastroAnswerError(ValueError):
    pass


def route_gastro(specialty: str | None, visit: str | None) -> bool:
    name = (specialty or "").lower()
    return visit == "primary" and "гастро" in name and "детск" not in name


def values(state: dict, step: str) -> dict:
    return state.get("sections", {}).get(step, {}).get("values", {})


def needs_clarification(state: dict) -> bool:
    reason = values(state, "gastro_reason")
    history = values(state, "gastro_history")
    described = reason.get("reason_text") or any(isinstance(text, str) and text.strip() for key, text in history.items() if key != "history_mode")
    return "other" in reason.get("complaints", []) and not described and not state.get("ai_terminal")


def sequence(state: dict) -> list[str]:
    complaints = values(state, "gastro_reason").get("complaints", [])
    steps = ["gastro_reason"]
    if len(complaints) > 1:
        steps.append("gastro_main")
    steps += [f"gastro_{key}" for key in BRANCHES if key in complaints]
    steps += ["gastro_safety", "gastro_medications", "gastro_allergy", "gastro_health", "gastro_family", "gastro_tests", "gastro_history"]
    if needs_clarification(state):
        steps.append("gastro_ai_offer")
    return steps + ["gastro_identity", "gastro_review", "gastro_questions", "code"]


def fields_for(step: str, state: dict) -> list[dict]:
    if step == "gastro_main":
        selected = values(state, "gastro_reason").get("complaints", [])
        return [single("main", "Какую причину важнее обсудить в первую очередь?", [o for o in COMPLAINTS if o["value"] in selected], required=True)]
    if step == "gastro_ai_question":
        turn = state.get("ai", [])[-1] if state.get("ai") else {}
        return [single("ai_choice", turn.get("question", "Уточнение"), options(*[(str(i), label) for i, label in enumerate(turn.get("choices", []))])), field("ai_text", "Свой ответ", "multiline")]
    return deepcopy(FIELDS.get(step, []))


def descriptor(step: str, state: dict) -> StepDescriptor:
    from .summary import build_summary, warnings

    screen = {"gastro_history": "history", "gastro_review": "review", "gastro_questions": "questions", "gastro_ai_offer": "ai_offer", "gastro_ai_wait": "ai_wait", "gastro_ai_question": "ai_question"}.get(step, "form")
    restored = state.get("drafts", {}).get(step, values(state, step))
    meta: dict[str, Any] = {"screen": screen, "section": TITLES.get(step, "Жалобы"), "revision": state.get("revision", 0), "can_back": True, "fields": fields_for(step, state), "values": restored, "warnings": warnings(state)}
    if step == "gastro_review":
        structured, _ = build_summary(state)
        meta["summary"] = [{"label": label, "value": structured[key]} for key, label in [("complaints", "Причина визита и жалобы"), ("medications", "Лекарства сейчас"), ("allergy_anamnesis", "Аллергии"), ("life_anamnesis", "История и здоровье")]]
        identity = values(state, "gastro_identity")
        meta["summary"].append({"label": "Имя и дата приёма", "value": " ".join(str(identity.get(k, "")) for k in ("first_name", "middle_name", "appointment_date"))})
        meta["actions"] = [{"value": "continue", "label": "Всё верно — к вопросам врачу", "primary": True}] + [{"value": f"edit:{key}", "label": f"Изменить: {TITLES.get(key, key.removeprefix('gastro_'))}"} for key in sequence(state) if key not in {"code", "gastro_review", "gastro_questions", "gastro_ai_offer"}]
        meta["actions"] += [{"value": "change_doctor", "label": "Изменить врача"}, {"value": "change_specialization", "label": "Изменить специальность"}]
    elif step == "gastro_ai_offer":
        meta["actions"] = [{"value": "finish_ai", "label": "Продолжить без ИИ", "primary": True}, {"value": "start_ai", "label": "Уточнить с ИИ"}]
    elif step in {"gastro_ai_wait", "gastro_ai_question"}:
        meta["actions"] = ([{"value": "continue", "label": "Ответить", "primary": True}] if step == "gastro_ai_question" else []) + [{"value": "finish_ai", "label": "Закончить уточнения"}]
    return StepDescriptor(step_key=step, step_type="gastro_form", title=TITLES.get(step, next((o["label"] for o in COMPLAINTS if o["value"] == step.removeprefix("gastro_")), "Анкета")), gastro=meta)


def _visible(f: dict, vals: dict) -> bool:
    cond = f.get("show_when")
    return not cond or cond["value"] in vals.get(cond["key"], [])


def _validate(step: str, state: dict, selections: dict, texts: dict, *, require_complete: bool = True) -> dict:
    fields = fields_for(step, state)
    allowed = {f["key"] for f in fields}
    if (selections.keys() | texts.keys()) - allowed:
        raise GastroAnswerError("Unknown field for this step")
    vals: dict[str, Any] = {}
    for f in fields:
        key = f["key"]
        if f["type"] in {"single", "multi"}:
            if key in texts:
                raise GastroAnswerError("Selection field requires selections")
            raw = selections.get(key, [])
            if not isinstance(raw, list) or not all(isinstance(v, str) for v in raw):
                raise GastroAnswerError("Invalid selections")
            if len(set(raw)) != len(raw) or any(v not in {o["value"] for o in f["options"]} for v in raw):
                raise GastroAnswerError("Unknown selection")
            if f["type"] == "single" and len(raw) > 1:
                raise GastroAnswerError("Choose one value")
            if len(raw) > 1 and set(raw) & set(f.get("exclusive_values", [])):
                raise GastroAnswerError("Exclusive value cannot be combined")
            if raw:
                vals[key] = raw
        else:
            if key in selections:
                raise GastroAnswerError("Text field requires texts")
            raw = texts.get(key, "")
            if not isinstance(raw, str):
                raise GastroAnswerError("Text required")
            if len(raw) > f.get("max_length", 1000):
                raise GastroAnswerError(f"Maximum length is {f.get('max_length', 1000)}")
            if f["type"] == "list":
                try:
                    entries = json.loads(raw or "[]")
                except (ValueError, TypeError) as exc:
                    raise GastroAnswerError("Invalid question list") from exc
                if not isinstance(entries, list) or len(entries) > 30 or not all(isinstance(v, str) and v.strip() and len(v) <= 2000 for v in entries):
                    raise GastroAnswerError("Question list: up to 30 nonempty questions, 2000 characters each")
                vals[key] = entries
            elif raw.strip():
                vals[key] = raw
    for f in fields:
        visible = _visible(f, vals)
        if not visible and vals.get(f["key"]):
            raise GastroAnswerError("Hidden field must be cleared")
        if require_complete and visible and f.get("required") and not vals.get(f["key"]):
            raise GastroAnswerError(f"Required field: {f['key']}")
    if step == "gastro_identity" and "appointment_date" in vals:
        try:
            date.fromisoformat(vals["appointment_date"])
        except (ValueError, TypeError) as exc:
            raise GastroAnswerError("Invalid appointment date") from exc
    return vals


def answer(state: dict, step: str, *, revision: int | None, selections: dict, texts: dict, choice: str | None = None) -> tuple[dict, str]:
    if revision != state.get("revision", 0):
        raise GastroAnswerError("Stale revision")
    state = deepcopy(state)
    order = sequence(state)
    if step not in order and step not in {"gastro_ai_wait", "gastro_ai_question"}:
        raise GastroAnswerError("Step is unavailable")
    if choice == "back":
        state.setdefault("drafts", {})[step] = _validate(step, state, selections, texts, require_complete=False)
        if step == "gastro_reason":
            next_step = "visit_type"
        elif step in {"gastro_ai_wait", "gastro_ai_question"}:
            next_step = "gastro_history"
        else:
            next_step = order[max(0, order.index(step) - 1)]
    elif choice and choice.startswith("edit:"):
        next_step = choice.split(":", 1)[1]
        if step != "gastro_review" or next_step not in order or next_step in {"code", "gastro_questions"}:
            raise GastroAnswerError("Invalid edit target")
    elif choice in {"change_doctor", "change_specialization"} and step == "gastro_review":
        next_step = "choose_doctor" if choice == "change_doctor" else "choose_specialization"
    elif choice == "finish_ai" and step in {"gastro_ai_offer", "gastro_ai_wait", "gastro_ai_question"}:
        state["ai_terminal"] = True
        next_step = "gastro_identity"
    elif choice == "start_ai" and step == "gastro_ai_offer":
        next_step = "gastro_ai_wait"
    elif step == "gastro_ai_wait":
        raise GastroAnswerError("AI is still running")
    else:
        if choice not in {None, "continue"}:
            raise GastroAnswerError("Unknown action")
        vals = _validate(step, state, selections, texts)
        state.setdefault("drafts", {}).pop(step, None)
        sections = state.setdefault("sections", {})
        changed = sections.get(step, {}).get("values") != vals
        sections[step] = {"values": vals, "answered_at": datetime.now(timezone.utc).isoformat()}
        if step == "gastro_reason":
            for branch in BRANCHES:
                if branch not in vals.get("complaints", []):
                    sections.pop(f"gastro_{branch}", None)
                    state.setdefault("drafts", {}).pop(f"gastro_{branch}", None)
            main = sections.get("gastro_main", {}).get("values", {}).get("main", [])
            if not main or main[0] not in vals.get("complaints", []) or len(vals.get("complaints", [])) < 2:
                sections.pop("gastro_main", None)
                state.setdefault("drafts", {}).pop("gastro_main", None)
        if changed and step not in {"gastro_identity", "gastro_review", "gastro_questions", "gastro_ai_question"}:
            state["ai"] = []
            state.pop("ai_terminal", None)
            sections.pop("gastro_ai_question", None)
            state.setdefault("drafts", {}).pop("gastro_ai_question", None)
        if step == "gastro_ai_question":
            turn = state["ai"][-1]
            selection = vals.get("ai_choice", [])
            turn["answer"] = vals.get("ai_text") or (turn["choices"][int(selection[0])] if selection else "")
            if not turn["answer"]:
                raise GastroAnswerError("Answer or finish clarifications")
            next_step = "gastro_ai_wait" if len(state["ai"]) < 2 else "gastro_identity"
            if next_step == "gastro_identity":
                state["ai_terminal"] = True
        else:
            order = sequence(state)
            next_step = order[order.index(step) + 1]
    # Любая навигация отменяет результат уже запущенного worker по старой ревизии.
    state["revision"] = state.get("revision", 0) + 1
    return state, next_step
