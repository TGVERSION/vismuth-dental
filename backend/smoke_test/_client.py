"""Общий HTTP-клиент для manual smoke ноутбуков."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any

import requests

DEFAULT_BASE_URL = "http://localhost:8000"
DEFAULT_TIMEOUT = 30


def print_response(response: requests.Response) -> None:
    print("Status:", response.status_code)
    try:
        data = response.json()
        print("JSON:")
        print(json.dumps(data, ensure_ascii=False, indent=2))
    except Exception:
        print("Text:")
        print(response.text)


@dataclass
class SmokeContext:
    """Состояние smoke-сессии: URL, JWT, cookie jar (refresh), id сущностей."""

    base_url: str = DEFAULT_BASE_URL
    email: str = ""
    password: str = ""
    token: str | None = None
    user_id: str | None = None
    ids: dict[str, Any] = field(default_factory=dict)
    timeout: int = DEFAULT_TIMEOUT
    session: requests.Session = field(default_factory=requests.Session)

    def url(self, path: str) -> str:
        return f"{self.base_url.rstrip('/')}/{path.lstrip('/')}"

    def auth_headers(self) -> dict[str, str]:
        if not self.token:
            return {}
        return {"Authorization": f"Bearer {self.token}"}

    def require_token(self) -> bool:
        if self.token:
            return True
        print("ACCESS_TOKEN отсутствует — сначала выполните login/register.")
        return False

    def request(
        self,
        method: str,
        path: str,
        *,
        auth: bool = True,
        timeout: int | None = None,
        **kwargs: Any,
    ) -> requests.Response:
        headers = kwargs.pop("headers", {}) or {}
        if auth:
            headers = {**self.auth_headers(), **headers}
        return self.session.request(
            method,
            self.url(path),
            headers=headers,
            timeout=timeout or self.timeout,
            **kwargs,
        )

    def get(self, path: str, **kwargs: Any) -> requests.Response:
        return self.request("GET", path, **kwargs)

    def post(self, path: str, **kwargs: Any) -> requests.Response:
        return self.request("POST", path, **kwargs)

    def put(self, path: str, **kwargs: Any) -> requests.Response:
        return self.request("PUT", path, **kwargs)

    def patch(self, path: str, **kwargs: Any) -> requests.Response:
        return self.request("PATCH", path, **kwargs)

    def delete(self, path: str, **kwargs: Any) -> requests.Response:
        return self.request("DELETE", path, **kwargs)

    def set_token_from_auth_response(self, response: requests.Response) -> None:
        if not response.ok:
            print("Токен не получен.")
            return
        body = response.json()
        self.token = body.get("access_token")
        user = body.get("user") or {}
        self.user_id = user.get("id")
        if self.token:
            print("ACCESS_TOKEN сохранён (начало):", self.token[:40] + "...")
        if "refresh_token" in self.session.cookies:
            print("REFRESH cookie получена (httpOnly на браузере; здесь в Session).")
        if self.user_id:
            print("user_id:", self.user_id)


def register(ctx: SmokeContext) -> requests.Response:
    print("=== POST /auth/register ===")
    resp = ctx.post(
        "/auth/register",
        auth=False,
        json={"login": ctx.email, "password": ctx.password},
        timeout=60,
    )
    print_response(resp)
    if resp.status_code == 503:
        print("\n>>> Настройте SMTP в .env бэкенда.")
    elif resp.ok:
        print(
            "\n>>> Проверьте почту, возьмите 4 цифры кода. "
            "Задайте CODE_FROM_EMAIL и вызовите confirm_register(ctx, code)."
        )
    return resp


def confirm_register(ctx: SmokeContext, code: str) -> requests.Response:
    print("=== POST /auth/register/confirm ===")
    resp = ctx.post(
        "/auth/register/confirm",
        auth=False,
        json={"login": ctx.email, "code": code},
    )
    print_response(resp)
    ctx.set_token_from_auth_response(resp)
    return resp


def login(ctx: SmokeContext) -> requests.Response:
    print("=== POST /auth/login ===")
    resp = ctx.post(
        "/auth/login",
        auth=False,
        json={"login": ctx.email, "password": ctx.password},
    )
    print_response(resp)
    ctx.set_token_from_auth_response(resp)
    return resp


def refresh(ctx: SmokeContext) -> requests.Response:
    print("=== POST /auth/refresh ===")
    resp = ctx.post("/auth/refresh", auth=False)
    print_response(resp)
    ctx.set_token_from_auth_response(resp)
    return resp


def logout(ctx: SmokeContext) -> requests.Response | None:
    print("=== POST /auth/logout ===")
    # Logout работает по refresh cookie; Bearer не обязателен.
    resp = ctx.post("/auth/logout", auth=False)
    print_response(resp)
    if resp.ok:
        ctx.token = None
        print("\nACCESS_TOKEN очищен; refresh cookie снята сервером.")
    return resp
