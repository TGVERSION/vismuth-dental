from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, status
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
    ConsultationCreate,
    ConsultationDiagnosisCreate,
    ConsultationDiagnosisRead,
    ConsultationHabitCreate,
    ConsultationHabitRead,
    ConsultationProtocolCreate,
    ConsultationProtocolRead,
    ConsultationRead,
    ConsultationVitalSignCreate,
    ConsultationVitalSignRead,
)


router = APIRouter(prefix="/consultations", tags=["consultations"])


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

