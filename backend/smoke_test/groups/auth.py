"""Auth helpers — register/confirm остаются интерактивными в notebook."""

from __future__ import annotations

from _client import SmokeContext, confirm_register, login, logout, register

__all__ = ["register", "confirm_register", "login", "logout", "run_login", "run_logout"]


def run_login(ctx: SmokeContext) -> None:
    login(ctx)


def run_logout(ctx: SmokeContext) -> None:
    logout(ctx)
