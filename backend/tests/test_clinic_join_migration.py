"""Migration roundtrip on an explicit isolated PostgreSQL, always rolled back."""

import importlib.util
import os
from pathlib import Path

from alembic.migration import MigrationContext
from alembic.operations import Operations
import pytest
from sqlalchemy import create_engine, text

from app.db import Base
from app import models  # noqa: F401


def _module():
    path = Path(__file__).parents[1] / 'alembic' / 'versions' / '0018_clinic_join.py'
    spec = importlib.util.spec_from_file_location('join_migration', path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_join_migration_revision_follows_existing_head():
    migration = _module()
    assert migration.down_revision == '0017_clinic_mixed'
    assert len(migration.revision) <= 32


@pytest.mark.skipif(not os.getenv('CLINIC_JOIN_TEST_DATABASE_URL'), reason='Requires isolated test PostgreSQL')
def test_join_migration_empty_roundtrip_and_safe_populated_downgrade():
    url = os.environ['CLINIC_JOIN_TEST_DATABASE_URL']
    assert '127.0.0.1:' in url and '/clinic_join_test' in url
    engine = create_engine(url.replace('+asyncpg', '+psycopg2'))
    try:
        with engine.connect() as connection:
            transaction = connection.begin()
            try:
                Base.metadata.create_all(connection)
                # Reconstruct pre-0018 shape inside a rollback-only transaction.
                connection.execute(text('DROP TABLE clinic_join_request, clinic_join_link'))
                connection.execute(text('ALTER TABLE clinic_membership DROP CONSTRAINT IF EXISTS clinic_membership_role_check'))
                # The deployed schema carries this CHECK from migration 0007;
                # ORM create_all alone did not reproduce it in the first test fixture.
                connection.execute(text('UPDATE clinic_membership SET is_doctor=true WHERE NOT is_doctor AND NOT is_clinic_admin'))
                connection.execute(text('ALTER TABLE clinic_membership DROP COLUMN is_operator'))
                connection.execute(text('ALTER TABLE service_user DROP COLUMN clinic_join_restricted'))
                connection.execute(text('ALTER TABLE registration_pending DROP COLUMN clinic_join_context'))
                connection.execute(text('ALTER TABLE clinic_membership ADD CONSTRAINT clinic_membership_role_check CHECK (is_clinic_admin OR is_doctor)'))
                migration = _module()
                with Operations.context(MigrationContext.configure(connection)):
                    migration.upgrade()
                    definition = connection.execute(text("SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname='clinic_membership_role_check' AND conrelid='clinic_membership'::regclass")).scalar_one()
                    assert 'is_operator' in definition
                    # Drop any data only in this transaction to exercise EMPTY downgrade.
                    connection.execute(text('UPDATE service_user SET clinic_join_restricted = false'))
                    connection.execute(text('UPDATE clinic_membership SET is_operator = false'))
                    migration.downgrade()
                    definition = connection.execute(text("SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname='clinic_membership_role_check' AND conrelid='clinic_membership'::regclass")).scalar_one()
                    assert 'is_operator' not in definition
                    migration.upgrade()
                    connection.execute(text("""
                        INSERT INTO service_user (id,login,password_hash,is_active,clinic_join_restricted,created_at)
                        VALUES ('00000000-0000-0000-0000-000000000018','migration-only@example.test','unused',true,true,now())
                    """))
                    with pytest.raises(Exception, match='(?i)(downgrade|откат|данн|join|оператор|restricted)'):
                        migration.downgrade()
            finally:
                transaction.rollback()
    finally:
        engine.dispose()
