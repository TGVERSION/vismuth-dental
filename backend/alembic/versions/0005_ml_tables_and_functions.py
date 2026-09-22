"""ml tables and functions

Revision ID: 0005_ml_tables_and_functions
Revises: 0004_protocols_and_templates
Create Date: 2026-09-22 11:48:04.000000

"""

from typing import Sequence, Union

from alembic import op

revision: str = "0005_ml_tables_and_functions"
down_revision: Union[str, None] = "0004_protocols_and_templates"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS autocomplete_stats (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES service_user(id),
            field_name VARCHAR(255),
            prefix TEXT NOT NULL,
            suggestions_count INTEGER,
            selected_text TEXT,
            event_type VARCHAR(64) NOT NULL,
            type_autocomplete VARCHAR(64),
            shown_at TIMESTAMPTZ(3) NOT NULL DEFAULT now()
        )
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_autocomplete_stats_user_id
            ON autocomplete_stats (user_id)
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_autocomplete_stats_shown_at
            ON autocomplete_stats (shown_at)
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_autocomplete_stats_field_name
            ON autocomplete_stats (field_name)
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_autocomplete_stats_event_type
            ON autocomplete_stats (event_type)
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_autocomplete_stats_type_autocomplete
            ON autocomplete_stats (type_autocomplete)
        """
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS fullness_complaints_stats (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES service_user(id),
            status VARCHAR(255),
            color VARCHAR(255),
            analysis TEXT,
            suggested_text TEXT,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ,
            deleted_at TIMESTAMPTZ
        )
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_fullness_complaints_stats_user_id
            ON fullness_complaints_stats (user_id)
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_fullness_complaints_stats_created_at
            ON fullness_complaints_stats (created_at)
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_fullness_complaints_stats_deleted_at
            ON fullness_complaints_stats (deleted_at)
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_fullness_complaints_stats_status
            ON fullness_complaints_stats (status)
        """
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS ml_response_logs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES service_user(id),
            endpoint_name VARCHAR(64) NOT NULL,
            ml_path VARCHAR(128) NOT NULL,
            http_status_code INTEGER,
            response_status VARCHAR(64) NOT NULL,
            response_comment TEXT,
            response_payload JSONB,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_ml_response_logs_user_id
            ON ml_response_logs (user_id)
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_ml_response_logs_endpoint_name
            ON ml_response_logs (endpoint_name)
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_ml_response_logs_response_status
            ON ml_response_logs (response_status)
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_ml_response_logs_created_at
            ON ml_response_logs (created_at)
        """
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS ml_unigrams (
            id SERIAL PRIMARY KEY,
            word TEXT NOT NULL UNIQUE,
            frequency INTEGER NOT NULL DEFAULT 0,
            weight FLOAT NOT NULL DEFAULT 0
        )
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS ml_bigrams (
            id SERIAL PRIMARY KEY,
            bigram TEXT NOT NULL UNIQUE,
            first_word TEXT NOT NULL,
            second_word TEXT NOT NULL,
            frequency INTEGER NOT NULL DEFAULT 0,
            weight FLOAT NOT NULL DEFAULT 0
        )
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_dict_word
            ON ml_unigrams (word text_pattern_ops)
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_dict_weight
            ON ml_unigrams (weight DESC)
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_bigram_bigram
            ON ml_bigrams (bigram text_pattern_ops)
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_bigram_first
            ON ml_bigrams (first_word text_pattern_ops)
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_bigram_weight
            ON ml_bigrams (weight DESC)
        """
    )

    op.execute(
        """
        CREATE OR REPLACE FUNCTION search_by_prefix(
            prefix TEXT, max_results INT DEFAULT 10
        )
        RETURNS TABLE(word TEXT) AS $$
        BEGIN
            RETURN QUERY
            SELECT d.word
            FROM ml_unigrams d
            WHERE d.word LIKE prefix || '%'
            ORDER BY d.weight DESC
            LIMIT max_results;
        END;
        $$ LANGUAGE plpgsql STABLE
        """
    )
    op.execute(
        """
        CREATE OR REPLACE FUNCTION predict_by_prefix(
            prefix TEXT, max_results INT DEFAULT 10
        )
        RETURNS TABLE(bigram_text TEXT) AS $$
        BEGIN
            RETURN QUERY
            SELECT b.bigram
            FROM ml_bigrams b
            WHERE b.bigram LIKE prefix || '%'
            ORDER BY b.weight DESC
            LIMIT max_results;
        END;
        $$ LANGUAGE plpgsql STABLE
        """
    )


def downgrade() -> None:
    op.execute("DROP FUNCTION IF EXISTS predict_by_prefix(TEXT, INT)")
    op.execute("DROP FUNCTION IF EXISTS search_by_prefix(TEXT, INT)")
    op.execute("DROP TABLE IF EXISTS ml_bigrams")
    op.execute("DROP TABLE IF EXISTS ml_unigrams")
    op.execute("DROP TABLE IF EXISTS ml_response_logs")
    op.execute("DROP TABLE IF EXISTS fullness_complaints_stats")
    op.execute("DROP TABLE IF EXISTS autocomplete_stats")
