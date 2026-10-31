"""Детерминированная карточка. Исходный текст хранится дословно."""
from __future__ import annotations

from typing import Any

from .questions import BRANCHES, COMPLAINTS, FIELDS, JAUNDICE_WARNING, ONSET, RISK_LABELS, RISK_OTHER_LABELS, TITLES
from .history import narrative_fragments


def _values(state: dict, step: str) -> dict:
    return state.get("sections", {}).get(step, {}).get("values", {})


def warnings(state: dict) -> list[str]:
    safety = _values(state, "gastro_safety")
    now = [label for key, label in RISK_LABELS.items() if safety.get(key) == ["now"]]
    jaundice = [JAUNDICE_WARNING] if _values(state, "gastro_jaundice").get("jaundice_period") == ["now"] else []
    if not now:
        unclear = any(safety.get(key) == ["unknown"] or (key in safety.get("risk_present", []) and not safety.get(key)) for key in RISK_LABELS)
        if unclear or safety.get("risk_present") == ["unknown"]:
            return jaundice + ["Вы не уверены в значимых признаках. Анкета не определяет срочность состояния. Если сейчас есть выраженное ухудшение или перечисленные опасные признаки, обратитесь за неотложной медицинской помощью без ожидания анкеты и ИИ."]
        return jaundice
    return jaundice + ["Вы отметили сейчас: " + "; ".join(now) + ". Не ждите заполнения анкеты или ответа ИИ. Обратитесь за неотложной медицинской помощью; при выраженном ухудшении вызовите скорую помощь."]


def _section(state: dict, step: str) -> str:
    vals = _values(state, step)
    if step not in state.get("sections", {}):
        return "Не спрошено"
    result = []
    for f in FIELDS.get(step, []):
        val = vals.get(f["key"])
        if not val:
            continue
        if isinstance(val, list):
            labels = {o["value"]: o["label"] for o in f.get("options", [])}
            rendered = "; ".join(labels.get(v, v) for v in val)
        else:
            rendered = val
        result.append(f"{f['label']}: {rendered}")
    return "\n".join(result) or "Пропущено / не сообщено"


def build_summary(state: dict) -> tuple[dict[str, Any], list[dict[str, str]]]:
    reason = _values(state, "gastro_reason")
    selected = reason.get("complaints", [])
    labels = {o["value"]: o["label"] for o in COMPLAINTS}
    complaint_lines = [_section(state, "gastro_reason")]
    main = _values(state, "gastro_main").get("main", [])
    if main:
        complaint_lines.append("Главная причина: " + labels.get(main[0], main[0]))
    complaint_lines += [labels[key] + ":\n" + _section(state, f"gastro_{key}") for key in BRANCHES if key in selected]
    important = []
    if _values(state, "gastro_jaundice").get("jaundice_period") == ["now"]:
        important.append("Сейчас / сегодня: Желтизна кожи или глаз. Срочная очная медицинская оценка.")
    for key, label in {**RISK_LABELS, **RISK_OTHER_LABELS}.items():
        period = _values(state, "gastro_safety").get(key, [])
        if period == ["now"]:
            important.append("Сейчас / сегодня: " + label + ". Обратить внимание без ожидания ИИ.")
        elif period == ["past"]:
            important.append("Было раньше, сейчас нет: " + label)
        elif key in _values(state, "gastro_safety").get("risk_present", []):
            important.append("Период не уточнён: " + label)
    history_values = _values(state, "gastro_history")
    history_raw = {key: val for key, val in history_values.items() if key != "history_mode"}
    # Это факты с исходными периодами, а не придуманная временная шкала.
    chronology = []
    onset_labels = {o["value"]: o["label"] for o in ONSET}
    for key in BRANCHES:
        complaint = _values(state, f"gastro_{key}")
        onset = complaint.get(f"{key}_onset", [])
        if onset or complaint.get(f"{key}_onset_text"):
            chronology.append({"label": labels[key] + ": начало", "text": complaint.get(f"{key}_onset_text", ""), "period": onset_labels.get(onset[0], "Срок не указан") if onset else "Срок не указан", "date": None, "source": f"gastro_{key}"})
    for key, label in [("history_narrative", "История своими словами"), ("history_examinations", "Обследования"), ("history_treatments", "Лечение"), ("history_outcomes", "Результаты лечения"), ("history_changes", "Что изменилось")]:
        if history_values.get(key):
            raw = history_values[key]
            if key == "history_narrative":
                fragments = narrative_fragments(raw)
                if fragments:
                    chronology.extend(fragments)
                    continue
                brief = f"Сохранён исходный рассказ: {len(raw)} символов. Полный текст — в истории пациента."
            else:
                brief = raw if len(raw) <= 240 else raw[:240] + "… [отрывок; полный текст — в исходной истории]"
            chronology.append({"label": label, "text": brief, "period": "Период — по исходному тексту пациента; не определён автоматически", "date": None, "source": "gastro_history"})
    life = [TITLES[step] + ":\n" + _section(state, step) for step in ["gastro_health", "gastro_family", "gastro_tests", "gastro_history"]]
    stopped = _values(state, "gastro_medications").get("stopped_attempts")
    if stopped:
        life.append("Ранее пробовали / отменили: " + stopped)
    medication_values = _values(state, "gastro_medications")
    status = medication_values.get("medication_status", [])
    status_labels = {"yes": "Принимает сейчас", "none": "Нет известных текущих препаратов", "unknown": "Не знаю", "skip": "Пропущено"}
    medication = status_labels.get(status[0], "Не сообщено") if status else ("Не сообщено" if "gastro_medications" in state.get("sections", {}) else "Не спрошено")
    if medication_values.get("current_medications"):
        medication += ": " + medication_values["current_medications"]
    exposures = medication_values.get("recent_exposures", [])
    exposure_field = next(f for f in FIELDS["gastro_medications"] if f["key"] == "recent_exposures")
    exposure_labels = {o["value"]: o["label"] for o in exposure_field["options"]}
    if exposures:
        medication += "\nЗа последние 3 месяца: " + "; ".join(exposure_labels[key] for key in exposures)
    for key in ("nsaids", "anticoagulants"):
        if key in exposures:
            important.append("За последние 3 месяца: " + exposure_labels[key] + ". Текущий приём не установлен этим ответом.")
    gaps = []
    if "other" in selected and not reason.get("reason_text"):
        if not any(isinstance(val, str) and val.strip() for val in history_raw.values()):
            gaps.append({"section": "complaints", "question": "Уточнить другую причину визита"})
    if _values(state, "gastro_allergy").get("allergy_status") == ["yes"] and not _values(state, "gastro_allergy").get("allergy_reaction"):
        gaps.append({"section": "allergy_anamnesis", "question": "Уточнить реакцию на аллерген"})
    return {
        "complaints": "\n\n".join(complaint_lines), "medications": medication,
        "allergy_anamnesis": _section(state, "gastro_allergy"), "life_anamnesis": "\n\n".join(life),
        "important": important, "safety": _section(state, "gastro_safety"),
        "history": {"raw": history_raw, "mode": history_values.get("history_mode", []), "chronology": chronology},
        "patient_questions": _values(state, "gastro_questions").get("patient_questions", []),
        "clarifications": [{"question": turn["question"], "answer": turn.get("answer", "")} for turn in state.get("ai", [])],
        "raw_answers": state.get("sections", {}),
    }, gaps
