"""Stable public addresses for managed doctor portraits in private storage."""
from uuid import UUID

from fastapi import HTTPException

from ..config import settings
from .s3 import get_s3_client


def doctor_photo_key(membership_id: UUID, version: UUID) -> str:
    return f'clinic-assets/doctor-photos/{membership_id}/{version}.png'


def doctor_photo_url(membership_id: UUID, version: UUID) -> str:
    return f'{settings.frontend_public_url.rstrip("/")}/api/main/public/doctor-photos/{membership_id}/{version}.png'


def read_doctor_photo(membership_id: UUID, version: UUID) -> bytes:
    try:
        result = get_s3_client().get_object(Bucket=settings.s3_bucket, Key=doctor_photo_key(membership_id, version))
        try:
            return result['Body'].read()
        finally:
            result['Body'].close()
    except Exception as exc:
        raise HTTPException(404, 'Фотография недоступна') from exc
