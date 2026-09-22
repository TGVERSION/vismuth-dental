"""roles catalog and service_user_role

Revision ID: 0006_roles
Revises: 0005_ml_tables_and_functions
Create Date: 2026-09-22 13:10:00.000000

"""

from typing import Sequence, Union

from alembic import op

revision: str = "0006_roles"
down_revision: Union[str, None] = "0005_ml_tables_and_functions"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS role (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(50) UNIQUE NOT NULL,
            name_ru VARCHAR(100) NOT NULL
        )
        """
    )
    op.execute(
        "COMMENT ON TABLE role IS "
        "'Справочник ролей сервиса (super_admin, admin, doctor, patient)'"
    )
    op.execute(
        "COMMENT ON COLUMN role.name IS 'Код роли (латиница)'"
    )
    op.execute(
        "COMMENT ON COLUMN role.name_ru IS 'Отображаемое имя роли (кириллица)'"
    )
    op.execute(
        """
        INSERT INTO role (name, name_ru)
        VALUES
            ('super_admin', 'Супер-админ'),
            ('admin', 'Админ'),
            ('doctor', 'Врач'),
            ('patient', 'Пациент')
        ON CONFLICT (name) DO NOTHING
        """
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS service_user_role (
            user_id UUID PRIMARY KEY REFERENCES service_user(id) ON DELETE CASCADE,
            role_id UUID NOT NULL REFERENCES role(id)
        )
        """
    )
    op.execute(
        "COMMENT ON TABLE service_user_role IS "
        "'Связь пользователь ↔ роль (пока 1 роль на пользователя: PK = user_id)'"
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_service_user_role_role_id
            ON service_user_role (role_id)
        """
    )

    op.execute(
        """
        INSERT INTO service_user_role (user_id, role_id)
        SELECT
            su.id,
            r.id
        FROM service_user su
        INNER JOIN role r ON r.name = CASE
            WHEN su.role = 'doctor' THEN 'doctor'
            WHEN su.role = 'administrator' THEN 'admin'
            WHEN su.role = 'head_of_department' THEN 'admin'
            WHEN su.role = 'admin' THEN 'admin'
            WHEN su.role = 'super_admin' THEN 'super_admin'
            WHEN su.role = 'patient' THEN 'patient'
            ELSE 'admin'
        END
        ON CONFLICT (user_id) DO NOTHING
        """
    )

    op.execute("ALTER TABLE service_user DROP COLUMN IF EXISTS role")


def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE service_user
            ADD COLUMN IF NOT EXISTS role VARCHAR(50) NOT NULL DEFAULT 'doctor'
        """
    )
    op.execute(
        """
        UPDATE service_user su
        SET role = COALESCE(r.name, 'doctor')
        FROM service_user_role sur
        LEFT JOIN role r ON r.id = sur.role_id
        WHERE sur.user_id = su.id
        """
    )
    op.execute("DROP TABLE IF EXISTS service_user_role")
    op.execute("DROP TABLE IF EXISTS role")
