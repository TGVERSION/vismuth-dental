"""protocol catalog

Revision ID: 0003_protocol_catalog
Revises: 0002_users_and_auth
Create Date: 2026-09-22 11:48:02.000000

"""

from typing import Sequence, Union

from alembic import op

revision: str = "0003_protocol_catalog"
down_revision: Union[str, None] = "0002_users_and_auth"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS protocol_fields_main (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            field_name VARCHAR(255),
            field_label VARCHAR(255),
            description TEXT,
            endpoint_link VARCHAR(255),
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ,
            deleted_at TIMESTAMPTZ
        )
        """
    )
    op.execute(
        "COMMENT ON TABLE protocol_fields_main IS "
        "'Справочник ключевых полей протокола для автодополнения'"
    )
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS idx_protocol_fields_main_field_name_unique
            ON protocol_fields_main (field_name)
            WHERE deleted_at IS NULL
        """
    )
    op.execute(
        """
        INSERT INTO protocol_fields_main (
            field_name,
            field_label,
            description,
            endpoint_link
        )
        VALUES
            ('complaints', 'Жалобы', 'Жалобы пациента', NULL),
            ('disease_anamnesis', 'Анамнез заболевания', 'Анамнез заболевания', NULL),
            ('disease_history', 'История заболевания', 'История заболевания', NULL),
            ('patient_condition', 'Состояние пациента', 'Состояние пациента', NULL),
            ('life_anamnesis', 'Анамнез жизни', 'Анамнез жизни', NULL),
            ('bad_habits', 'Вредные привычки и зависимости',
             'Вредные привычки и зависимости', NULL),
            ('allergy_anamnesis', 'Аллергологический анамнез',
             'Аллергологический анамнез', NULL),
            ('vital_parameters', 'Витальные параметры', 'Витальные параметры', NULL),
            ('objective_data', 'Объективные данные', 'Объективные данные', NULL),
            ('clinical_assessment', 'Объективизированная оценка состояния',
             'Объективизированная оценка состояния', NULL),
            ('consultation_conclusion', 'Заключение консультации',
             'Заключение консультации', NULL),
            ('main_diagnosis', 'Основной диагноз', 'Основной диагноз', NULL),
            ('comorbid_diagnoses', 'Сопутствующие диагнозы',
             'Сопутствующие диагнозы', NULL),
            ('recommendations', 'Рекомендации', 'Рекомендации', NULL),
            ('prescriptions', 'Назначения', 'Назначения', NULL)
        ON CONFLICT (field_name) WHERE deleted_at IS NULL DO NOTHING
        """
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS protocol_structures (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            creator_id UUID NOT NULL REFERENCES service_user (id),
            structure_code VARCHAR(255) NOT NULL,
            structure_name VARCHAR(500) NOT NULL,
            description TEXT,
            version INTEGER NOT NULL DEFAULT 1,
            is_active BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ,
            deleted_at TIMESTAMPTZ
        )
        """
    )
    op.execute(
        "COMMENT ON TABLE protocol_structures IS "
        "'Версионируемые структуры протоколов'"
    )
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS idx_protocol_structures_code_version_unique
            ON protocol_structures (structure_code, version)
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_protocol_structures_creator_id
            ON protocol_structures (creator_id)
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_protocol_structures_is_active
            ON protocol_structures (is_active)
        """
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS protocol_structures_fields (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            protocol_structure_id UUID NOT NULL
                REFERENCES protocol_structures (id) ON DELETE CASCADE,
            field_name VARCHAR(255) NOT NULL,
            field_label VARCHAR(500),
            description TEXT,
            field_type VARCHAR(255) NOT NULL,
            default_value TEXT,
            default_value_jsonb JSONB,
            dictionary VARCHAR(255),
            protocol_fields_main_id UUID REFERENCES protocol_fields_main (id),
            is_required BOOLEAN NOT NULL DEFAULT false,
            sort_order INTEGER NOT NULL DEFAULT 0
        )
        """
    )
    op.execute(
        "COMMENT ON TABLE protocol_structures_fields IS "
        "'Поля внутри версии protocol_structures'"
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_protocol_structures_fields_structure_id
            ON protocol_structures_fields (protocol_structure_id)
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_protocol_structures_fields_sort
            ON protocol_structures_fields (protocol_structure_id, sort_order)
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_protocol_structures_fields_protocol_fields_main_id
            ON protocol_structures_fields (protocol_fields_main_id)
        """
    )
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS idx_protocol_structures_fields_name_unique
            ON protocol_structures_fields (protocol_structure_id, field_name)
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS protocol_structures_fields")
    op.execute("DROP TABLE IF EXISTS protocol_structures")
    op.execute("DROP TABLE IF EXISTS protocol_fields_main")
