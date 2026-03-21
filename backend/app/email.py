import smtplib
from email.mime.text import MIMEText

from .config import settings


def send_registration_code(to_email: str, code: str) -> None:
    if not all(
        [
            settings.smtp_host,
            settings.smtp_user,
            settings.smtp_password,
            settings.smtp_from,
        ],
    ):
        raise RuntimeError(
            "SMTP is not configured (SMTP_HOST, SMTP_USER, SMTP_PASSWORD, SMTP_FROM)",
        )

    body = (
        f"Код подтверждения регистрации: {code}\n\n"
        "Если вы не запрашивали регистрацию, проигнорируйте это письмо."
    )
    msg = MIMEText(body, "plain", "utf-8")
    msg["Subject"] = "Подтверждение регистрации"
    msg["From"] = settings.smtp_from
    msg["To"] = to_email

    with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port) as server:
        server.login(settings.smtp_user, settings.smtp_password)
        server.send_message(msg)
