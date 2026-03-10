from datetime import datetime, timezone
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..models.consultation import (
    Consultation,
    ConsultationAllergyManifestation,
    ConsultationClinicalScale,
    ConsultationDiagnosis,
    ConsultationHabit,
    ConsultationProtocols,
    ConsultationVitalSign,
)
from ..schemas.consultation import (
    ConsultationAllergyManifestationCreate,
    ConsultationAllergyManifestationRead,
    ConsultationClinicalScaleCreate,
    ConsultationClinicalScaleRead,
    ConsultationClinicalScaleCreate,
    ConsultationClinicalScaleRead,
    ConsultationCreate,
    ConsultationDiagnosisCreate,
    ConsultationDiagnosisRead,
    ConsultationHabitCreate,
    ConsultationHabitRead,
    ConsultationProtocolCreate,
    ConsultationProtocolRead,
    ConsultationRead,
    ConsultationUpdate,
    ConsultationVitalSignCreate,
    ConsultationVitalSignRead,
    ConsultationAllergyManifestationUpdate,
    ConsultationClinicalScaleUpdate,
    ConsultationDiagnosisUpdate,
    ConsultationHabitUpdate,
    ConsultationProtocolUpdate,
    ConsultationVitalSignUpdate,
)


router = APIRouter(prefix="/consultations", tags=["consultations"])


@router.get(
    "",
    response_model=List[ConsultationRead],
)
async def list_consultations_for_user(
    service_user: UUID = Query(..., description="ID пользователя сервиса"),
    db: AsyncSession = Depends(get_db),
) -> List[ConsultationRead]:
    stmt = (
        select(Consultation)
        .where(Consultation.service_user == service_user)
        .order_by(Consultation.consultation_datetime.desc().nullslast())
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
        recommendations=payload.recommendations,
        prescriptions=payload.prescriptions,
        disease_history=payload.disease_history,
        status_protocol=payload.status_protocol or "draft",
        created_at=now,
        updated_at=now,
        deleted_at=None,
    )

    db.add(consultation)
    await db.commit()
    await db.refresh(consultation)

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
    if payload.recommendations is not None:
        consultation.recommendations = payload.recommendations
    if payload.prescriptions is not None:
        consultation.prescriptions = payload.prescriptions
    if payload.disease_history is not None:
        consultation.disease_history = payload.disease_history
    if payload.status_protocol is not None:
        consultation.status_protocol = payload.status_protocol

    consultation.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(consultation)

    return consultation


@router.post(
    "/{consultation_id}/protocols",
    response_model=ConsultationProtocolRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_consultation_protocol(
    consultation_id: UUID,
    payload: ConsultationProtocolCreate,
    db: AsyncSession = Depends(get_db),
) -> ConsultationProtocolRead:
    now = datetime.now(timezone.utc)

    obj = ConsultationProtocols(
        consultation_id=consultation_id,
        patient_condition=payload.patient_condition,
        objective_data=payload.objective_data,
        consultation_conclusion=payload.consultation_conclusion,
        pathology_code=payload.pathology_code,
        comment=payload.comment,
        created_at=now,
    )

    db.add(obj)
    await db.commit()
    await db.refresh(obj)

    return obj


@router.get(
    "/{consultation_id}/protocols",
    response_model=List[ConsultationProtocolRead],
)
async def get_consultation_protocols(
    consultation_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> List[ConsultationProtocolRead]:
    stmt = (
        select(ConsultationProtocols)
        .where(ConsultationProtocols.consultation_id == consultation_id)
        .order_by(ConsultationProtocols.created_at)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.put(
    "/{consultation_id}/protocols/{protocol_id}",
    response_model=ConsultationProtocolRead,
)
async def update_consultation_protocol(
    consultation_id: UUID,
    protocol_id: int,
    payload: ConsultationProtocolUpdate,
    db: AsyncSession = Depends(get_db),
) -> ConsultationProtocolRead:
    stmt = select(ConsultationProtocols).where(
        ConsultationProtocols.id == protocol_id,
        ConsultationProtocols.consultation_id == consultation_id,
    )
    result = await db.execute(stmt)
    obj = result.scalar_one_or_none()

    if obj is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Consultation protocol not found",
        )

    if payload.patient_condition is not None:
        obj.patient_condition = payload.patient_condition
    if payload.objective_data is not None:
        obj.objective_data = payload.objective_data
    if payload.consultation_conclusion is not None:
        obj.consultation_conclusion = payload.consultation_conclusion
    if payload.pathology_code is not None:
        obj.pathology_code = payload.pathology_code
    if payload.comment is not None:
        obj.comment = payload.comment

    await db.commit()
    await db.refresh(obj)

    return obj


@router.post(
    "/{consultation_id}/habits",
    response_model=ConsultationHabitRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_consultation_habit(
    consultation_id: UUID,
    payload: ConsultationHabitCreate,
    db: AsyncSession = Depends(get_db),
) -> ConsultationHabitRead:
    now = datetime.now(timezone.utc)

    obj = ConsultationHabit(
        consultation_id=consultation_id,
        bad_habits=payload.bad_habits,
        created_at=now,
    )

    db.add(obj)
    await db.commit()
    await db.refresh(obj)

    return obj


@router.get(
    "/{consultation_id}/habits",
    response_model=List[ConsultationHabitRead],
)
async def get_consultation_habits(
    consultation_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> List[ConsultationHabitRead]:
    stmt = (
        select(ConsultationHabit)
        .where(ConsultationHabit.consultation_id == consultation_id)
        .order_by(ConsultationHabit.created_at)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.put(
    "/{consultation_id}/habits/{habit_id}",
    response_model=ConsultationHabitRead,
)
async def update_consultation_habit(
    consultation_id: UUID,
    habit_id: int,
    payload: ConsultationHabitUpdate,
    db: AsyncSession = Depends(get_db),
) -> ConsultationHabitRead:
    stmt = select(ConsultationHabit).where(
        ConsultationHabit.id == habit_id,
        ConsultationHabit.consultation_id == consultation_id,
    )
    result = await db.execute(stmt)
    obj = result.scalar_one_or_none()

    if obj is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Consultation habit not found",
        )

    if payload.bad_habits is not None:
        obj.bad_habits = payload.bad_habits

    await db.commit()
    await db.refresh(obj)

    return obj


@router.post(
    "/{consultation_id}/allergy-manifestations",
    response_model=ConsultationAllergyManifestationRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_consultation_allergy_manifestation(
    consultation_id: UUID,
    payload: ConsultationAllergyManifestationCreate,
    db: AsyncSession = Depends(get_db),
) -> ConsultationAllergyManifestationRead:
    now = datetime.now(timezone.utc)

    obj = ConsultationAllergyManifestation(
        consultation_id=consultation_id,
        reaction_type=payload.reaction_type,
        clinical_manifestations=payload.clinical_manifestations,
        created_at=now,
    )

    db.add(obj)
    await db.commit()
    await db.refresh(obj)

    return obj


@router.get(
    "/{consultation_id}/allergy-manifestations",
    response_model=List[ConsultationAllergyManifestationRead],
)
async def get_consultation_allergy_manifestations(
    consultation_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> List[ConsultationAllergyManifestationRead]:
    stmt = (
        select(ConsultationAllergyManifestation)
        .where(ConsultationAllergyManifestation.consultation_id == consultation_id)
        .order_by(ConsultationAllergyManifestation.created_at)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.put(
    "/{consultation_id}/allergy-manifestations/{item_id}",
    response_model=ConsultationAllergyManifestationRead,
)
async def update_consultation_allergy_manifestation(
    consultation_id: UUID,
    item_id: int,
    payload: ConsultationAllergyManifestationUpdate,
    db: AsyncSession = Depends(get_db),
) -> ConsultationAllergyManifestationRead:
    stmt = select(ConsultationAllergyManifestation).where(
        ConsultationAllergyManifestation.id == item_id,
        ConsultationAllergyManifestation.consultation_id == consultation_id,
    )
    result = await db.execute(stmt)
    obj = result.scalar_one_or_none()

    if obj is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Consultation allergy manifestation not found",
        )

    if payload.reaction_type is not None:
        obj.reaction_type = payload.reaction_type
    if payload.clinical_manifestations is not None:
        obj.clinical_manifestations = payload.clinical_manifestations

    await db.commit()
    await db.refresh(obj)

    return obj


@router.post(
    "/{consultation_id}/vital-signs",
    response_model=ConsultationVitalSignRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_consultation_vital_sign(
    consultation_id: UUID,
    payload: ConsultationVitalSignCreate,
    db: AsyncSession = Depends(get_db),
) -> ConsultationVitalSignRead:
    now = datetime.now(timezone.utc)

    obj = ConsultationVitalSign(
        consultation_id=consultation_id,
        parameter_code=payload.parameter_code,
        unit_code=payload.unit_code,
        created_at=now,
    )

    db.add(obj)
    await db.commit()
    await db.refresh(obj)

    return obj


@router.get(
    "/{consultation_id}/vital-signs",
    response_model=List[ConsultationVitalSignRead],
)
async def get_consultation_vital_signs(
    consultation_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> List[ConsultationVitalSignRead]:
    stmt = (
        select(ConsultationVitalSign)
        .where(ConsultationVitalSign.consultation_id == consultation_id)
        .order_by(ConsultationVitalSign.created_at)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.put(
    "/{consultation_id}/vital-signs/{item_id}",
    response_model=ConsultationVitalSignRead,
)
async def update_consultation_vital_sign(
    consultation_id: UUID,
    item_id: int,
    payload: ConsultationVitalSignUpdate,
    db: AsyncSession = Depends(get_db),
) -> ConsultationVitalSignRead:
    stmt = select(ConsultationVitalSign).where(
        ConsultationVitalSign.id == item_id,
        ConsultationVitalSign.consultation_id == consultation_id,
    )
    result = await db.execute(stmt)
    obj = result.scalar_one_or_none()

    if obj is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Consultation vital sign not found",
        )

    if payload.parameter_code is not None:
        obj.parameter_code = payload.parameter_code
    if payload.unit_code is not None:
        obj.unit_code = payload.unit_code

    await db.commit()
    await db.refresh(obj)

    return obj


@router.post(
    "/{consultation_id}/clinical-scales",
    response_model=ConsultationClinicalScaleRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_consultation_clinical_scale(
    consultation_id: UUID,
    payload: ConsultationClinicalScaleCreate,
    db: AsyncSession = Depends(get_db),
) -> ConsultationClinicalScaleRead:
    now = datetime.now(timezone.utc)

    obj = ConsultationClinicalScale(
        consultation_id=consultation_id,
        scale_type=payload.scale_type,
        unit_code=payload.unit_code,
        scale_parameter=payload.scale_parameter,
        created_at=now,
    )

    db.add(obj)
    await db.commit()
    await db.refresh(obj)

    return obj


@router.get(
    "/{consultation_id}/clinical-scales",
    response_model=List[ConsultationClinicalScaleRead],
)
async def get_consultation_clinical_scales(
    consultation_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> List[ConsultationClinicalScaleRead]:
    stmt = (
        select(ConsultationClinicalScale)
        .where(ConsultationClinicalScale.consultation_id == consultation_id)
        .order_by(ConsultationClinicalScale.created_at)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.put(
    "/{consultation_id}/clinical-scales/{item_id}",
    response_model=ConsultationClinicalScaleRead,
)
async def update_consultation_clinical_scale(
    consultation_id: UUID,
    item_id: int,
    payload: ConsultationClinicalScaleUpdate,
    db: AsyncSession = Depends(get_db),
) -> ConsultationClinicalScaleRead:
    stmt = select(ConsultationClinicalScale).where(
        ConsultationClinicalScale.id == item_id,
        ConsultationClinicalScale.consultation_id == consultation_id,
    )
    result = await db.execute(stmt)
    obj = result.scalar_one_or_none()

    if obj is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Consultation clinical scale not found",
        )

    if payload.scale_type is not None:
        obj.scale_type = payload.scale_type
    if payload.unit_code is not None:
        obj.unit_code = payload.unit_code
    if payload.scale_parameter is not None:
        obj.scale_parameter = payload.scale_parameter

    await db.commit()
    await db.refresh(obj)

    return obj


@router.post(
    "/{consultation_id}/diagnoses",
    response_model=ConsultationDiagnosisRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_consultation_diagnosis(
    consultation_id: UUID,
    payload: ConsultationDiagnosisCreate,
    db: AsyncSession = Depends(get_db),
) -> ConsultationDiagnosisRead:
    now = datetime.now(timezone.utc)

    obj = ConsultationDiagnosis(
        consultation_id=consultation_id,
        diagnosis_type=payload.diagnosis_type,
        icd10_code=payload.icd10_code,
        diagnosis_validity=payload.diagnosis_validity,
        disease_nature=payload.disease_nature,
        created_at=now,
    )

    db.add(obj)
    await db.commit()
    await db.refresh(obj)

    return obj


@router.get(
    "/{consultation_id}/diagnoses",
    response_model=List[ConsultationDiagnosisRead],
)
async def get_consultation_diagnoses(
    consultation_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> List[ConsultationDiagnosisRead]:
    stmt = (
        select(ConsultationDiagnosis)
        .where(ConsultationDiagnosis.consultation_id == consultation_id)
        .order_by(ConsultationDiagnosis.created_at)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.put(
    "/{consultation_id}/diagnoses/{item_id}",
    response_model=ConsultationDiagnosisRead,
)
async def update_consultation_diagnosis(
    consultation_id: UUID,
    item_id: int,
    payload: ConsultationDiagnosisUpdate,
    db: AsyncSession = Depends(get_db),
) -> ConsultationDiagnosisRead:
    stmt = select(ConsultationDiagnosis).where(
        ConsultationDiagnosis.id == item_id,
        ConsultationDiagnosis.consultation_id == consultation_id,
    )
    result = await db.execute(stmt)
    obj = result.scalar_one_or_none()

    if obj is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Consultation diagnosis not found",
        )

    if payload.diagnosis_type is not None:
        obj.diagnosis_type = payload.diagnosis_type
    if payload.icd10_code is not None:
        obj.icd10_code = payload.icd10_code
    if payload.diagnosis_validity is not None:
        obj.diagnosis_validity = payload.diagnosis_validity
    if payload.disease_nature is not None:
        obj.disease_nature = payload.disease_nature

    await db.commit()
    await db.refresh(obj)

    return obj

