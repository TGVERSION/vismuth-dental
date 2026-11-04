"""Клиника с многопрофильными и стоматологическими анкетами одновременно.

Revision ID: 0017_clinic_mixed
Revises: 0016_gastro_answers
"""

from typing import Sequence, Union

from alembic import op

revision: str = "0017_clinic_mixed"
down_revision: Union[str, None] = "0016_gastro_answers"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint("ck_clinic_questionnaire_kind", "clinic", type_="check")
    op.create_check_constraint(
        "ck_clinic_questionnaire_kind", "clinic",
        "questionnaire_kind IN ('general', 'dental', 'mixed')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_clinic_questionnaire_kind", "clinic", type_="check")
    # Старый backend не умеет mixed. Сохраняем клиники и все анкеты,
    # возвращая комбинированные клиники к обычному направлению.
    op.execute("UPDATE clinic SET questionnaire_kind = 'general' WHERE questionnaire_kind = 'mixed'")
    op.create_check_constraint(
        "ck_clinic_questionnaire_kind", "clinic",
        "questionnaire_kind IN ('general', 'dental')",
    )
