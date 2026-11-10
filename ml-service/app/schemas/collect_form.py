"""Схемы сбора трёх полей формы.

Состояние сбора описано целиком: статус поля, накопленный текст и признаки
достаточности. Решение «спрашивать дальше или нет» принимается по этим данным,
а не по тексту ответа модели.
"""

from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, Field

from .chat_form import AssistantMessage, ChatMessages


class FieldStatus(StrEnum):
    """Статус поля формы."""

    EMPTY = "empty"
    FILLED = "filled"
    DENIED = "denied"


class FormField(StrEnum):
    """Поле формы. Значения совпадают с именами атрибутов `FormProgress`."""

    COMPLAINTS = "complaints"
    MEDICATIONS = "medications"
    ALLERGY_ANAMNESIS = "allergy_anamnesis"


class CollectionTarget(StrEnum):
    """То, о чём сервис спрашивает сейчас."""

    COMPLAINTS = "complaints"
    COMPLAINTS_DETAIL = "complaints_detail"
    MEDICATIONS = "medications"
    MEDICATIONS_DOSE = "medications_dose"
    ALLERGY_ANAMNESIS = "allergy_anamnesis"


class CollectStatus(StrEnum):
    """Итог шага сбора."""

    QUESTION = "question"
    COMPLETE = "complete"
    STOPPED = "stopped"


class Complaints(BaseModel):
    """Жалобы: текст и признаки подробности."""

    status: FieldStatus = Field(
        description="filled — данные есть; denied — пациент отрицает или не знает; empty — данных нет",
    )
    value: str = Field(
        default="",
        description="Краткий текст жалоб из истории чата; пусто, если данных нет",
    )
    symptom_type: Literal["pain", "heartburn", "stool", "other"] = Field(
        default="pain",
        description="Основная уточняемая жалоба: pain — боль; heartburn — изжога; stool — диарея/запор/изменения стула; other — прочее. Не считать изжогу или диарею болью без сообщения пациента о боли",
    )
    has_frequency: bool = Field(default=False, description="Известна частота основной жалобы; для стула — частота дефекации")
    has_triggers: bool = Field(default=False, description="Известна связь изжоги с едой или положением тела, либо пациент не замечает связи/не знает")
    has_stool_description: bool = Field(default=False, description="Известен вид стула: например, жидкий, водянистый, твёрдый или оформленный")
    has_localization: bool = Field(
        default=False,
        description="Из истории известно, где именно болит",
    )
    has_character: bool = Field(
        default=False,
        description="Из истории известен характер боли",
    )
    has_onset: bool = Field(
        default=False,
        description="Из истории известна давность и начало",
    )

    @property
    def detailed(self) -> bool:
        """Жалобы описаны достаточно подробно для формы."""
        if self.symptom_type == "heartburn":
            return self.has_onset and self.has_frequency and self.has_triggers
        if self.symptom_type == "stool":
            return self.has_onset and self.has_frequency and self.has_stool_description
        if self.symptom_type == "other":
            return self.has_onset and self.has_character
        return self.has_localization and self.has_character and self.has_onset


class Medications(BaseModel):
    """Принимаемые препараты: текст и признак известной дозы."""

    status: FieldStatus = Field(
        description="filled — данные есть; denied — пациент отрицает или не знает; empty — данных нет",
    )
    value: str = Field(
        default="",
        description="Препараты с дозами из истории чата; пусто, если данных нет",
    )
    has_dose: bool = Field(
        default=False,
        description="Названа дозировка в мг/мкг/г или количество таблеток/капсул хотя бы у одного препарата. Количество таблеток не пересчитывать в мг без указанной пациентом дозировки",
    )


class AllergyAnamnesis(BaseModel):
    """Аллергоанамнез: аллергии и непереносимость."""

    status: FieldStatus = Field(
        description="filled — данные есть; denied — пациент отрицает или не знает; empty — данных нет",
    )
    value: str = Field(
        default="",
        description="Аллергии и непереносимость из истории чата; пусто, если данных нет",
    )


class FormProgress(BaseModel):
    """Состояние сбора трёх полей формы."""

    complaints: Complaints
    medications: Medications
    allergy_anamnesis: AllergyAnamnesis

    def missing(self) -> list[FormField]:
        """Незакрытые поля в порядке сбора."""
        return [
            field
            for field in FormField
            if getattr(self, field.value).status == FieldStatus.EMPTY
        ]


class CollectFormRequest(ChatMessages):
    """История чата и состояние сбора с прошлого шага."""

    state: FormProgress | None = Field(
        default=None,
        description="Состояние из прошлого ответа; null на первом шаге",
    )


class CollectFormAnswer(BaseModel):
    """Итог шага: следующий вопрос либо признак завершения."""

    status: CollectStatus = Field(
        description="question — задан вопрос; complete — все поля закрыты; stopped — лимит вопросов исчерпан",
    )
    messages: AssistantMessage | None = Field(
        default=None,
        description="Вопрос ассистента; null при complete и stopped",
    )
    next_field: CollectionTarget | None = Field(
        default=None,
        description="О чём спросили; null при complete и stopped",
    )
    missing_fields: list[FormField] = Field(
        default_factory=list,
        description="Незакрытые поля формы",
    )
    state: FormProgress = Field(
        description="Состояние сбора: сохранить и прислать в следующем запросе",
    )
