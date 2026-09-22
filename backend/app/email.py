import smtplib
from email.mime.text import MIMEText

from .config import settings


def _require_smtp() -> None:
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


def send_registration_code(to_email: str, code: str) -> None:
    _require_smtp()

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


def send_clinic_invite(to_email: str, clinic_name: str, invite_url: str) -> None:
    _require_smtp()

    body = (
        f"Вас пригласили в клинику «{clinic_name}» как администратора.\n\n"
        f"Перейдите по ссылке, чтобы задать пароль и активировать аккаунт:\n"
        f"{invite_url}\n\n"
        f"Ссылка действует {settings.invite_expire_days} дней.\n"
        "Если вы не ожидали это письмо, проигнорируйте его."
    )
    msg = MIMEText(body, "plain", "utf-8")
    msg["Subject"] = f"Приглашение в клинику «{clinic_name}»"
    msg["From"] = settings.smtp_from
    msg["To"] = to_email

    with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port) as server:
        server.login(settings.smtp_user, settings.smtp_password)
        server.send_message(msg)
