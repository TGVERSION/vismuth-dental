#!/usr/bin/env python3
"""Seed ref_* tables from sql/seed/ref/*.csv. Skips if ref_mkb10 already has rows."""

from __future__ import annotations

import csv
import io
import sys
from pathlib import Path

import psycopg2
from psycopg2 import sql

from app.config import settings

SEED_DIR = Path(__file__).resolve().parent / "ref"

REF_TABLES = [
    "ref_patient_condition",
    "ref_pathology",
    "ref_bad_habits",
    "ref_allergy_reaction_type",
    "ref_allergy_manifestation",
    "ref_vital_parameter",
    "ref_unit",
    "ref_scale_type",
    "ref_scale_parameter",
    "ref_diagnosis_nosology_type",
    "ref_mkb10",
    "ref_diagnosis_justification",
    "ref_disease_character",
]

NULL_TOKENS = {"", "nan", "NaN", "NAN", "None", "none", "NULL", "null"}


def _normalize_cell(value: str | None) -> str | None:
    if value is None:
        return None
    text = value.strip()
    if text in NULL_TOKENS:
        return None
    # CSV sometimes exports SCTID as "24484000.0"
    if text.endswith(".0") and text[:-2].lstrip("-").isdigit():
        return text[:-2]
    return text


def _table_has_rows(cur, table: str) -> bool:
    cur.execute(
        sql.SQL("SELECT EXISTS (SELECT 1 FROM {} LIMIT 1)").format(
            sql.Identifier(table),
        ),
    )
    return bool(cur.fetchone()[0])


def _copy_csv(cur, table: str, csv_path: Path) -> int:
    with csv_path.open(newline="", encoding="utf-8") as raw:
        reader = csv.DictReader(raw)
        if not reader.fieldnames:
            raise ValueError(f"No header in {csv_path}")
        columns = list(reader.fieldnames)
        buf = io.StringIO()
        writer = csv.DictWriter(buf, fieldnames=columns, lineterminator="\n")
        writer.writeheader()
        count = 0
        for row in reader:
            cleaned = {k: _normalize_cell(row.get(k)) for k in columns}
            writer.writerow(cleaned)
            count += 1

    buf.seek(0)
    col_list = sql.SQL(", ").join(sql.Identifier(c) for c in columns)
    copy_sql = sql.SQL(
        "COPY {} ({}) FROM STDIN WITH (FORMAT csv, HEADER true, NULL '')",
    ).format(sql.Identifier(table), col_list)
    cur.copy_expert(copy_sql.as_string(cur), buf)

    # Reset BIGSERIAL sequence for row_id after explicit import
    cur.execute(
        sql.SQL(
            "SELECT setval(pg_get_serial_sequence(%s, 'row_id'), "
            "COALESCE((SELECT MAX(row_id) FROM {}), 1), true)",
        ).format(sql.Identifier(table)),
        (table,),
    )
    return count


def main() -> int:
    if not SEED_DIR.is_dir():
        print(f"Seed directory not found: {SEED_DIR}", file=sys.stderr)
        return 1

    conn = psycopg2.connect(settings.database_url_sync)
    conn.autocommit = False
    try:
        with conn.cursor() as cur:
            if _table_has_rows(cur, "ref_mkb10"):
                print("ref_mkb10 already has data — skip seed")
                return 0

            total = 0
            for table in REF_TABLES:
                csv_path = SEED_DIR / f"{table}.csv"
                if not csv_path.exists():
                    print(f"WARNING: missing {csv_path}, skip")
                    continue
                if _table_has_rows(cur, table):
                    print(f"{table}: already has data — skip")
                    continue
                n = _copy_csv(cur, table, csv_path)
                print(f"{table}: inserted {n} rows")
                total += n

            conn.commit()
            print(f"Seed complete, {total} rows total")
            return 0
    except Exception as exc:
        conn.rollback()
        print(f"Seed failed: {exc}", file=sys.stderr)
        return 1
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
