"""Короткие фрагменты исходного рассказа, без интерпретации и сортировки дат."""
from __future__ import annotations

import re

_EVENT = re.compile(r"обслед|фгдс|фгс|узи|колоноскоп|лечил|принимал|операц|симптом|помог|отменил", re.I)
_AGE_OR_BIRTH = re.compile(r"возраст|родил|рожден|рождён|\d+\s*(?:лет|год[а]?\s+от\s+роду)|мне\s+\d+", re.I)
_YEAR = re.compile(
    r"\b(?:в|с|до|после)\s*((?:19|20)\d{2})(?!\d)(?!\s*(?:мг|мл|грамм))"
    r"|(?<!\d)((?:19|20)\d{2})\s*г(?:од\w*|\.)"
    r"|^\s*((?:19|20)\d{2})\b(?=\s*[:—-])",
    re.I,
)
MAX_FRAGMENTS = 6
MAX_FRAGMENT_LENGTH = 240


def narrative_fragments(text: str) -> list[dict]:
    """Показывает узнаваемые события в порядке исходника. Не медицинская сводка."""
    result = []
    for source in re.split(r"(?<=[.!?])\s+|\n+", text):
        source = source.strip()
        if not source or not _EVENT.search(source) or _AGE_OR_BIRTH.search(source):
            continue
        years = [next(group for group in match.groups() if group) for match in _YEAR.finditer(source)]
        excerpt = source
        if len(source) > MAX_FRAGMENT_LENGTH:
            excerpt = source[:MAX_FRAGMENT_LENGTH] + "… [отрывок; полный текст — в исходной истории]"
        result.append({
            "label": "Из рассказа пациента (фрагмент)",
            "text": excerpt,
            "period": "; ".join(dict.fromkeys(years)) if years else "Дата не указана",
            "date": None,
            "source": "gastro_history.history_narrative",
        })
        if len(result) >= MAX_FRAGMENTS:
            break
    return result
