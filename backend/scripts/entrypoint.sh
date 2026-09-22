#!/bin/sh
set -e

echo "[entrypoint] waiting for postgres..."
python - <<'PY'
import os, time, sys
import psycopg2

host = os.getenv("POSTGRES_HOST", "db")
port = int(os.getenv("POSTGRES_PORT", "5432"))
db = os.getenv("POSTGRES_DB", "vismuth")
user = os.getenv("POSTGRES_USER", "vismuth")
password = os.getenv("POSTGRES_PASSWORD", "vismuth_password")

for i in range(60):
    try:
        conn = psycopg2.connect(
            host=host, port=port, dbname=db, user=user, password=password,
        )
        conn.close()
        print("[entrypoint] postgres is ready")
        sys.exit(0)
    except Exception as exc:
        print(f"[entrypoint] postgres not ready ({exc}), retry {i+1}/60")
        time.sleep(1)
print("[entrypoint] postgres unavailable", file=sys.stderr)
sys.exit(1)
PY

echo "[entrypoint] alembic upgrade head"
alembic upgrade head

echo "[entrypoint] seed refs (idempotent)"
python -m scripts.seed_refs

echo "[entrypoint] starting: $*"
exec "$@"
