"""Описание шага анкеты для экрана пациента — общее для общей и стоматологической."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional


@dataclass
class StepDescriptor:
    step_key: str
    step_type: str
    title: Optional[str] = None
    text: Optional[str] = None
    required: bool = True
    allow_skip: bool = False
    allow_none: bool = False
    choices: list[dict[str, str]] = field(default_factory=list)
    options: list[dict[str, Any]] = field(default_factory=list)
    groups: list[dict[str, Any]] = field(default_factory=list)
    date_min: Optional[str] = None
    date_max: Optional[str] = None
    code: Optional[str] = None
    completed: bool = False
    truncated: bool = False
    ai_unavailable: bool = False
    gastro: dict[str, Any] | None = None
    dental: dict[str, Any] | None = None
