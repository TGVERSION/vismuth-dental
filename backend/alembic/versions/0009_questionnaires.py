"""questionnaires and protocol link

Revision ID: 0009_questionnaires
Revises: 0008_specializations
Create Date: 2026-09-26 15:00:00.000000

"""

from typing import Sequence, Union

from alembic import op

revision: str = "0009_questionnaires"
down_revision: Union[str, None] = "0008_specializations"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS questionnaire (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            clinic_id UUID NOT NULL REFERENCES clinic(id),
            doctor_membership_id UUID REFERENCES clinic_membership(id),
            specialization_id INTEGER,
            visit_type VARCHAR(20),
            status VARCHAR(20) NOT NULL DEFAULT 'in_progress',
            current_step VARCHAR(64) NOT NULL DEFAULT 'choose_doctor',
            ai_questions_count INTEGER NOT NULL DEFAULT 0,
            ai_unavailable BOOLEAN NOT NULL DEFAULT FALSE,
            patient_first_name VARCHAR(255),
            patient_middle_name VARCHAR(255),
            appointment_date DATE,
            appointment_time VARCHAR(16),
            code CHAR(4),
            session_token_hash VARCHAR(128) NOT NULL,
            device_id_hash VARCHAR(128),
            ip_hash VARCHAR(128),
            last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            completed_at TIMESTAMPTZ,
            protocol_id UUID UNIQUE REFERENCES protocols(id) ON DELETE SET NULL,
            structured JSONB,
            gaps JSONB,
            processing_status VARCHAR(32),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ,
            CONSTRAINT questionnaire_status_check
                CHECK (status IN ('in_progress', 'completed', 'abandoned')),
            CONSTRAINT questionnaire_visit_type_check
                CHECK (
                    visit_type IS NULL
                    OR visit_type IN ('primary', 'repeat')
                )
        )
        """
    )
    op.execute(
        "COMMENT ON TABLE questionnaire IS "
        "'Анкета пациента до приёма: шаги, код, связь с протоколом'"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_questionnaire_clinic_completed "
        "ON questionnaire (clinic_id, completed_at)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_questionnaire_doctor_date "
        "ON questionnaire (doctor_membership_id, appointment_date)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_questionnaire_status_activity "
        "ON questionnaire (status, last_activity_at)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_questionnaire_clinic_created "
        "ON questionnaire (clinic_id, created_at)"
    )
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_questionnaire_clinic_code_window "
        "ON questionnaire (clinic_id, code) "
        "WHERE code IS NOT NULL AND status = 'completed'"
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS questionnaire_answer (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            questionnaire_id UUID NOT NULL
                REFERENCES questionnaire(id) ON DELETE CASCADE,
            seq INTEGER NOT NULL,
            step_key VARCHAR(64) NOT NULL,
            kind VARCHAR(32) NOT NULL,
            question_text TEXT,
            answer_text TEXT,
            choice VARCHAR(64),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT questionnaire_answer_kind_check
                CHECK (
                    kind IN (
                        'fixed',
                        'ai_question',
                        'answer',
                        'skip'
                    )
                )
        )
        """
    )
    op.execute(
        "COMMENT ON TABLE questionnaire_answer IS "
        "'Ответы и реплики ИИ в анкете (порядок seq)'"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_questionnaire_answer_qid "
        "ON questionnaire_answer (questionnaire_id, seq)"
    )

    op.execute(
        "ALTER TABLE protocols "
        "ADD COLUMN IF NOT EXISTS source_questionnaire_id UUID "
        "REFERENCES questionnaire(id) ON DELETE SET NULL"
    )
    op.execute(
        "ALTER TABLE protocols "
        "ADD COLUMN IF NOT EXISTS created_from_questionnaire "
        "BOOLEAN NOT NULL DEFAULT FALSE"
    )
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_protocols_source_questionnaire "
        "ON protocols (source_questionnaire_id) "
        "WHERE source_questionnaire_id IS NOT NULL"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_protocols_source_questionnaire")
    op.execute(
        "ALTER TABLE protocols "
        "DROP COLUMN IF EXISTS created_from_questionnaire"
    )
    op.execute(
        "ALTER TABLE protocols "
        "DROP COLUMN IF EXISTS source_questionnaire_id"
    )
    op.execute("DROP TABLE IF EXISTS questionnaire_answer")
    op.execute("DROP TABLE IF EXISTS questionnaire")
