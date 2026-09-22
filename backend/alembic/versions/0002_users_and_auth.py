"""users and auth

Revision ID: 0002_users_and_auth
Revises: 0001_extensions_and_ref_tables
Create Date: 2026-09-22 11:48:01.000000

"""

from typing import Sequence, Union

from alembic import op

revision: str = "0002_users_and_auth"
down_revision: Union[str, None] = "0001_extensions_and_ref_tables"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS service_user (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            login VARCHAR(255) UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            first_name VARCHAR(255),
            last_name VARCHAR(255),
            role VARCHAR(50) NOT NULL DEFAULT 'doctor',
            is_active BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ,
            deleted_at TIMESTAMPTZ
        )
        """
    )
    op.execute(
        "COMMENT ON TABLE service_user IS "
        "'Пользователи сервиса (администраторы, операторы системы)'"
    )
    op.execute(
        "COMMENT ON COLUMN service_user.password_hash IS "
        "'Хэш пароля пользователя'"
    )
    op.execute(
        "COMMENT ON COLUMN service_user.role IS 'Роль пользователя сервиса'"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_service_user_email ON service_user (login)"
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS registration_pending (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            login VARCHAR(255) NOT NULL,
            password_hash TEXT NOT NULL,
            code_hash TEXT NOT NULL,
            expires_at TIMESTAMPTZ NOT NULL,
            code_attempts SMALLINT NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ DEFAULT now()
        )
        """
    )
    op.execute(
        "COMMENT ON TABLE registration_pending IS "
        "'Временные заявки на регистрацию до подтверждения email; "
        "после успеха — запись в service_user, строка удаляется'"
    )
    op.execute(
        "COMMENT ON COLUMN registration_pending.login IS "
        "'Email пользователя; совпадает с будущим service_user.login'"
    )
    op.execute(
        "COMMENT ON COLUMN registration_pending.code_attempts IS "
        "'Число неудачных попыток ввода кода (защита от перебора)'"
    )
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS idx_registration_pending_login
            ON registration_pending (login)
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_registration_pending_expires_at
            ON registration_pending (expires_at)
        """
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS user_settings (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL UNIQUE REFERENCES service_user(id) ON DELETE CASCADE,
            mkb_code BOOLEAN NOT NULL DEFAULT true,
            autocomplete VARCHAR(64) NOT NULL DEFAULT 'dict_autocomplete',
            fullness_complaints BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ
        )
        """
    )
    op.execute(
        "COMMENT ON TABLE user_settings IS "
        "'Настройки ИИ-помощников (МКБ-10, автодополнение, проверка полноты) "
        "для конкретного пользователя'"
    )
    op.execute(
        "COMMENT ON COLUMN user_settings.mkb_code IS "
        "'Включён ли подбор кода диагноза МКБ-10'"
    )
    op.execute(
        "COMMENT ON COLUMN user_settings.autocomplete IS "
        "'Тип автодополнения текста: ml_autocomplete | dict_autocomplete | off "
        "(выключено)'"
    )
    op.execute(
        "COMMENT ON COLUMN user_settings.fullness_complaints IS "
        "'Включена ли проверка полноты полей (жалобы)'"
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_user_settings_user_id
            ON user_settings (user_id)
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS user_settings")
    op.execute("DROP TABLE IF EXISTS registration_pending")
    op.execute("DROP TABLE IF EXISTS service_user")
