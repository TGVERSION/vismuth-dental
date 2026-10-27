"""Персональная ссылка на анкету: статус invited, ФИО, срок, печать и подпись

Revision ID: 0014_questionnaire_invites
Revises: 0013_dental_questionnaire
Create Date: 2026-10-26 20:00:00.000000

"""

from typing import Sequence, Union

from alembic import op

revision: str = "0014_questionnaire_invites"
down_revision: Union[str, None] = "0013_dental_questionnaire"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE questionnaire DROP CONSTRAINT IF EXISTS questionnaire_status_check")
    op.execute(
        "ALTER TABLE questionnaire ADD CONSTRAINT questionnaire_status_check "
        "CHECK (status IN ('invited', 'in_progress', 'completed', 'abandoned'))"
    )
    op.execute(
        "ALTER TABLE questionnaire "
        "ADD COLUMN IF NOT EXISTS patient_last_name VARCHAR(255), "
        "ADD COLUMN IF NOT EXISTS invite_expires_at TIMESTAMPTZ, "
        "ADD COLUMN IF NOT EXISTS created_by_membership_id UUID "
        "REFERENCES clinic_membership(id) ON DELETE SET NULL, "
        "ADD COLUMN IF NOT EXISTS printed_at TIMESTAMPTZ, "
        "ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ"
    )
    op.execute(
        "COMMENT ON COLUMN questionnaire.invite_expires_at IS "
        "'Personal link from registry: link works until; unfinished rows are deleted after'"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_questionnaire_clinic_appointment "
        "ON questionnaire (clinic_id, appointment_date)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_questionnaire_invite_token "
        "ON questionnaire (session_token_hash) WHERE invite_expires_at IS NOT NULL"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_questionnaire_invite_expires "
        "ON questionnaire (invite_expires_at) WHERE invite_expires_at IS NOT NULL"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_questionnaire_invite_expires")
    op.execute("DROP INDEX IF EXISTS idx_questionnaire_invite_token")
    op.execute("DROP INDEX IF EXISTS idx_questionnaire_clinic_appointment")
    op.execute("DELETE FROM questionnaire WHERE status = 'invited'")
    op.execute(
        "ALTER TABLE questionnaire "
        "DROP COLUMN IF EXISTS signed_at, "
        "DROP COLUMN IF EXISTS printed_at, "
        "DROP COLUMN IF EXISTS created_by_membership_id, "
        "DROP COLUMN IF EXISTS invite_expires_at, "
        "DROP COLUMN IF EXISTS patient_last_name"
    )
    op.execute("ALTER TABLE questionnaire DROP CONSTRAINT IF EXISTS questionnaire_status_check")
    op.execute(
        "ALTER TABLE questionnaire ADD CONSTRAINT questionnaire_status_check "
        "CHECK (status IN ('in_progress', 'completed', 'abandoned'))"
    )
