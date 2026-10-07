# SQL / migrations

Source of truth for schema: `alembic/versions/`.

Current head: `0011_collect_form_state` (после `0010_refresh_tokens`).

## Fresh database

Backend entrypoint runs:

1. `alembic upgrade head` — create all tables/functions
2. `python sql/seed/seed_refs.py` — load `sql/seed/ref/*.csv` for each **empty** `ref_*` table

## Manual commands (from `backend/`)

```bash
alembic upgrade head
alembic downgrade -1
python sql/seed/seed_refs.py
```

## Seed data

CSV files in `sql/seed/ref/` map 1:1 to `ref_*` tables (comma-separated, UTF-8).
Loader: [`sql/seed/seed_refs.py`](seed/seed_refs.py).
`nan` / empty cells become NULL. Seed is **per-table**: non-empty tables are skipped, empty ones (e.g. newly added `ref_specialization`) are filled.

## Existing DB (created before Alembic)

Either wipe the volume (`docker compose down -v`) or stamp:

```bash
alembic stamp head
```
