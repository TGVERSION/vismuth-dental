import copy
import re
from datetime import datetime, timezone
from typing import Any, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..deps import get_current_user
from ..models.consultation import Consultation
from ..models.protocol_template import ProtocolTemplateField
from ..models.service_user import ServiceUser
from ..schemas.consultation import (
    ConsultationCreate,
    ConsultationIdRead,
    ConsultationRead,
    ConsultationUpdate,
    ConsultationViewField,
    ConsultationViewPatchItem,
    ConsultationViewPatchRequest,
    ConsultationViewResponse,
)
from ..services.protocol_template_access import get_accessible_protocol_template


router = APIRouter(prefix="/consultations", tags=["consultations"])

# (атрибут модели, подпись для UI, тип в ответе view: text | datetime | integer | uuid)
_CONSULTATION_VIEW_STANDARD: list[tuple[str, str, str]] = [
    ("consultation_datetime", "Дата и время консультации", "datetime"),
    ("external_system", "Идентификатор внешней системы (EMR/МИС)", "integer"),
    ("external_patient_id", "Внешний ID пациента", "integer"),
    ("external_doctor_id", "Внешний ID врача", "integer"),
    ("external_visit_id", "Внешний ID визита/обращения", "integer"),
    ("complaints", "Жалобы", "text"),
    ("disease_anamnesis", "Анамнез заболевания", "text"),
    ("disease_history", "История заболевания", "text"),
    ("patient_condition", "Состояние пациента", "text"),
    ("life_anamnesis", "Анамнез жизни", "text"),
    ("bad_habits", "Вредные привычки и зависимости", "text"),
    ("allergy_anamnesis", "Аллергологический анамнез", "text"),
    ("vital_parameters", "Витальные параметры", "text"),
    ("objective_data", "Объективные данные", "text"),
    ("clinical_assessment", "Объективизированная оценка состояния", "text"),
    ("consultation_conclusion", "Заключение консультации", "text"),
    ("main_diagnosis", "Основной диагноз", "text"),
    ("comorbid_diagnoses", "Сопутствующие диагнозы", "text"),
    ("recommendations", "Рекомендации", "text"),
    ("prescriptions", "Назначения", "text"),
    ("protocol_name", "Название протокола", "text"),
    ("status_protocol", "Статус протокола", "text"),
    ("protocol_template_id", "Шаблон протокола", "uuid"),
]

_VIEW_KIND_BY_ATTR: dict[str, str] = {a: k for a, _, k in _CONSULTATION_VIEW_STANDARD}


def _parse_patch_datetime(value: Any) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        dt = value
    elif isinstance(value, str):
        s = value.strip()
        if not s:
            return None
        if s.endswith("Z"):
            s = s[:-1] + "+00:00"
        try:
            dt = datetime.fromisoformat(s)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid datetime: {value!r}",
            ) from None
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Datetime field must be a string (ISO 8601) or null",
        )
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def _parse_patch_integer(value: Any) -> int | None:
    if value is None:
        return None
    if isinstance(value, bool):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid integer value",
        )
    if isinstance(value, int):
        return value
    if isinstance(value, float) and value.is_integer():
        return int(value)
    if isinstance(value, str):
        t = value.strip()
        if not t:
            return None
        try:
            return int(t)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid integer: {value!r}",
            ) from None
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"Invalid integer: {value!r}",
    )


def _parse_patch_uuid(value: Any) -> UUID | None:
    if value is None:
        return None
    if isinstance(value, UUID):
        return value
    if isinstance(value, str):
        s = value.strip()
        if not s:
            return None
        try:
            return UUID(s)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid UUID: {value!r}",
            ) from None
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"Invalid UUID: {value!r}",
    )


def _coerce_patch_standard_value(kind: str, value: Any) -> Any:
    if kind == "datetime":
        return _parse_patch_datetime(value)
    if kind == "integer":
        return _parse_patch_integer(value)
    if kind == "uuid":
        return _parse_patch_uuid(value)
    if kind == "text":
        if value is None:
            return None
        if isinstance(value, str):
            return value
        return str(value)
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail=f"Unknown field kind: {kind!r}",
    )


def _apply_consultation_view_patch(
    consultation: Consultation,
    items: list[ConsultationViewPatchItem],
) -> None:
    """Обновляет атрибуты consultation и вложенные value в extra_fields."""
    for item in items:
        key = item.key
        value = item.value
        if key in _VIEW_KIND_BY_ATTR:
            kind = _VIEW_KIND_BY_ATTR[key]
            setattr(consultation, key, _coerce_patch_standard_value(kind, value))
            continue
        if re.fullmatch(r"extra_field_\d+", key):
            ef = consultation.extra_fields
            if not ef or key not in ef:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Unknown extra field: {key!r}",
                )
            blob = ef.get(key)
            if not isinstance(blob, dict):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid stored extra field: {key!r}",
                )
            new_ef = copy.deepcopy(ef)
            new_blob = dict(blob)
            new_blob["value"] = value
            new_ef[key] = new_blob
            consultation.extra_fields = new_ef
            continue
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown field key: {key!r}",
        )


def _serialize_view_value(raw: Any, kind: str) -> Any:
    if raw is None:
        return None
    if kind == "datetime":
        if isinstance(raw, datetime):
            return raw.isoformat()
        return str(raw)
    if kind == "integer":
        return int(raw)
    if kind == "uuid":
        return str(raw)
    return raw


def _normalize_extra_type(raw: Any) -> str:
    """Типы из extra_fields (TEXT, number, …) → нижний регистр для API."""
    if raw is None or raw == "":
        return "text"
    s = str(raw).strip().lower()
    if s in ("text", "string", "str", "varchar"):
        return "text"
    if s in ("number", "numeric", "float", "double", "int", "integer"):
        return "number"
    if s in ("bool", "boolean"):
        return "boolean"
    return s


def _extra_field_sort_key(key: str) -> tuple[int, int, str]:
    m = re.fullmatch(r"extra_field_(\d+)", key)
    if m:
        return (0, int(m.group(1)), "")
    return (1, 0, key)


def _consultation_to_view_response(c: Consultation) -> ConsultationViewResponse:
    fields: list[ConsultationViewField] = []
    for attr, label, kind in _CONSULTATION_VIEW_STANDARD:
        raw = getattr(c, attr, None)
        fields.append(
            ConsultationViewField(
                key=attr,
                label=label,
                type=kind,
                value=_serialize_view_value(raw, kind),
                is_extra=False,
            )
        )
    if c.extra_fields:
        for key in sorted(c.extra_fields.keys(), key=_extra_field_sort_key):
            blob = c.extra_fields[key]
            if not isinstance(blob, dict):
                continue
            fields.append(
                ConsultationViewField(
                    key=key,
                    label=str(blob.get("label") or key),
                    type=_normalize_extra_type(blob.get("type")),
                    value=blob.get("value"),
                    is_extra=True,
                )
            )
    return ConsultationViewResponse(fields=fields)


def _extra_field_storage_key(index: int) -> str:
    return f"extra_field_{index}"


def _build_extra_fields_text_only(extras: dict[str, Any]) -> dict[str, Any]:
    """Без шаблона все доп. поля с типом TEXT; ключи в JSON — extra_field_1, extra_field_2, …"""
    out: dict[str, Any] = {}
    for i, (payload_key, value) in enumerate(extras.items(), start=1):
        out[_extra_field_storage_key(i)] = {
            "label": payload_key,
            "type": "TEXT",
            "value": value,
        }
    return out


def _build_extra_fields_from_template(
    extras: dict[str, Any],
    fields: list[ProtocolTemplateField],
) -> dict[str, Any]:
    """Сопоставление с шаблоном по имени поля из тела запроса; ключи в JSON — extra_field_n."""
    by_name = {f.field_name: f for f in fields if f.field_name}
    out: dict[str, Any] = {}
    for i, (payload_key, value) in enumerate(extras.items(), start=1):
        row = by_name.get(payload_key)
        if row is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Extra field {payload_key!r} is not defined in the protocol template"
                ),
            )
        out[_extra_field_storage_key(i)] = {
            "label": row.field_name,
            "type": row.field_type,
            "value": value,
        }
    return out


def _ensure_consultation_owner(
    consultation: Consultation | None,
    user_id: UUID,
) -> Consultation:
    if consultation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Consultation not found",
        )
    if consultation.service_user != user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Consultation not found",
        )
    return consultation


@router.get(
    "",
    response_model=List[ConsultationIdRead],
)
async def list_consultations_for_user(
    current_user: ServiceUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[ConsultationIdRead]:
    stmt = (
        select(Consultation)
        .where(Consultation.service_user == current_user.id)
        .order_by(Consultation.updated_at.desc())
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
    current_user: ServiceUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ConsultationRead:
    now = datetime.now(timezone.utc)

    extras = dict(payload.model_extra or {})
    tpl_id = payload.protocol_template_id

    if tpl_id is not None:
        template = await get_accessible_protocol_template(
            db,
            template_id=tpl_id,
            user=current_user,
        )
        if template is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Protocol template not found",
            )

    stored_extra: dict[str, Any] | None = None
    if extras:
        if tpl_id is None:
            stored_extra = _build_extra_fields_text_only(extras)
        else:
            fields_stmt = select(ProtocolTemplateField).where(
                ProtocolTemplateField.protocol_template_id == tpl_id,
                ProtocolTemplateField.deleted_at.is_(None),
            )
            fields_result = await db.execute(fields_stmt)
            field_rows = list(fields_result.scalars().all())
            stored_extra = _build_extra_fields_from_template(extras, field_rows)

    consultation = Consultation(
        service_user=current_user.id,
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
        protocol_name=payload.protocol_name,
        status_protocol=payload.status_protocol or "draft",
        protocol_template_id=tpl_id,
        extra_fields=stored_extra,
        created_at=now,
        updated_at=now,
        deleted_at=None,
    )

    db.add(consultation)
    await db.commit()
    await db.refresh(consultation)

    return consultation


@router.get(
    "/{consultation_id}/view",
    response_model=ConsultationViewResponse,
)
async def get_consultation_view(
    consultation_id: UUID,
    current_user: ServiceUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ConsultationViewResponse:
    stmt = select(Consultation).where(Consultation.id == consultation_id)
    result = await db.execute(stmt)
    consultation = result.scalar_one_or_none()
    consultation = _ensure_consultation_owner(consultation, current_user.id)
    return _consultation_to_view_response(consultation)


@router.patch(
    "/{consultation_id}/view",
    response_model=ConsultationViewResponse,
)
async def patch_consultation_view(
    consultation_id: UUID,
    payload: ConsultationViewPatchRequest,
    current_user: ServiceUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ConsultationViewResponse:
    stmt = select(Consultation).where(Consultation.id == consultation_id)
    result = await db.execute(stmt)
    consultation = result.scalar_one_or_none()
    consultation = _ensure_consultation_owner(consultation, current_user.id)

    if payload.fields:
        _apply_consultation_view_patch(consultation, payload.fields)
        consultation.updated_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(consultation)

    return _consultation_to_view_response(consultation)


@router.get(
    "/{consultation_id}",
    response_model=ConsultationRead,
)
async def get_consultation(
    consultation_id: UUID,
    current_user: ServiceUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ConsultationRead:
    stmt = select(Consultation).where(Consultation.id == consultation_id)
    result = await db.execute(stmt)
    consultation = result.scalar_one_or_none()

    return _ensure_consultation_owner(consultation, current_user.id)


@router.put(
    "/{consultation_id}",
    response_model=ConsultationRead,
)
async def update_consultation(
    consultation_id: UUID,
    payload: ConsultationUpdate,
    current_user: ServiceUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ConsultationRead:
    stmt = select(Consultation).where(Consultation.id == consultation_id)
    result = await db.execute(stmt)
    consultation = result.scalar_one_or_none()
    consultation = _ensure_consultation_owner(consultation, current_user.id)

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
    if payload.protocol_name is not None:
        consultation.protocol_name = payload.protocol_name
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
    current_user: ServiceUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    stmt = select(Consultation).where(Consultation.id == consultation_id)
    result = await db.execute(stmt)
    consultation = result.scalar_one_or_none()
    consultation = _ensure_consultation_owner(consultation, current_user.id)

    await db.delete(consultation)
    await db.commit()

    return None
