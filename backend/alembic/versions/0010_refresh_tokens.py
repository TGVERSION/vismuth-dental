"""refresh_token table

Revision ID: 0010_refresh_tokens
Revises: 0009_questionnaires
Create Date: 2026-10-06 11:50:00.000000

"""

from typing import Sequence, Union

from alembic import op

revision: str = "0010_refresh_tokens"
down_revision: Union[str, None] = "0009_questionnaires"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS refresh_token (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES service_user(id) ON DELETE CASCADE,
            token_hash TEXT NOT NULL UNIQUE,
            expires_at TIMESTAMPTZ NOT NULL,
            revoked_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            replaced_by_id UUID REFERENCES refresh_token(id) ON DELETE SET NULL
        )
        """
    )
    op.execute(
        "COMMENT ON TABLE refresh_token IS "
        "'Opaque refresh tokens (hash only); httpOnly cookie on client'"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_refresh_token_user_id "
        "ON refresh_token (user_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_refresh_token_user_active "
        "ON refresh_token (user_id) "
        "WHERE revoked_at IS NULL"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS refresh_token CASCADE")
