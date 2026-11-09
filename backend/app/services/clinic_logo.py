"""Validated clinic images in existing private S3 storage."""
from io import BytesIO
import logging
from uuid import UUID

from fastapi import HTTPException

from ..config import settings
from .s3 import get_s3_client

MAX_LOGO_BYTES = 5 * 1024 * 1024
logger = logging.getLogger(__name__)


def normalize_logo(data: bytes) -> bytes:
    from PIL import Image, UnidentifiedImageError
    if not data or len(data) > MAX_LOGO_BYTES:
        raise HTTPException(413, 'Изображение должно быть не больше 5 МБ')
    try:
        with Image.open(BytesIO(data), formats=['PNG', 'JPEG', 'WEBP']) as source:
            if source.width > 4096 or source.height > 4096:
                raise HTTPException(422, 'Размер изображения не должен превышать 4096×4096')
            source.seek(0)
            source.load()
            source.thumbnail((1200, 600))
            image = Image.new('RGBA', source.size)
            image.paste(source.convert('RGBA'))
            output = BytesIO()
            image.save(output, format='PNG')
            return output.getvalue()
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError) as exc:
        raise HTTPException(422, 'Выберите корректное изображение PNG, JPEG или WebP') from exc


def logo_key(clinic_id: UUID, version: UUID) -> str:
    return f'clinic-assets/logos/{clinic_id}/{version}.png'


def logo_url(clinic_id: UUID, version: UUID) -> str:
    return f'{settings.frontend_public_url.rstrip("/")}/api/main/public/clinic-logos/{clinic_id}/{version}.png'


def save_logo(clinic_id: UUID, version: UUID, image: bytes) -> None:
    try:
        get_s3_client().put_object(Bucket=settings.s3_bucket, Key=logo_key(clinic_id, version),
                                   Body=image, ContentType='image/png')
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(502, 'Не удалось сохранить логотип. Попробуйте ещё раз') from exc


def read_logo(clinic_id: UUID, version: UUID) -> bytes:
    try:
        response = get_s3_client().get_object(Bucket=settings.s3_bucket, Key=logo_key(clinic_id, version))
        try:
            return response['Body'].read()
        finally:
            response['Body'].close()
    except Exception as exc:
        raise HTTPException(404, 'Логотип недоступен') from exc


def delete_logo(clinic_id: UUID, version: UUID) -> None:
    try:
        get_s3_client().delete_object(Bucket=settings.s3_bucket, Key=logo_key(clinic_id, version))
    except Exception:
        logger.warning('Could not remove unused clinic logo', exc_info=True)
