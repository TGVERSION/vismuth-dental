from datetime import datetime, timezone
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..models.consultation import Consultation
from ..schemas.consultation import (
    ConsultationCreate,
    ConsultationIdRead,
    ConsultationRead,
    ConsultationUpdate,
)


router = APIRouter(prefix="/consultations", tags=["consultations"])


@router.get(
    "",
    response_model=List[ConsultationIdRead],
)
async def list_consultations_for_user(
    service_user: UUID = Query(..., description="ID пользователя сервиса"),
    db: AsyncSession = Depends(get_db),
) -> List[ConsultationIdRead]:
    stmt = (
        select(Consultation)
        .where(Consultation.service_user == service_user)
        .order_by(Consultation.created_at.desc())
    )
    result = await db.execute(stmt)
    consultations = result.scalars().all()
    return consultations


@router.post(
    "",
    response_model=ConsultationRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_consultation(
    payload: ConsultationCreate,
    db: AsyncSession = Depends(get_db),
) -> ConsultationRead:
    now = datetime.now(timezone.utc)

    consultation = Consultation(
        service_user=payload.service_user,
        external_system=payload.external_system,
        external_patient_id=payload.external_patient_id,
        external_doctor_id=payload.external_doctor_id,
        external_visit_id=payload.external_visit_id,
        consultation_datetime=payload.consultation_datetime,
        complaints=payload.complaints,
        disease_anamnesis=payload.disease_anamnesis,
        disease_history=payload.disease_history,
        patient_condition=payload.patient_condition,
        life_anamnesis=payload.life_anamnesis,
        bad_habits=payload.bad_habits,
        allergy_anamnesis=payload.allergy_anamnesis,
        vital_parameters=payload.vital_parameters,
        objective_data=payload.objective_data,
        clinical_assessment=payload.clinical_assessment,
        consultation_conclusion=payload.consultation_conclusion,
        main_diagnosis=payload.main_diagnosis,
        comorbid_diagnoses=payload.comorbid_diagnoses,
        recommendations=payload.recommendations,
        prescriptions=payload.prescriptions,
        status_protocol=payload.status_protocol or "draft",
        created_at=now,
        updated_at=now,
        deleted_at=None,
    )

    db.add(consultation)
    await db.commit()
    await db.refresh(consultation)

    return consultation


@router.get(
    "/{consultation_id}",
    response_model=ConsultationRead,
)
async def get_consultation(
    consultation_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> ConsultationRead:
    stmt = select(Consultation).where(Consultation.id == consultation_id)
    result = await db.execute(stmt)
    consultation = result.scalar_one_or_none()

    if consultation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Consultation not found",
        )

    return consultation


@router.put(
    "/{consultation_id}",
    response_model=ConsultationRead,
)
async def update_consultation(
    consultation_id: UUID,
    payload: ConsultationUpdate,
    db: AsyncSession = Depends(get_db),
) -> ConsultationRead:
    stmt = select(Consultation).where(Consultation.id == consultation_id)
    result = await db.execute(stmt)
    consultation = result.scalar_one_or_none()

    if consultation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Consultation not found",
        )

    if payload.service_user is not None:
        consultation.service_user = payload.service_user
    if payload.external_system is not None:
        consultation.external_system = payload.external_system
    if payload.external_patient_id is not None:
        consultation.external_patient_id = payload.external_patient_id
    if payload.external_doctor_id is not None:
        consultation.external_doctor_id = payload.external_doctor_id
    if payload.external_visit_id is not None:
        consultation.external_visit_id = payload.external_visit_id
    if payload.consultation_datetime is not None:
        consultation.consultation_datetime = payload.consultation_datetime
    if payload.complaints is not None:
        consultation.complaints = payload.complaints
    if payload.disease_anamnesis is not None:
        consultation.disease_anamnesis = payload.disease_anamnesis
    if payload.disease_history is not None:
        consultation.disease_history = payload.disease_history
    if payload.patient_condition is not None:
        consultation.patient_condition = payload.patient_condition
    if payload.life_anamnesis is not None:
        consultation.life_anamnesis = payload.life_anamnesis
    if payload.bad_habits is not None:
        consultation.bad_habits = payload.bad_habits
    if payload.allergy_anamnesis is not None:
        consultation.allergy_anamnesis = payload.allergy_anamnesis
    if payload.vital_parameters is not None:
        consultation.vital_parameters = payload.vital_parameters
    if payload.objective_data is not None:
        consultation.objective_data = payload.objective_data
    if payload.clinical_assessment is not None:
        consultation.clinical_assessment = payload.clinical_assessment
    if payload.consultation_conclusion is not None:
        consultation.consultation_conclusion = payload.consultation_conclusion
    if payload.main_diagnosis is not None:
        consultation.main_diagnosis = payload.main_diagnosis
    if payload.comorbid_diagnoses is not None:
        consultation.comorbid_diagnoses = payload.comorbid_diagnoses
    if payload.recommendations is not None:
        consultation.recommendations = payload.recommendations
    if payload.prescriptions is not None:
        consultation.prescriptions = payload.prescriptions
    if payload.status_protocol is not None:
        consultation.status_protocol = payload.status_protocol

    consultation.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(consultation)

    return consultation


@router.delete(
    "/{consultation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_consultation(
    consultation_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> None:
    stmt = select(Consultation).where(Consultation.id == consultation_id)
    result = await db.execute(stmt)
    consultation = result.scalar_one_or_none()

    if consultation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Consultation not found",
        )

    await db.delete(consultation)
    await db.commit()

    return None

