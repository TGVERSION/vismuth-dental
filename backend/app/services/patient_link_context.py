"""Подписанные параметры записи без создания пациента до открытия ссылки."""
import base64
import hashlib
import hmac
import json
from datetime import date, timedelta
from uuid import UUID

from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, Field

from ..config import settings


class PatientLinkSelection(BaseModel):
    model_config = ConfigDict(extra='forbid')
    doctor_membership_id: UUID | None = None
    appointment_date: date | None = None
    appointment_time: str | None = Field(default=None, pattern=r'^([01]\d|2[0-3]):[0-5]\d$')


class SignedAppointment(PatientLinkSelection):
    clinic_id: UUID


def validate_appointment_date(value: date | None) -> None:
    if value and not date.today() <= value <= date.today() + timedelta(days=settings.questionnaire_appointment_days_ahead):
        raise HTTPException(400, 'Дата приёма вне доступного периода')


def encode_appointment(clinic_id: UUID, selection: PatientLinkSelection) -> str:
    value = SignedAppointment(clinic_id=clinic_id, **selection.model_dump())
    body = base64.urlsafe_b64encode(json.dumps(value.model_dump(mode='json'), sort_keys=True, separators=(',', ':')).encode()).decode().rstrip('=')
    signature = hmac.new(settings.jwt_secret.encode(), ('patient-appointment:v1:'+body).encode(), hashlib.sha256).hexdigest()
    return 'a1.' + body + '.' + signature


def decode_appointment(slug: str) -> SignedAppointment | None:
    if not slug.startswith('a1.'):
        return None
    try:
        if len(slug) > 1024:
            raise ValueError()
        prefix, body, signature = slug.split('.')
        expected = hmac.new(settings.jwt_secret.encode(), ('patient-appointment:v1:'+body).encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature.encode(), expected.encode()):
            raise ValueError()
        return SignedAppointment.model_validate_json(base64.urlsafe_b64decode(body+'='*(-len(body)%4)))
    except Exception:
        raise HTTPException(404, 'Ссылка записи недоступна') from None


def merge_appointment(questionnaire, appointment_date, appointment_time):
    preset = (questionnaire.gastro_answers or {}).get('appointment_context', {})
    if preset.get('appointment_date'):
        value = date.fromisoformat(preset['appointment_date'])
        if appointment_date is not None and appointment_date != value:
            raise HTTPException(409, 'Дата приёма задана в ссылке')
        appointment_date = value
    if preset.get('appointment_time'):
        value = preset['appointment_time']
        if appointment_time is not None and appointment_time != value:
            raise HTTPException(409, 'Время приёма задано в ссылке')
        appointment_time = value
    return appointment_date, appointment_time
