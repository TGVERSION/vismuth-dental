"""Проверяем эффективный CHECK миграции, не подключаясь к рабочей БД."""
import importlib.util
import sqlite3
from pathlib import Path
from unittest.mock import MagicMock

import pytest


def migration(monkeypatch):
    path = Path(__file__).parents[1] / "alembic" / "versions" / "0016_gastro_answers.py"
    spec = importlib.util.spec_from_file_location("gastro_migration", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    op = MagicMock()
    monkeypatch.setattr(module, "op", op)
    return module, op


def test_migration_check_accepts_gastro_and_retains_existing_kinds(monkeypatch):
    module, op = migration(monkeypatch)
    module.upgrade()
    checks = [call.args for call in op.create_check_constraint.call_args_list]
    assert checks, "Migration must replace the old general/dental-only CHECK"
    name, table, expression = checks[0]
    assert name == "ck_questionnaire_kind" and table == "questionnaire"
    db = sqlite3.connect(":memory:")
    db.execute(f"CREATE TABLE questionnaire (kind TEXT CHECK ({expression}))")
    for kind in ("general", "dental", "gastro"):
        db.execute("INSERT INTO questionnaire VALUES (?)", (kind,))
    with pytest.raises(sqlite3.IntegrityError):
        db.execute("INSERT INTO questionnaire VALUES ('unknown')")


def test_downgrade_guards_existing_gastro_data_before_dropping_column(monkeypatch):
    module, op = migration(monkeypatch)
    module.downgrade()
    calls = op.mock_calls
    first_sql = str(calls[0].args[0])
    assert "RAISE EXCEPTION" in first_sql
    assert "gastro_answers IS NOT NULL" in first_sql
    assert "kind = 'gastro'" in first_sql
    assert op.drop_column.call_count == 1
