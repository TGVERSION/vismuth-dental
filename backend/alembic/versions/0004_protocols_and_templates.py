"""protocols and templates

Revision ID: 0004_protocols_and_templates
Revises: 0003_protocol_catalog
Create Date: 2026-09-22 11:48:03.000000

"""

from typing import Sequence, Union

from alembic import op

revision: str = "0004_protocols_and_templates"
down_revision: Union[str, None] = "0003_protocol_catalog"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS protocols (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            service_user UUID REFERENCES service_user (id),
            protocol_structure_id UUID
                REFERENCES protocol_structures(id) ON DELETE SET NULL,
            patient_id INTEGER,
            doctor_id UUID REFERENCES service_user (id),
            protocol_name VARCHAR(255),
            status_protocol VARCHAR(255),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ,
            deleted_at TIMESTAMPTZ
        )
        """
    )
    op.execute(
        "COMMENT ON TABLE protocols IS "
        "'Экземпляр протокола по выбранной структуре'"
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_protocols_service_user
            ON protocols (service_user)
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_protocols_patient_id
            ON protocols (patient_id)
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_protocols_doctor_id
            ON protocols (doctor_id)
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_protocols_protocol_structure_id
            ON protocols (protocol_structure_id)
        """
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS protocol_fields (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            protocol_id UUID NOT NULL REFERENCES protocols (id) ON DELETE CASCADE,
            field_id UUID NOT NULL REFERENCES protocol_structures_fields (id),
            field_value TEXT
        )
        """
    )
    op.execute(
        "COMMENT ON TABLE protocol_fields IS "
        "'Значения полей экземпляра протокола "
        "(связь с определением поля в protocol_structures_fields)'"
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_protocol_fields_protocol_id
            ON protocol_fields (protocol_id)
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_protocol_fields_field_id
            ON protocol_fields (field_id)
        """
    )
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS idx_protocol_fields_protocol_field_unique
            ON protocol_fields (protocol_id, field_id)
        """
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS template_group (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            group_name VARCHAR(255),
            creator_id UUID REFERENCES service_user(id),
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ,
            deleted_at TIMESTAMPTZ
        )
        """
    )
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS idx_template_group_creator_group_name_unique
            ON template_group (creator_id, lower(group_name))
            WHERE deleted_at IS NULL
        """
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS protocol_template (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            protocol_name VARCHAR(255),
            group_id UUID REFERENCES template_group(id),
            creator_id UUID REFERENCES service_user(id),
            protocol_structure_id UUID
                REFERENCES protocol_structures(id) ON DELETE SET NULL,
            privacy VARCHAR(255),
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ,
            deleted_at TIMESTAMPTZ
        )
        """
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS protocol_template_fields (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            protocol_template_id UUID REFERENCES protocol_template(id),
            field_name VARCHAR(255),
            field_type VARCHAR(255),
            field_value TEXT,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ,
            deleted_at TIMESTAMPTZ
        )
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS protocol_template_fields")
    op.execute("DROP TABLE IF EXISTS protocol_template")
    op.execute("DROP TABLE IF EXISTS template_group")
    op.execute("DROP TABLE IF EXISTS protocol_fields")
    op.execute("DROP TABLE IF EXISTS protocols")
