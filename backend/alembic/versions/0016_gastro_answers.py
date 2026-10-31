"""Отдельные ответы первичной гастроанкеты."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0016_gastro_answers"
down_revision = "0015_dental_specializations"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("questionnaire", sa.Column("gastro_answers", postgresql.JSONB(), nullable=True))
    op.drop_constraint("ck_questionnaire_kind", "questionnaire", type_="check")
    op.create_check_constraint("ck_questionnaire_kind", "questionnaire", "kind IN ('general', 'dental', 'gastro')")


def downgrade() -> None:
    # Не теряем ответы даже у анкеты, вернувшейся к выбору врача (kind=general).
    op.execute("""
        DO $$ BEGIN
          IF EXISTS (
            SELECT 1 FROM questionnaire
            WHERE kind = 'gastro' OR gastro_answers IS NOT NULL
          ) THEN
            RAISE EXCEPTION 'Cannot downgrade: gastro questionnaire data exists; export or migrate it explicitly';
          END IF;
        END $$;
    """)
    op.drop_constraint("ck_questionnaire_kind", "questionnaire", type_="check")
    op.create_check_constraint("ck_questionnaire_kind", "questionnaire", "kind IN ('general', 'dental')")
    op.drop_column("questionnaire", "gastro_answers")
