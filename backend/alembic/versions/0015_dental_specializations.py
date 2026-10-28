"""Врачи-стоматологи в справочнике специализаций

Revision ID: 0015_dental_specializations
Revises: 0014_questionnaire_invites
Create Date: 2026-10-28 12:00:00.000000

Новая база получает строки из sql/seed/ref/ref_specialization.csv: seed
заполняет только пустую таблицу. Поэтому миграция добавляет строки лишь в уже
заполненный справочник — иначе seed пропустил бы остальные специализации.
"""

from typing import Sequence, Union

from alembic import op

revision: str = "0015_dental_specializations"
down_revision: Union[str, None] = "0014_questionnaire_invites"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Номенклатура специальностей Минздрава (стоматология); общий «Стоматолог»
# (id 19) уже есть.
DENTAL = (
    (21, "dentist_general_practice", "Стоматолог общей практики"),
    (22, "dentist_therapist", "Стоматолог-терапевт"),
    (23, "dentist_surgeon", "Стоматолог-хирург"),
    (24, "dentist_orthopedist", "Стоматолог-ортопед"),
    (25, "orthodontist", "Ортодонт"),
    (26, "dentist_pediatric", "Стоматолог детский"),
    (27, "maxillofacial_surgeon", "Челюстно-лицевой хирург"),
)


def upgrade() -> None:
    for spec_id, code, name in DENTAL:
        op.execute(
            f"""
            INSERT INTO ref_specialization (id, code, name)
            SELECT {spec_id}, '{code}', '{name}'
            WHERE EXISTS (SELECT 1 FROM ref_specialization)
              AND NOT EXISTS (SELECT 1 FROM ref_specialization WHERE code = '{code}')
            """
        )


def downgrade() -> None:
    codes = ", ".join(f"'{code}'" for _, code, _ in DENTAL)
    op.execute(f"DELETE FROM ref_specialization WHERE code IN ({codes})")
