"""Проверка назначений ДМС по клиническим рекомендациям."""

from .errors import DmsError
from .pipeline import verify_appointments

__all__ = ["DmsError", "verify_appointments"]
