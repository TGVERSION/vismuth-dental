from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class ConsultationBase(BaseModel):
    external_system: Optional[int] = Field(
        default=None,
        description="Идентификатор внешней системы (EMR/МИС)",
    )
    external_patient_id: Optional[int] = Field(
        default=None,
        description="Внешний ID пациента",
    )
    external_doctor_id: Optional[int] = Field(
        default=None,
        description="Внешний ID врача",
    )
    external_visit_id: Optional[int] = Field(
        default=None,
        description="Внешний ID визита/обращения",
    )
    consultation_datetime: Optional[datetime] = Field(
        default=None,
        description="Дата и время консультации",
    )
    complaints: Optional[str] = Field(
        default=None,
        description="Жалобы",
    )
    disease_anamnesis: Optional[str] = Field(
        default=None,
        description="Анамнез заболевания",
    )
    disease_history: Optional[str] = Field(
        default=None,
        description="История заболевания",
    )
    patient_condition: Optional[str] = Field(
        default=None,
        description="Состояние пациента",
    )
    life_anamnesis: Optional[str] = Field(
        default=None,
        description="Анамнез жизни",
    )
    bad_habits: Optional[str] = Field(
        default=None,
        description="Вредные привычки и зависимости",
    )
    allergy_anamnesis: Optional[str] = Field(
        default=None,
        description="Аллергологический анамнез",
    )
    vital_parameters: Optional[str] = Field(
        default=None,
        description="Витальные параметры",
    )
    objective_data: Optional[str] = Field(
        default=None,
        description="Объективные данные",
    )
    clinical_assessment: Optional[str] = Field(
        default=None,
        description="Объективизированная оценка состояния",
    )
    consultation_conclusion: Optional[str] = Field(
        default=None,
        description="Заключение консультации",
    )
    main_diagnosis: Optional[str] = Field(
        default=None,
        description="Основной диагноз",
    )
    comorbid_diagnoses: Optional[str] = Field(
        default=None,
        description="Сопутствующие диагнозы",
    )
    recommendations: Optional[str] = Field(
        default=None,
        description="Рекомендации",
    )
    prescriptions: Optional[str] = Field(
        default=None,
        description="Назначения",
    )
    status_protocol: Optional[str] = Field(
        default="draft",
        description="Статус протокола",
    )


class ConsultationCreate(ConsultationBase):
    pass


class ConsultationUpdate(ConsultationBase):
    status_protocol: Optional[str] = Field(
        default=None,
        description="Статус протокола",
    )


class ConsultationRead(ConsultationBase):
    id: UUID
    service_user: Optional[UUID] = Field(
        default=None,
        description="ID пользователя сервиса (service_user.id)",
    )
    created_at: datetime
    updated_at: Optional[datetime]
    deleted_at: Optional[datetime]

    class Config:
        from_attributes = True


class ConsultationIdRead(BaseModel):
    id: UUID

