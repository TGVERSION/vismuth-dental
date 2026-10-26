"""Стоматологическая анкета: тип анкеты у клиники и у анкеты, ответы JSONB

Revision ID: 0013_dental_questionnaire
Revises: 0012_clinrec_guidelines
Create Date: 2026-10-26 18:00:00.000000

"""

from typing import Sequence, Union

from alembic import op

revision: str = "0013_dental_questionnaire"
down_revision: Union[str, None] = "0012_clinrec_guidelines"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE clinic ADD COLUMN IF NOT EXISTS questionnaire_kind "
        "VARCHAR(20) NOT NULL DEFAULT 'general'"
    )
    op.execute(
        "ALTER TABLE clinic ADD CONSTRAINT ck_clinic_questionnaire_kind "
        "CHECK (questionnaire_kind IN ('general', 'dental'))"
    )
    op.execute(
        "ALTER TABLE questionnaire ADD COLUMN IF NOT EXISTS kind "
        "VARCHAR(20) NOT NULL DEFAULT 'general'"
    )
    op.execute(
        "ALTER TABLE questionnaire ADD CONSTRAINT ck_questionnaire_kind "
        "CHECK (kind IN ('general', 'dental'))"
    )
    op.execute(
        "ALTER TABLE questionnaire ADD COLUMN IF NOT EXISTS dental_answers JSONB"
    )
    op.execute(
        "COMMENT ON COLUMN questionnaire.dental_answers IS "
        "'DentalAnswers (services/dental/flow.py); wiped when abandoned'"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE questionnaire DROP COLUMN IF EXISTS dental_answers")
    op.execute("ALTER TABLE questionnaire DROP CONSTRAINT IF EXISTS ck_questionnaire_kind")
    op.execute("ALTER TABLE questionnaire DROP COLUMN IF EXISTS kind")
    op.execute("ALTER TABLE clinic DROP CONSTRAINT IF EXISTS ck_clinic_questionnaire_kind")
    op.execute("ALTER TABLE clinic DROP COLUMN IF EXISTS questionnaire_kind")
