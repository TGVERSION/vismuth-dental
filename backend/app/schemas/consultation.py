from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class ConsultationCreate(BaseModel):
    service_user: Optional[UUID] = Field(
        default=None,
        description="ID пользователя сервиса (service_user.id)",
    )
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
    recommendations: Optional[str] = Field(
        default=None,
        description="Рекомендации",
    )
    prescriptions: Optional[str] = Field(
        default=None,
        description="Назначения",
    )
    disease_history: Optional[str] = Field(
        default=None,
        description="История заболевания (раздел протокола)",
    )
    status_protocol: Optional[str] = Field(
        default="draft",
        description="Статус протокола",
    )


class ConsultationRead(BaseModel):
    id: UUID
    service_user: Optional[UUID]
    external_system: Optional[int]
    external_patient_id: Optional[int]
    external_doctor_id: Optional[int]
    external_visit_id: Optional[int]
    consultation_datetime: Optional[datetime]
    complaints: Optional[str]
    disease_anamnesis: Optional[str]
    recommendations: Optional[str]
    prescriptions: Optional[str]
    disease_history: Optional[str]
    status_protocol: Optional[str]

    class Config:
        from_attributes = True


class ConsultationUpdate(BaseModel):
    service_user: Optional[UUID] = Field(
        default=None,
        description="ID пользователя сервиса (service_user.id)",
    )
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
    recommendations: Optional[str] = Field(
        default=None,
        description="Рекомендации",
    )
    prescriptions: Optional[str] = Field(
        default=None,
        description="Назначения",
    )
    disease_history: Optional[str] = Field(
        default=None,
        description="История заболевания (раздел протокола)",
    )
    status_protocol: Optional[str] = Field(
        default=None,
        description="Статус протокола",
    )


class ConsultationProtocolCreate(BaseModel):
    patient_condition: Optional[str] = Field(
        default=None,
        description="Состояние пациента",
    )
    objective_data: Optional[str] = Field(
        default=None,
        description="Объективные данные",
    )
    consultation_conclusion: Optional[str] = Field(
        default=None,
        description="Заключение консультации",
    )
    pathology_code: Optional[str] = Field(
        default=None,
        description="Код выявленной патологии",
    )
    comment: Optional[str] = Field(
        default=None,
        description="Комментарий",
    )


class ConsultationProtocolRead(BaseModel):
    id: int
    consultation_id: UUID
    patient_condition: Optional[str]
    objective_data: Optional[str]
    consultation_conclusion: Optional[str]
    pathology_code: Optional[str]
    comment: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class ConsultationProtocolUpdate(BaseModel):
    patient_condition: Optional[str] = Field(
        default=None,
        description="Состояние пациента",
    )
    objective_data: Optional[str] = Field(
        default=None,
        description="Объективные данные",
    )
    consultation_conclusion: Optional[str] = Field(
        default=None,
        description="Заключение консультации",
    )
    pathology_code: Optional[str] = Field(
        default=None,
        description="Код выявленной патологии",
    )
    comment: Optional[str] = Field(
        default=None,
        description="Комментарий",
    )


class ConsultationHabitCreate(BaseModel):
    bad_habits: Optional[str] = Field(
        default=None,
        description="Вредные привычки и зависимости",
    )


class ConsultationHabitRead(BaseModel):
    id: int
    consultation_id: UUID
    bad_habits: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class ConsultationHabitUpdate(BaseModel):
    bad_habits: Optional[str] = Field(
        default=None,
        description="Вредные привычки и зависимости",
    )


class ConsultationAllergyManifestationCreate(BaseModel):
    reaction_type: Optional[str] = Field(
        default=None,
        description="Тип аллергической реакции",
    )
    clinical_manifestations: Optional[str] = Field(
        default=None,
        description="Клинические проявления",
    )


class ConsultationAllergyManifestationRead(BaseModel):
    id: int
    consultation_id: UUID
    reaction_type: Optional[str]
    clinical_manifestations: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class ConsultationAllergyManifestationUpdate(BaseModel):
    reaction_type: Optional[str] = Field(
        default=None,
        description="Тип аллергической реакции",
    )
    clinical_manifestations: Optional[str] = Field(
        default=None,
        description="Клинические проявления",
    )


class ConsultationVitalSignCreate(BaseModel):
    parameter_code: Optional[str] = Field(
        default=None,
        description="Код витального параметра",
    )
    unit_code: Optional[str] = Field(
        default=None,
        description="Код единицы измерения",
    )


class ConsultationVitalSignRead(BaseModel):
    id: int
    consultation_id: UUID
    parameter_code: Optional[str]
    unit_code: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class ConsultationVitalSignUpdate(BaseModel):
    parameter_code: Optional[str] = Field(
        default=None,
        description="Код витального параметра",
    )
    unit_code: Optional[str] = Field(
        default=None,
        description="Код единицы измерения",
    )


class ConsultationClinicalScaleCreate(BaseModel):
    scale_type: Optional[str] = Field(
        default=None,
        description="Тип клинической шкалы",
    )
    unit_code: Optional[str] = Field(
        default=None,
        description="Код единицы измерения",
    )
    scale_parameter: Optional[str] = Field(
        default=None,
        description="Параметр клинической шкалы",
    )


class ConsultationClinicalScaleRead(BaseModel):
    id: int
    consultation_id: UUID
    scale_type: Optional[str]
    unit_code: Optional[str]
    scale_parameter: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class ConsultationClinicalScaleUpdate(BaseModel):
    scale_type: Optional[str] = Field(
        default=None,
        description="Тип клинической шкалы",
    )
    unit_code: Optional[str] = Field(
        default=None,
        description="Код единицы измерения",
    )
    scale_parameter: Optional[str] = Field(
        default=None,
        description="Параметр клинической шкалы",
    )


class ConsultationDiagnosisCreate(BaseModel):
    diagnosis_type: Optional[str] = Field(
        default=None,
        description="Вид нозологической единицы диагноза",
    )
    icd10_code: Optional[str] = Field(
        default=None,
        description="Код диагноза по МКБ-10",
    )
    diagnosis_validity: Optional[str] = Field(
        default=None,
        description="Степень обоснованности диагноза",
    )
    disease_nature: Optional[str] = Field(
        default=None,
        description="Характер заболевания",
    )


class ConsultationDiagnosisRead(BaseModel):
    id: int
    consultation_id: UUID
    diagnosis_type: Optional[str]
    icd10_code: Optional[str]
    diagnosis_validity: Optional[str]
    disease_nature: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class ConsultationDiagnosisUpdate(BaseModel):
    diagnosis_type: Optional[str] = Field(
        default=None,
        description="Вид нозологической единицы диагноза",
    )
    icd10_code: Optional[str] = Field(
        default=None,
        description="Код диагноза по МКБ-10",
    )
    diagnosis_validity: Optional[str] = Field(
        default=None,
        description="Степень обоснованности диагноза",
    )
    disease_nature: Optional[str] = Field(
        default=None,
        description="Характер заболевания",
    )

