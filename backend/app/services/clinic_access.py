import hashlib
import hmac
import secrets
from datetime import date, datetime, timedelta, timezone
from typing import Literal

from ..config import settings
from ..models.clinic import Clinic

AccessStatusCode = Literal["trial", "paid", "expired"]


def generate_public_slug(length: int = 10) -> str:
    alphabet = "abcdefghijklmnopqrstuvwxyz0123456789"
    return "".join(secrets.choice(alphabet) for _ in range(length))


def generate_invite_token() -> str:
    return secrets.token_urlsafe(32)


def hash_invite_token(token: str) -> str:
    return hmac.new(
        settings.jwt_secret.encode(),
        token.encode(),
        hashlib.sha256,
    ).hexdigest()


def verify_invite_token(token: str, token_hash: str) -> bool:
    expected = hash_invite_token(token)
    return hmac.compare_digest(expected, token_hash)


def invite_expires_at(now: datetime | None = None) -> datetime:
    base = now or datetime.now(timezone.utc)
    return base + timedelta(days=settings.invite_expire_days)


def build_invite_url(raw_token: str) -> str:
    base = settings.frontend_public_url.rstrip("/")
    return f"{base}/invite/accept?token={raw_token}"


def compute_access_status(
    access_until: date,
    access_type: str,
    today: date | None = None,
) -> tuple[AccessStatusCode, str]:
    day = today or date.today()
    if access_until < day:
        return "expired", "Подписка завершена"
    formatted = access_until.strftime("%d.%m.%Y")
    if access_type == "trial":
        return "trial", f"Пробный период до {formatted}"
    return "paid", f"Подписка до {formatted}"


def clinic_to_read_fields(clinic: Clinic, doctors_count: int = 0) -> dict:
    status_code, status_label = compute_access_status(
        clinic.access_until,
        clinic.access_type,
    )
    return {
        "id": clinic.id,
        "name": clinic.name,
        "phone": clinic.phone,
        "email": clinic.email,
        "logo_url": clinic.logo_url,
        "brand_color": clinic.brand_color,
        "button_color": getattr(clinic, "button_color", None),
        "doctors_limit": clinic.doctors_limit,
        "access_until": clinic.access_until,
        "access_type": clinic.access_type,
        "questionnaire_kind": clinic.questionnaire_kind,
        "public_slug": clinic.public_slug,
        "access_status_code": status_code,
        "access_status_label": status_label,
        "doctors_count": doctors_count,
        "created_at": clinic.created_at,
        "updated_at": clinic.updated_at,
        "deleted_at": clinic.deleted_at,
    }
