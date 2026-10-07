"""questionnaire.collect_form_state for /collect_form

Revision ID: 0011_collect_form_state
Revises: 0010_refresh_tokens
Create Date: 2026-10-07 21:15:00.000000

"""

from typing import Sequence, Union

from alembic import op

revision: str = "0011_collect_form_state"
down_revision: Union[str, None] = "0010_refresh_tokens"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE questionnaire "
        "ADD COLUMN IF NOT EXISTS collect_form_state JSONB"
    )
    op.execute(
        "COMMENT ON COLUMN questionnaire.collect_form_state IS "
        "'FormProgress from ml-service /collect_form; not exposed to API'"
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE questionnaire DROP COLUMN IF EXISTS collect_form_state"
    )
