#!/usr/bin/env bash
# Download Minzdrav clinical recommendation PDFs into local S3 (Silo).
# Usage (from anywhere):
#   ./scripts/clinrec/run_download.sh
#   ./scripts/clinrec/run_download.sh --limit 5
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VISMUTH_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
cd "${VISMUTH_ROOT}"

if [[ -f "${VISMUTH_ROOT}/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${VISMUTH_ROOT}/.env"
  set +a
fi

# Compose uses http://minio:9000; this script runs on the host.
if [[ "${S3_ENDPOINT_URL:-}" == *"minio:9000"* ]]; then
  export S3_ENDPOINT_URL="http://127.0.0.1:${MINIO_API_PORT:-9000}"
  echo "S3_ENDPOINT_URL remapped for host: ${S3_ENDPOINT_URL}"
fi

export S3_PRESIGN_ENDPOINT_URL="${S3_PRESIGN_ENDPOINT_URL:-${S3_ENDPOINT_URL}}"
export S3_BUCKET="${S3_BUCKET:-vismuth-clinrec}"
export S3_REGION="${S3_REGION:-us-east-1}"
export S3_ADDRESSING_STYLE="${S3_ADDRESSING_STYLE:-path}"

if [[ -z "${S3_ACCESS_KEY:-}" || -z "${S3_SECRET_KEY:-}" ]]; then
  echo "error: S3_ACCESS_KEY / S3_SECRET_KEY not set. Copy .env.template → .env" >&2
  exit 1
fi

VENV_DIR="${SCRIPT_DIR}/.venv"
PYTHON_BIN="${VENV_DIR}/bin/python"

if [[ ! -x "${PYTHON_BIN}" ]]; then
  echo "creating venv at ${VENV_DIR}"
  python3 -m venv "${VENV_DIR}"
  "${PYTHON_BIN}" -m pip install --upgrade pip
  "${PYTHON_BIN}" -m pip install -r "${SCRIPT_DIR}/requirements.txt"
elif [[ "${CLINREC_FORCE_PIP:-}" == "1" ]]; then
  "${PYTHON_BIN}" -m pip install -r "${SCRIPT_DIR}/requirements.txt"
fi

echo "checking S3 at ${S3_ENDPOINT_URL} bucket=${S3_BUCKET} ..."
if ! "${PYTHON_BIN}" - <<'PY'
import os, sys
import boto3
from botocore.client import Config

endpoint = os.environ["S3_ENDPOINT_URL"]
client = boto3.client(
    "s3",
    endpoint_url=endpoint,
    aws_access_key_id=os.environ["S3_ACCESS_KEY"],
    aws_secret_access_key=os.environ["S3_SECRET_KEY"],
    region_name=os.environ.get("S3_REGION", "us-east-1"),
    config=Config(s3={"addressing_style": os.environ.get("S3_ADDRESSING_STYLE", "path")}),
)
bucket = os.environ.get("S3_BUCKET", "vismuth-clinrec")
try:
    client.head_bucket(Bucket=bucket)
except Exception as e:
    print(f"S3 check failed: {e}", file=sys.stderr)
    print("Start local storage: docker compose up -d minio minio-init", file=sys.stderr)
    sys.exit(1)
print("S3 check ok")
PY
then
  exit 1
fi

exec "${PYTHON_BIN}" "${SCRIPT_DIR}/download_to_s3.py" "$@"
