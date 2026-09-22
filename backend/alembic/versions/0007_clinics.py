"""clinics, memberships, invitations

Revision ID: 0007_clinics
Revises: 0006_roles
Create Date: 2026-09-22 15:15:00.000000

"""

from typing import Sequence, Union

from alembic import op

revision: str = "0007_clinics"
down_revision: Union[str, None] = "0006_roles"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS clinic (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(255) NOT NULL,
            phone VARCHAR(64),
            email VARCHAR(255),
            logo_url TEXT,
            brand_color VARCHAR(32),
            doctors_limit INTEGER NOT NULL DEFAULT 10,
            access_until DATE NOT NULL,
            access_type VARCHAR(20) NOT NULL,
            public_slug VARCHAR(32) NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ,
            deleted_at TIMESTAMPTZ,
            CONSTRAINT clinic_access_type_check
                CHECK (access_type IN ('trial', 'paid')),
            CONSTRAINT clinic_doctors_limit_check
                CHECK (doctors_limit >= 0)
        )
        """
    )
    op.execute(
        "COMMENT ON TABLE clinic IS "
        "'Клиника (тенант): брендинг, лимит врачей, доступ до даты'"
    )
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_clinic_public_slug "
        "ON clinic (public_slug)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_clinic_deleted_at "
        "ON clinic (deleted_at)"
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS clinic_membership (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            clinic_id UUID NOT NULL REFERENCES clinic(id),
            user_id UUID NOT NULL REFERENCES service_user(id),
            is_clinic_admin BOOLEAN NOT NULL DEFAULT FALSE,
            is_doctor BOOLEAN NOT NULL DEFAULT FALSE,
            status VARCHAR(20) NOT NULL DEFAULT 'active',
            photo_url TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ,
            deleted_at TIMESTAMPTZ,
            CONSTRAINT clinic_membership_status_check
                CHECK (status IN ('active', 'deactivated')),
            CONSTRAINT clinic_membership_role_check
                CHECK (is_clinic_admin OR is_doctor)
        )
        """
    )
    op.execute(
        "COMMENT ON TABLE clinic_membership IS "
        "'Участник клиники: флаги clinic_admin / doctor, статус'"
    )
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_clinic_membership_clinic_user "
        "ON clinic_membership (clinic_id, user_id) "
        "WHERE deleted_at IS NULL"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_clinic_membership_user_id "
        "ON clinic_membership (user_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_clinic_membership_clinic_id "
        "ON clinic_membership (clinic_id)"
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS clinic_invitation (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            clinic_id UUID NOT NULL REFERENCES clinic(id),
            email VARCHAR(255) NOT NULL,
            first_name VARCHAR(255),
            last_name VARCHAR(255),
            token_hash VARCHAR(128) NOT NULL,
            is_clinic_admin BOOLEAN NOT NULL DEFAULT TRUE,
            is_doctor BOOLEAN NOT NULL DEFAULT FALSE,
            expires_at TIMESTAMPTZ NOT NULL,
            used_at TIMESTAMPTZ,
            created_by_user_id UUID REFERENCES service_user(id),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ,
            deleted_at TIMESTAMPTZ,
            CONSTRAINT clinic_invitation_role_check
                CHECK (is_clinic_admin OR is_doctor)
        )
        """
    )
    op.execute(
        "COMMENT ON TABLE clinic_invitation IS "
        "'Приглашение в клинику (token hash, TTL, used_at / soft-delete)'"
    )
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_clinic_invitation_token_hash "
        "ON clinic_invitation (token_hash)"
    )
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_clinic_invitation_pending_email "
        "ON clinic_invitation (clinic_id, lower(email)) "
        "WHERE used_at IS NULL AND deleted_at IS NULL"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_clinic_invitation_clinic_id "
        "ON clinic_invitation (clinic_id)"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS clinic_invitation")
    op.execute("DROP TABLE IF EXISTS clinic_membership")
    op.execute("DROP TABLE IF EXISTS clinic")
