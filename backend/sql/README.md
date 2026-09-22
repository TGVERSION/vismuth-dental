# SQL / migrations

Source of truth for schema: `alembic/versions/`.

## Fresh database

Backend entrypoint runs:

1. `alembic upgrade head` — create all tables/functions
2. `python sql/seed/seed_refs.py` — load `sql/seed/ref/*.csv` if `ref_mkb10` is empty

## Manual commands (from `backend/`)

```bash
alembic upgrade head
alembic downgrade -1
python sql/seed/seed_refs.py
```

## Seed data

CSV files in `sql/seed/ref/` map 1:1 to `ref_*` tables (comma-separated, UTF-8).
Loader: [`sql/seed/seed_refs.py`](seed/seed_refs.py).
`nan` / empty cells become NULL. Seed is skipped when `ref_mkb10` already has rows.

## Existing DB (created before Alembic)

Either wipe the volume (`docker compose down -v`) or stamp:

```bash
alembic stamp head
```
