"""Ручная проверка SMTP (не HTTP API)."""

from __future__ import annotations

import smtplib
from dataclasses import dataclass
from email.mime.text import MIMEText


@dataclass
class SmtpConfig:
    host: str = "smtp.yandex.ru"
    port: int = 465
    email: str = ""
    password: str = ""
    to_email: str = ""
    subject: str = "Test"
    body: str = "Test email"


def send_test_email(cfg: SmtpConfig) -> None:
    if not cfg.email or not cfg.password or not cfg.to_email:
        raise ValueError("Заполните email, password и to_email в SmtpConfig.")

    msg = MIMEText(cfg.body)
    msg["Subject"] = cfg.subject
    msg["From"] = cfg.email
    msg["To"] = cfg.to_email

    with smtplib.SMTP_SSL(cfg.host, cfg.port) as server:
        server.login(cfg.email, cfg.password)
        server.send_message(msg)

    print("Email sent!")
