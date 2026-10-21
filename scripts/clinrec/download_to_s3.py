#!/usr/bin/env python3
"""Download clinical recommendation PDFs from Minzdrav into local S3 (Silo/MinIO).

Catalog: probe source_id 1..max_id, keep the highest valid revision per id.
Object key: guidelines/{source_id}/{revision}/source.pdf

Idempotent: skip put when head_object ContentLength matches remote size.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import boto3
import httpx
from botocore.client import Config
from botocore.exceptions import ClientError
from dotenv import load_dotenv

PDF_API = "https://apicr.minzdrav.gov.ru/api.ashx"
USER_AGENT = "vismuth-clinrec-loader/1.0"
PDF_MAGIC = b"%PDF"
SCRIPT_DIR = Path(__file__).resolve().parent
CACHE_DIR = SCRIPT_DIR / ".cache"
MANIFEST_PATH = CACHE_DIR / "manifest.jsonl"


@dataclass(frozen=True)
class ClinrecRef:
    source_id: int
    revision: int

    @property
    def clinrec_id(self) -> str:
        return f"{self.source_id}_{self.revision}"

    @property
    def s3_key(self) -> str:
        return f"guidelines/{self.source_id}/{self.revision}/source.pdf"

    @property
    def pdf_url(self) -> str:
        return f"{PDF_API}?op=GetClinrecPdf&id={self.clinrec_id}"


@dataclass
class Stats:
    uploaded: int = 0
    skipped: int = 0
    failed: int = 0
    probed_ids: int = 0
    found: int = 0


def parse_args(argv: Optional[list[str]] = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Download Minzdrav clinical recommendation PDFs into S3",
    )
    p.add_argument("--max-id", type=int, default=1500, help="Max source_id to probe")
    p.add_argument(
        "--max-revision",
        type=int,
        default=20,
        help="Max revision number to try per source_id",
    )
    p.add_argument(
        "--empty-streak",
        type=int,
        default=80,
        help="Stop after this many consecutive source_ids with no PDF",
    )
    p.add_argument(
        "--delay",
        type=float,
        default=0.3,
        help="Pause between Minzdrav HTTP requests (seconds)",
    )
    p.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Process only first N found guidelines (0 = all); useful for smoke tests",
    )
    p.add_argument(
        "--dry-run",
        action="store_true",
        help="Discover catalog and print progress without S3 put",
    )
    p.add_argument(
        "--env-file",
        type=Path,
        default=None,
        help="Path to .env (default: vismuth/.env next to scripts/)",
    )
    return p.parse_args(argv)


def load_settings(env_file: Optional[Path]) -> dict[str, str]:
    root = SCRIPT_DIR.parent.parent
    path = env_file or (root / ".env")
    if path.is_file():
        load_dotenv(path, override=False)

    endpoint = os.getenv("S3_ENDPOINT_URL", "http://127.0.0.1:9000").rstrip("/")
    access = os.getenv("S3_ACCESS_KEY", "")
    secret = os.getenv("S3_SECRET_KEY", "")
    bucket = os.getenv("S3_BUCKET", "vismuth-clinrec")
    region = os.getenv("S3_REGION", "us-east-1")
    addressing = os.getenv("S3_ADDRESSING_STYLE", "path")

    missing = [k for k, v in [("S3_ACCESS_KEY", access), ("S3_SECRET_KEY", secret)] if not v]
    if missing:
        raise SystemExit(
            f"Missing env: {', '.join(missing)}. "
            f"Copy .env.template → .env and set S3_* (or pass via environment).",
        )

    return {
        "endpoint": endpoint,
        "access_key": access,
        "secret_key": secret,
        "bucket": bucket,
        "region": region,
        "addressing": addressing,
    }


def make_s3_client(settings: dict[str, str]):
    return boto3.client(
        "s3",
        endpoint_url=settings["endpoint"],
        aws_access_key_id=settings["access_key"],
        aws_secret_access_key=settings["secret_key"],
        region_name=settings["region"],
        config=Config(s3={"addressing_style": settings["addressing"]}),
    )


def ensure_bucket(s3, bucket: str) -> None:
    try:
        s3.head_bucket(Bucket=bucket)
    except ClientError as exc:
        code = exc.response.get("Error", {}).get("Code", "")
        raise SystemExit(
            f"S3 bucket '{bucket}' unavailable ({code}). "
            f"Start local storage: docker compose up -d minio minio-init",
        ) from exc


def sleep_delay(delay: float) -> None:
    if delay > 0:
        time.sleep(delay)


def fetch_pdf(
    client: httpx.Client,
    ref: ClinrecRef,
    delay: float,
    *,
    head_only: bool = False,
) -> tuple[Optional[bytes], Optional[int], Optional[str]]:
    """Return (body_or_None, content_length, error).

    For probing we may request full GET (API often ignores HEAD) and validate magic.
    """
    sleep_delay(delay)
    try:
        if head_only:
            resp = client.head(ref.pdf_url, follow_redirects=True)
            if resp.status_code == 405:
                head_only = False
            elif resp.status_code >= 400:
                return None, None, f"http_{resp.status_code}"
            else:
                cl = resp.headers.get("content-length")
                ctype = (resp.headers.get("content-type") or "").lower()
                length = int(cl) if cl and cl.isdigit() else None
                if "pdf" in ctype or (length is not None and length > 1000):
                    return None, length, None
                # ambiguous HEAD — fall through to GET
                head_only = False

        if not head_only:
            resp = client.get(ref.pdf_url, follow_redirects=True)
            if resp.status_code >= 400:
                return None, None, f"http_{resp.status_code}"
            body = resp.content
            if not body.startswith(PDF_MAGIC):
                return None, None, "not_pdf"
            length = len(body)
            return body, length, None
    except httpx.HTTPError as exc:
        return None, None, f"network:{exc.__class__.__name__}"

    return None, None, "unknown"


def fetch_pdf_with_retries(
    client: httpx.Client,
    ref: ClinrecRef,
    delay: float,
    retries: int = 3,
) -> tuple[Optional[bytes], Optional[int], Optional[str]]:
    last_err: Optional[str] = None
    for attempt in range(retries):
        body, length, err = fetch_pdf(client, ref, delay)
        if err is None:
            return body, length, None
        last_err = err
        if err.startswith("http_429") or err.startswith("http_5") or err.startswith("network:"):
            time.sleep(min(8.0, 1.5 * (attempt + 1)))
            continue
        break
    return None, None, last_err


def find_latest_revision(
    client: httpx.Client,
    source_id: int,
    max_revision: int,
    delay: float,
) -> Optional[tuple[ClinrecRef, bytes, int]]:
    """Return (ref, body, size) for the highest *distinct* revision, or None.

    Minzdrav aliases too-high revision numbers to the latest PDF (same bytes).
    Walk revisions ascending; stop when content equals the previous revision —
    that previous number is the real latest.
    """
    prev: Optional[tuple[ClinrecRef, bytes, int]] = None
    for revision in range(1, max_revision + 1):
        ref = ClinrecRef(source_id, revision)
        body, length, err = fetch_pdf_with_retries(client, ref, delay)
        if err is not None or body is None or length is None:
            # No revision 1 → id missing. After a hit, a hard miss also stops.
            return prev
        if prev is not None and body == prev[1]:
            return prev
        prev = (ref, body, length)
    return prev


def head_s3_size(s3, bucket: str, key: str) -> Optional[int]:
    try:
        meta = s3.head_object(Bucket=bucket, Key=key)
        return int(meta["ContentLength"])
    except ClientError as exc:
        code = exc.response.get("Error", {}).get("Code", "")
        if code in {"404", "NoSuchKey", "NotFound", "404 Not Found"}:
            return None
        # MinIO sometimes uses 404 HTTP status with different codes
        status = exc.response.get("ResponseMetadata", {}).get("HTTPStatusCode")
        if status == 404:
            return None
        raise


def put_pdf(s3, bucket: str, ref: ClinrecRef, body: bytes) -> None:
    s3.put_object(
        Bucket=bucket,
        Key=ref.s3_key,
        Body=body,
        ContentType="application/pdf",
        Metadata={
            "source-url": ref.pdf_url,
            "clinrec-id": ref.clinrec_id,
        },
    )


def append_manifest(row: dict) -> None:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    with MANIFEST_PATH.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(row, ensure_ascii=False) + "\n")


def format_bytes(n: int) -> str:
    if n < 1024:
        return f"{n}B"
    if n < 1024 * 1024:
        return f"{n / 1024:.1f}KB"
    return f"{n / (1024 * 1024):.1f}MB"


def discover_and_upload(args: argparse.Namespace) -> Stats:
    settings = load_settings(args.env_file)
    s3 = None if args.dry_run else make_s3_client(settings)
    if s3 is not None:
        ensure_bucket(s3, settings["bucket"])
        print(
            f"S3 ok: {settings['endpoint']} bucket={settings['bucket']}",
            flush=True,
        )
    else:
        print("dry-run: S3 put disabled", flush=True)

    stats = Stats()
    empty_streak = 0
    index = 0

    timeout = httpx.Timeout(60.0, connect=15.0)
    headers = {"User-Agent": USER_AGENT, "Accept": "application/pdf,*/*"}

    with httpx.Client(timeout=timeout, headers=headers) as http:
        for source_id in range(1, args.max_id + 1):
            if args.limit and index >= args.limit:
                print(f"limit {args.limit} reached", flush=True)
                break

            stats.probed_ids += 1
            found = find_latest_revision(
                http,
                source_id,
                args.max_revision,
                args.delay,
            )
            if found is None:
                empty_streak += 1
                if empty_streak >= args.empty_streak and stats.found > 0:
                    print(
                        f"stop: empty streak {empty_streak} after id={source_id}",
                        flush=True,
                    )
                    break
                continue

            empty_streak = 0
            ref, body, size = found
            stats.found += 1
            index += 1

            total_hint = f"{index}" + (f"/{args.limit}" if args.limit else "")
            prefix = f"[{total_hint}] {ref.clinrec_id}"

            if args.dry_run:
                print(f"{prefix}  dry-run  {format_bytes(size)}", flush=True)
                append_manifest(
                    {
                        "source_id": ref.source_id,
                        "revision": ref.revision,
                        "key": ref.s3_key,
                        "status": "dry_run",
                        "bytes": size,
                        "error": None,
                    },
                )
                stats.skipped += 1
                continue

            assert s3 is not None
            try:
                existing = head_s3_size(s3, settings["bucket"], ref.s3_key)
                if existing is not None and existing == size:
                    print(f"{prefix}  skip  {format_bytes(size)}", flush=True)
                    append_manifest(
                        {
                            "source_id": ref.source_id,
                            "revision": ref.revision,
                            "key": ref.s3_key,
                            "status": "skip",
                            "bytes": size,
                            "error": None,
                        },
                    )
                    stats.skipped += 1
                    continue

                put_pdf(s3, settings["bucket"], ref, body)
                action = "put" if existing is None else "replace"
                print(f"{prefix}  {action}  {format_bytes(size)}", flush=True)
                append_manifest(
                    {
                        "source_id": ref.source_id,
                        "revision": ref.revision,
                        "key": ref.s3_key,
                        "status": action,
                        "bytes": size,
                        "error": None,
                    },
                )
                stats.uploaded += 1
            except Exception as exc:  # noqa: BLE001 — surface per-item failures
                print(f"{prefix}  fail: {exc}", flush=True)
                append_manifest(
                    {
                        "source_id": ref.source_id,
                        "revision": ref.revision,
                        "key": ref.s3_key,
                        "status": "fail",
                        "bytes": size,
                        "error": str(exc),
                    },
                )
                stats.failed += 1

    return stats


def main(argv: Optional[list[str]] = None) -> int:
    args = parse_args(argv)
    print(
        f"probe source_id=1..{args.max_id} revisions=1..{args.max_revision} "
        f"delay={args.delay}s empty_streak={args.empty_streak}"
        + (f" limit={args.limit}" if args.limit else ""),
        flush=True,
    )
    stats = discover_and_upload(args)
    print(
        f"done: found={stats.found} uploaded={stats.uploaded} "
        f"skipped={stats.skipped} failed={stats.failed} "
        f"probed_ids={stats.probed_ids}",
        flush=True,
    )
    print(f"manifest: {MANIFEST_PATH}", flush=True)
    return 1 if stats.failed else 0


if __name__ == "__main__":
    sys.exit(main())
