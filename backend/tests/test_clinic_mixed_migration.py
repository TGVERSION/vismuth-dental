"""CHECK клиники принимает оба направления; откат сохраняет анкеты пациентов."""

import importlib.util
import sqlite3
from pathlib import Path
from unittest.mock import MagicMock

import pytest


def _migration(monkeypatch):
    path = Path(__file__).parents[1] / "alembic" / "versions" / "0017_clinic_mixed.py"
    spec = importlib.util.spec_from_file_location("clinic_mixed_migration", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    op = MagicMock()
    monkeypatch.setattr(module, "op", op)
    return module, op


def test_upgrade_expands_only_clinic_direction_constraint(monkeypatch):
    module, op = _migration(monkeypatch)
    assert module.down_revision == "0016_gastro_answers"
    assert len(module.revision) <= 32
    module.upgrade()
    op.drop_constraint.assert_called_once_with("ck_clinic_questionnaire_kind", "clinic", type_="check")
    name, table, expression = op.create_check_constraint.call_args.args
    assert name == "ck_clinic_questionnaire_kind" and table == "clinic"
    with sqlite3.connect(":memory:") as db:
        db.execute(f"CREATE TABLE clinic (questionnaire_kind TEXT CHECK ({expression}))")
        for kind in ("general", "dental", "mixed"):
            db.execute("INSERT INTO clinic VALUES (?)", (kind,))
        with pytest.raises(sqlite3.IntegrityError):
            db.execute("INSERT INTO clinic VALUES ('unknown')")
    op.drop_column.assert_not_called()


def test_downgrade_converts_mixed_before_restoring_old_constraint(monkeypatch):
    module, op = _migration(monkeypatch)
    module.downgrade()
    assert op.mock_calls[0].args == ("ck_clinic_questionnaire_kind", "clinic")
    sql = str(op.execute.call_args.args[0])
    assert "UPDATE clinic" in sql and "'general'" in sql and "'mixed'" in sql
    assert [call[0] for call in op.mock_calls] == ["drop_constraint", "execute", "create_check_constraint"]
    _, table, expression = op.create_check_constraint.call_args.args
    assert table == "clinic" and "mixed" not in expression
    op.drop_column.assert_not_called()
