"""extensions and ref tables

Revision ID: 0001_extensions_and_ref_tables
Revises:
Create Date: 2026-09-22 11:48:00.000000

"""

from typing import Sequence, Union

from alembic import op

revision: str = "0001_extensions_and_ref_tables"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS dictionary (
            id BIGSERIAL PRIMARY KEY,
            oid VARCHAR(255) NOT NULL UNIQUE,
            name VARCHAR(255) NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ,
            deleted_at TIMESTAMPTZ
        )
        """
    )
    op.execute(
        "COMMENT ON TABLE dictionary IS "
        "'Связь OID справочника с названием таблицы в схеме'"
    )
    op.execute(
        """
        INSERT INTO dictionary (oid, name) VALUES
            ('1.2.643.5.1.13.13.11.1006', 'ref_patient_condition'),
            ('1.2.643.5.1.13.13.11.1473', 'ref_pathology'),
            ('1.2.643.5.1.13.13.11.1058', 'ref_bad_habits'),
            ('1.2.643.5.1.13.13.11.1064', 'ref_allergy_reaction_type'),
            ('1.2.643.5.1.13.13.11.1063', 'ref_allergy_manifestation'),
            ('1.2.643.5.1.13.13.99.2.262', 'ref_vital_parameter'),
            ('1.2.643.5.1.13.13.11.1358', 'ref_unit'),
            ('1.2.643.5.1.13.13.11.1514', 'ref_scale_type'),
            ('1.2.643.5.1.13.13.11.1515', 'ref_scale_parameter'),
            ('1.2.643.5.1.13.13.11.1077', 'ref_diagnosis_nosology_type'),
            ('1.2.643.5.1.13.13.11.1005', 'ref_mkb10'),
            ('1.2.643.5.1.13.13.99.2.795', 'ref_diagnosis_justification'),
            ('1.2.643.5.1.13.13.11.1049', 'ref_disease_character')
        ON CONFLICT (oid) DO NOTHING
        """
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS ref_patient_condition (
            row_id BIGSERIAL PRIMARY KEY,
            id INTEGER,
            name VARCHAR(255),
            sctid VARCHAR(50),
            sort INTEGER,
            syn VARCHAR(255)
        )
        """
    )
    op.execute(
        "COMMENT ON TABLE ref_patient_condition IS "
        "'OID: 1.2.643.5.1.13.13.11.1006. Состояние пациента'"
    )
    op.execute(
        "COMMENT ON COLUMN ref_patient_condition.id IS "
        "'Идентификатор из справочника (CSV), не менять'"
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS ref_pathology (
            row_id BIGSERIAL PRIMARY KEY,
            id INTEGER,
            fullname VARCHAR(500),
            anatom_loc INTEGER,
            type_pat INTEGER,
            method VARCHAR(255),
            snomed_ct VARCHAR(50)
        )
        """
    )
    op.execute(
        "COMMENT ON TABLE ref_pathology IS "
        "'OID: 1.2.643.5.1.13.13.11.1473. Выявленные патологии'"
    )
    op.execute(
        "COMMENT ON COLUMN ref_pathology.id IS "
        "'Идентификатор из справочника (CSV), не менять'"
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS ref_bad_habits (
            row_id BIGSERIAL PRIMARY KEY,
            id INTEGER,
            name VARCHAR(255),
            rel BOOLEAN,
            sctid VARCHAR(50),
            synonym VARCHAR(255)
        )
        """
    )
    op.execute(
        "COMMENT ON TABLE ref_bad_habits IS "
        "'OID: 1.2.643.5.1.13.13.11.1058. Вредные привычки и зависимости'"
    )
    op.execute(
        "COMMENT ON COLUMN ref_bad_habits.id IS "
        "'Идентификатор из справочника (CSV), не менять'"
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS ref_allergy_reaction_type (
            row_id BIGSERIAL PRIMARY KEY,
            id INTEGER,
            name VARCHAR(255),
            parent INTEGER,
            sctid VARCHAR(100)
        )
        """
    )
    op.execute(
        "COMMENT ON TABLE ref_allergy_reaction_type IS "
        "'OID: 1.2.643.5.1.13.13.11.1064. Тип реакции'"
    )
    op.execute(
        "COMMENT ON COLUMN ref_allergy_reaction_type.id IS "
        "'Идентификатор из справочника (CSV), не менять'"
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS ref_allergy_manifestation (
            row_id BIGSERIAL PRIMARY KEY,
            id INTEGER,
            name VARCHAR(255),
            name_syn VARCHAR(500),
            sctid VARCHAR(50)
        )
        """
    )
    op.execute(
        "COMMENT ON TABLE ref_allergy_manifestation IS "
        "'OID: 1.2.643.5.1.13.13.11.1063. Клинические проявления'"
    )
    op.execute(
        "COMMENT ON COLUMN ref_allergy_manifestation.id IS "
        "'Идентификатор из справочника (CSV), не менять'"
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS ref_vital_parameter (
            row_id BIGSERIAL PRIMARY KEY,
            id INTEGER,
            name VARCHAR(255),
            synonym VARCHAR(255),
            localization VARCHAR(255),
            measurement VARCHAR(100),
            method VARCHAR(100),
            unit_code VARCHAR(20),
            data_type VARCHAR(20),
            oid VARCHAR(100),
            id_parametr INTEGER
        )
        """
    )
    op.execute(
        "COMMENT ON TABLE ref_vital_parameter IS "
        "'OID: 1.2.643.5.1.13.13.99.2.262. Код параметра витальных'"
    )
    op.execute(
        "COMMENT ON COLUMN ref_vital_parameter.id IS "
        "'Идентификатор из справочника (CSV), не менять'"
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS ref_unit (
            row_id BIGSERIAL PRIMARY KEY,
            id INTEGER,
            fullname VARCHAR(255),
            shortname VARCHAR(50),
            printname VARCHAR(50),
            measurement VARCHAR(100),
            ucum VARCHAR(50),
            coefficient VARCHAR(50),
            formula TEXT,
            conversion_id INTEGER,
            conversion_name VARCHAR(100),
            okei_code VARCHAR(20),
            nsi_code_eec VARCHAR(50),
            nsi_element_code_eec VARCHAR(50)
        )
        """
    )
    op.execute(
        "COMMENT ON TABLE ref_unit IS "
        "'OID: 1.2.643.5.1.13.13.11.1358. Единицы измерения'"
    )
    op.execute(
        "COMMENT ON COLUMN ref_unit.id IS "
        "'Идентификатор из справочника (CSV), не менять'"
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS ref_scale_type (
            row_id BIGSERIAL PRIMARY KEY,
            id INTEGER,
            name VARCHAR(500),
            name_eng VARCHAR(500),
            abbreviation VARCHAR(50),
            oid_parameter VARCHAR(100),
            id_parameter INTEGER,
            oid_interpretation VARCHAR(100),
            id_interpretation INTEGER,
            point_scale BOOLEAN,
            valid INTEGER,
            valid_author TEXT,
            valid_doi VARCHAR(255),
            org VARCHAR(500)
        )
        """
    )
    op.execute(
        "COMMENT ON TABLE ref_scale_type IS "
        "'OID: 1.2.643.5.1.13.13.11.1514. Тип клинической шкалы'"
    )
    op.execute(
        "COMMENT ON COLUMN ref_scale_type.id IS "
        "'Идентификатор из справочника (CSV), не менять'"
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS ref_scale_parameter (
            row_id BIGSERIAL PRIMARY KEY,
            id INTEGER,
            parent_id INTEGER,
            name TEXT,
            vital_parameter VARCHAR(255),
            point INTEGER,
            id_interpretation INTEGER,
            grouping_scale INTEGER
        )
        """
    )
    op.execute(
        "COMMENT ON TABLE ref_scale_parameter IS "
        "'OID: 1.2.643.5.1.13.13.11.1515. Параметр клинической шкалы'"
    )
    op.execute(
        "COMMENT ON COLUMN ref_scale_parameter.id IS "
        "'Идентификатор из справочника (CSV), не менять'"
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS ref_diagnosis_nosology_type (
            row_id BIGSERIAL PRIMARY KEY,
            id INTEGER,
            full_name VARCHAR(255),
            name_088_488_551 VARCHAR(255),
            short_name VARCHAR(100)
        )
        """
    )
    op.execute(
        "COMMENT ON TABLE ref_diagnosis_nosology_type IS "
        "'OID: 1.2.643.5.1.13.13.11.1077. Вид нозологической единицы диагноза'"
    )
    op.execute(
        "COMMENT ON COLUMN ref_diagnosis_nosology_type.id IS "
        "'Идентификатор из справочника (CSV), не менять'"
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS ref_mkb10 (
            row_id BIGSERIAL PRIMARY KEY,
            id INTEGER,
            rec_code VARCHAR(50),
            mkb_code VARCHAR(20),
            mkb_name VARCHAR(500),
            id_parent INTEGER,
            addl_code VARCHAR(50),
            actual INTEGER,
            date_column DATE
        )
        """
    )
    op.execute(
        "COMMENT ON TABLE ref_mkb10 IS "
        "'OID: 1.2.643.5.1.13.13.11.1005. Код диагноза по МКБ-10'"
    )
    op.execute(
        "COMMENT ON COLUMN ref_mkb10.id IS "
        "'Идентификатор из справочника (CSV), не менять'"
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS ref_diagnosis_justification (
            row_id BIGSERIAL PRIMARY KEY,
            id INTEGER,
            id_parent INTEGER,
            name VARCHAR(255),
            sort INTEGER
        )
        """
    )
    op.execute(
        "COMMENT ON TABLE ref_diagnosis_justification IS "
        "'OID: 1.2.643.5.1.13.13.99.2.795. Степень обоснованности диагноза'"
    )
    op.execute(
        "COMMENT ON COLUMN ref_diagnosis_justification.id IS "
        "'Идентификатор из справочника (CSV), не менять'"
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS ref_disease_character (
            row_id BIGSERIAL PRIMARY KEY,
            id INTEGER,
            name VARCHAR(255)
        )
        """
    )
    op.execute(
        "COMMENT ON TABLE ref_disease_character IS "
        "'OID: 1.2.643.5.1.13.13.11.1049. Характер заболевания'"
    )
    op.execute(
        "COMMENT ON COLUMN ref_disease_character.id IS "
        "'Идентификатор из справочника (CSV), не менять'"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS ref_disease_character")
    op.execute("DROP TABLE IF EXISTS ref_diagnosis_justification")
    op.execute("DROP TABLE IF EXISTS ref_mkb10")
    op.execute("DROP TABLE IF EXISTS ref_diagnosis_nosology_type")
    op.execute("DROP TABLE IF EXISTS ref_scale_parameter")
    op.execute("DROP TABLE IF EXISTS ref_scale_type")
    op.execute("DROP TABLE IF EXISTS ref_unit")
    op.execute("DROP TABLE IF EXISTS ref_vital_parameter")
    op.execute("DROP TABLE IF EXISTS ref_allergy_manifestation")
    op.execute("DROP TABLE IF EXISTS ref_allergy_reaction_type")
    op.execute("DROP TABLE IF EXISTS ref_bad_habits")
    op.execute("DROP TABLE IF EXISTS ref_pathology")
    op.execute("DROP TABLE IF EXISTS ref_patient_condition")
    op.execute("DROP TABLE IF EXISTS dictionary")
