"""clinrec_guideline catalog + mkb mapping

Revision ID: 0012_clinrec_guidelines
Revises: 0011_collect_form_state
Create Date: 2026-10-21 20:40:00.000000

"""

from typing import Sequence, Union

from alembic import op

revision: str = "0012_clinrec_guidelines"
down_revision: Union[str, None] = "0011_collect_form_state"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS clinrec_guideline (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            code VARCHAR(64) NOT NULL,
            source_id INTEGER NOT NULL,
            title VARCHAR(500) NOT NULL,
            short_title VARCHAR(255),
            status VARCHAR(20) NOT NULL DEFAULT 'draft',
            version VARCHAR(64) NOT NULL,
            s3_bucket VARCHAR(255) NOT NULL,
            s3_key VARCHAR(512) NOT NULL,
            index_error TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ,
            CONSTRAINT clinrec_guideline_status_check
                CHECK (status IN (
                    'draft', 'uploaded', 'indexing',
                    'active', 'failed', 'disabled'
                ))
        )
        """
    )
    op.execute(
        "COMMENT ON TABLE clinrec_guideline IS "
        "'Каталог клинических рекомендаций: текущая версия PDF в S3'"
    )
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_clinrec_guideline_code "
        "ON clinrec_guideline (code)"
    )
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_clinrec_guideline_source_id "
        "ON clinrec_guideline (source_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_clinrec_guideline_status "
        "ON clinrec_guideline (status)"
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS clinrec_guideline_mkb (
            guideline_id UUID NOT NULL
                REFERENCES clinrec_guideline(id) ON DELETE CASCADE,
            mkb_prefix VARCHAR(20) NOT NULL,
            PRIMARY KEY (guideline_id, mkb_prefix)
        )
        """
    )
    op.execute(
        "COMMENT ON TABLE clinrec_guideline_mkb IS "
        "'Префиксы МКБ → guideline; глобально уникальный префикс'"
    )
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_clinrec_guideline_mkb_prefix "
        "ON clinrec_guideline_mkb (mkb_prefix)"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS clinrec_guideline_mkb")
    op.execute("DROP TABLE IF EXISTS clinrec_guideline")
