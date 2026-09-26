"""specializations, middle_name, doctor public_slug

Revision ID: 0008_specializations
Revises: 0007_clinics
Create Date: 2026-09-26 14:00:00.000000

"""

from typing import Sequence, Union

from alembic import op

revision: str = "0008_specializations"
down_revision: Union[str, None] = "0007_clinics"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS ref_specialization (
            row_id BIGSERIAL PRIMARY KEY,
            id INTEGER,
            code VARCHAR(64),
            name VARCHAR(255) NOT NULL
        )
        """
    )
    op.execute(
        "COMMENT ON TABLE ref_specialization IS "
        "'Справочник медицинских специализаций для врачей клиники'"
    )
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_ref_specialization_code "
        "ON ref_specialization (code) WHERE code IS NOT NULL"
    )

    op.execute(
        "ALTER TABLE service_user "
        "ADD COLUMN IF NOT EXISTS middle_name VARCHAR(255)"
    )

    op.execute(
        "ALTER TABLE clinic_membership "
        "ADD COLUMN IF NOT EXISTS public_slug VARCHAR(32)"
    )
    op.execute(
        """
        UPDATE clinic_membership
        SET public_slug = substr(replace(id::text, '-', ''), 1, 10)
        WHERE public_slug IS NULL
        """
    )
    op.execute(
        "ALTER TABLE clinic_membership "
        "ALTER COLUMN public_slug SET NOT NULL"
    )
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_clinic_membership_public_slug "
        "ON clinic_membership (public_slug)"
    )

    op.execute(
        "ALTER TABLE clinic_invitation "
        "ADD COLUMN IF NOT EXISTS middle_name VARCHAR(255)"
    )
    op.execute(
        "ALTER TABLE clinic_invitation "
        "ADD COLUMN IF NOT EXISTS photo_url TEXT"
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS clinic_membership_specialization (
            membership_id UUID NOT NULL
                REFERENCES clinic_membership(id) ON DELETE CASCADE,
            specialization_id INTEGER NOT NULL,
            PRIMARY KEY (membership_id, specialization_id)
        )
        """
    )
    op.execute(
        "COMMENT ON TABLE clinic_membership_specialization IS "
        "'M2M: специализации активного участника клиники'"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_cms_specialization_id "
        "ON clinic_membership_specialization (specialization_id)"
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS clinic_invitation_specialization (
            invitation_id UUID NOT NULL
                REFERENCES clinic_invitation(id) ON DELETE CASCADE,
            specialization_id INTEGER NOT NULL,
            PRIMARY KEY (invitation_id, specialization_id)
        )
        """
    )
    op.execute(
        "COMMENT ON TABLE clinic_invitation_specialization IS "
        "'M2M: специализации приглашения (копируются в membership при accept)'"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_cis_specialization_id "
        "ON clinic_invitation_specialization (specialization_id)"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS clinic_invitation_specialization")
    op.execute("DROP TABLE IF EXISTS clinic_membership_specialization")
    op.execute(
        "ALTER TABLE clinic_invitation DROP COLUMN IF EXISTS photo_url"
    )
    op.execute(
        "ALTER TABLE clinic_invitation DROP COLUMN IF EXISTS middle_name"
    )
    op.execute(
        "DROP INDEX IF EXISTS uq_clinic_membership_public_slug"
    )
    op.execute(
        "ALTER TABLE clinic_membership DROP COLUMN IF EXISTS public_slug"
    )
    op.execute(
        "ALTER TABLE service_user DROP COLUMN IF EXISTS middle_name"
    )
    op.execute("DROP TABLE IF EXISTS ref_specialization")
