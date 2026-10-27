from datetime import date
from typing import Annotated, Any, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class PublicLinkDoctor(BaseModel):
    membership_id: UUID
    public_slug: str
    photo_url: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    middle_name: Optional[str] = None
    specializations: list[dict[str, Any]] = Field(default_factory=list)


class PublicLinkResponse(BaseModel):
    """Открытие публичной ссылки клиники или врача (брендинг, список врачей / выбранный врач)."""

    link_type: Literal["clinic", "doctor"]
    clinic_id: UUID
    clinic_name: str
    phone: Optional[str] = None
    logo_url: Optional[str] = None
    brand_color: Optional[str] = None
    clinic_public_slug: str
    doctor: Optional[PublicLinkDoctor] = None
    doctors: list[PublicLinkDoctor] = Field(default_factory=list)
    blocked: bool = Field(
        default=False,
        description="True — анкету нельзя начать (подписка, лимит, неактивный врач).",
    )
    block_code: Optional[str] = Field(
        default=None,
        description="Код блокировки: subscription_expired | clinic_daily_limit | doctor_inactive.",
    )
    block_message: Optional[str] = Field(
        default=None,
        description="Текст для пользователя при blocked=true.",
    )


class QuestionnaireCreateRequest(BaseModel):
    slug: str = Field(..., min_length=4, max_length=32)
    doctor_membership_id: Optional[UUID] = Field(
        default=None,
        description="Опционально: сразу выбрать врача (иначе шаг choose_doctor).",
    )


class StepDescriptorResponse(BaseModel):
    """Дескриптор текущего шага анкеты для UI пациента."""

    step_key: str
    step_type: str
    title: Optional[str] = None
    text: Optional[str] = None
    required: bool = True
    allow_skip: bool = Field(
        default=False,
        description="Разрешен ответ с skip=true (пропуск шага).",
    )
    allow_none: bool = Field(
        default=False,
        description="Разрешен ответ с none=true («ничего из перечисленного»).",
    )
    choices: list[dict[str, str]] = Field(
        default_factory=list,
        description="Варианты выбора: [{value, label}, ...].",
    )
    options: list[dict[str, Any]] = Field(
        default_factory=list,
        description="Доп. опции шага (врачи, специализации и т.п.).",
    )
    groups: list[dict[str, Any]] = Field(
        default_factory=list,
        description=(
            "Стоматологическая анкета, step_type=chip_groups: группы кнопок "
            "[{key, title, question, options[{value,label}], multiple, required, "
            "text: {placeholder, required, show} | null}]. Для checklist строки — в choices "
            "[{value, label, hint}]."
        ),
    )
    date_min: Optional[str] = None
    date_max: Optional[str] = None
    code: Optional[str] = Field(
        default=None,
        description="4-значный код пациенту на финальном шаге (после patient_info).",
    )
    completed: bool = False
    truncated: bool = Field(
        default=False,
        description="True — текст ответа обрезан на сервере (лимит длины).",
    )
    ai_unavailable: bool = Field(
        default=False,
        description="True — ML недоступен; идут фиксированные вопросы без AI.",
    )


class QuestionnaireCreateResponse(BaseModel):
    id: UUID
    token: str = Field(
        description="Сессионный токен анкеты; передавать в X-Questionnaire-Token.",
    )
    step: StepDescriptorResponse


class PublicInviteDoctor(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    middle_name: Optional[str] = None
    photo_url: Optional[str] = None
    specializations: list[dict[str, Any]] = Field(default_factory=list)


class PublicInviteResponse(BaseModel):
    """Открытие персональной ссылки: приветствие, брендинг, текущий шаг.

    Дальше — `GET/POST /public/questionnaires/{questionnaire_id}/…` с токеном
    ссылки в `X-Questionnaire-Token`.
    """

    questionnaire_id: UUID
    clinic_name: str
    phone: Optional[str] = None
    logo_url: Optional[str] = None
    brand_color: Optional[str] = None
    doctor: Optional[PublicInviteDoctor] = None
    patient_first_name: Optional[str] = None
    patient_middle_name: Optional[str] = None
    appointment_date: Optional[date] = None
    appointment_time: Optional[str] = None
    blocked: bool = False
    block_code: Optional[str] = Field(
        default=None,
        description="invite_expired | subscription_expired",
    )
    block_message: Optional[str] = None
    step: Optional[StepDescriptorResponse] = Field(
        default=None,
        description="Текущий шаг; null при blocked=true",
    )


class QuestionnaireAnswerRequest(BaseModel):
    """Ответ на текущий шаг. Поля зависят от step_type / step_key."""

    step_key: str = Field(description="Должен совпадать с текущим шагом сервера.")
    value: Optional[str] = Field(
        default=None,
        max_length=5000,
        description="Свободный текст ответа (жалобы, уточнения, patient_info и т.п.).",
    )
    choice: Optional[str] = Field(
        default=None,
        description="Выбранное значение из choices (value), если шаг с вариантами.",
    )
    skip: bool = Field(
        default=False,
        description="Пропустить шаг (только если allow_skip у дескриптора).",
    )
    none: bool = Field(
        default=False,
        description="«Ничего из перечисленного» (только если allow_none).",
    )
    doctor_membership_id: Optional[UUID] = Field(
        default=None,
        description="Выбор врача на шаге choose_doctor.",
    )
    specialization_id: Optional[int] = Field(
        default=None,
        description="Выбор специализации на соответствующем шаге.",
    )
    selections: Optional[
        dict[str, Annotated[list[Annotated[str, Field(max_length=64)]], Field(max_length=20)]]
    ] = Field(
        default=None,
        max_length=20,
        description=(
            "Стоматологическая анкета: выбранные значения по ключу группы "
            "(chip_groups) или {\"health\": [...]} (checklist)."
        ),
    )
    texts: Optional[dict[str, Annotated[str, Field(max_length=5000)]]] = Field(
        default=None,
        max_length=20,
        description="Стоматологическая анкета: свой текст по ключу группы.",
    )
    first_name: Optional[str] = Field(default=None, max_length=255)
    middle_name: Optional[str] = Field(default=None, max_length=255)
    appointment_date: Optional[date] = None
    appointment_time: Optional[str] = Field(
        default=None,
        description="Время приема HH:MM (00:00–23:59) на patient_info.",
    )


class DoctorQuestionnaireListItem(BaseModel):
    id: UUID
    appointment_time: Optional[str] = None
    patient_last_name: Optional[str] = None
    patient_first_name: Optional[str] = None
    patient_middle_name: Optional[str] = None
    visit_type: Optional[str] = None
    specialization_name: Optional[str] = None
    code: Optional[str] = None
    protocol_id: Optional[UUID] = None
    appointment_date: Optional[date] = None


class QuestionnaireAnswerItem(BaseModel):
    seq: int
    step_key: str
    kind: str
    question_text: Optional[str] = None
    answer_text: Optional[str] = None
    choice: Optional[str] = None


class DoctorQuestionnaireDetail(BaseModel):
    """Детали завершенной анкеты для врача (ответы + результат ML)."""

    id: UUID
    kind: Literal["general", "dental"] = Field(
        default="general",
        description="dental — structured собран правилами: important, health и др.",
    )
    visit_type: Optional[str] = None
    specialization_name: Optional[str] = None
    patient_last_name: Optional[str] = None
    patient_first_name: Optional[str] = None
    patient_middle_name: Optional[str] = None
    appointment_date: Optional[date] = None
    appointment_time: Optional[str] = None
    code: Optional[str] = None
    ai_unavailable: bool = Field(
        description="True — AI-уточнения не выполнялись / были недоступны.",
    )
    protocol_id: Optional[UUID] = None
    structured: Optional[dict[str, Any]] = Field(
        default=None,
        description="Структурированный итог summarize_form (поля протокола).",
    )
    gaps: Optional[list[Any]] = Field(
        default=None,
        description="Пробелы / недосказанности по мнению ML.",
    )
    processing_status: Optional[str] = Field(
        default=None,
        description="pending | done | failed — статус фоновой обработки.",
    )
    answers: list[QuestionnaireAnswerItem] = Field(default_factory=list)


class CreateProtocolFromQuestionnaireRequest(BaseModel):
    protocol_structure_id: UUID
    protocol_name: Optional[str] = Field(default=None, max_length=255)
