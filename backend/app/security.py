import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from uuid import UUID

from jose import JWTError, jwt
from passlib.context import CryptContext

from .config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def verify_password(plain: str, password_hash: str) -> bool:
    return pwd_context.verify(plain, password_hash)


def generate_registration_code() -> str:
    return f"{secrets.randbelow(10000):04d}"


def hash_registration_code(login: str, code: str) -> str:
    msg = f"{login.lower().strip()}|{code}".encode()
    digest = hmac.new(
        settings.jwt_secret.encode(),
        msg,
        hashlib.sha256,
    ).hexdigest()
    return digest


def verify_registration_code(login: str, code: str, code_hash: str) -> bool:
    expected = hash_registration_code(login, code)
    return hmac.compare_digest(expected, code_hash)


def create_access_token(subject: UUID, extra_claims: Optional[dict[str, Any]] = None) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.access_token_expire_minutes,
    )
    to_encode: dict[str, Any] = {
        "sub": str(subject),
        "exp": expire,
        "type": "access",
    }
    if extra_claims:
        to_encode.update(extra_claims)
    return jwt.encode(
        to_encode,
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )


def decode_access_token(token: str) -> dict[str, Any]:
    return jwt.decode(
        token,
        settings.jwt_secret,
        algorithms=[settings.jwt_algorithm],
    )


def decode_access_token_sub(token: str) -> UUID:
    try:
        payload = decode_access_token(token)
        if payload.get("type") != "access":
            raise JWTError("wrong token type")
        sub = payload.get("sub")
        if not sub:
            raise JWTError("missing sub")
        return UUID(sub)
    except (JWTError, ValueError) as e:
        raise JWTError(str(e)) from e
