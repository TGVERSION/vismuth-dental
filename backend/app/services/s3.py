"""S3-compatible client for clinrec PDFs (MinIO / Silo)."""

from __future__ import annotations

import logging
from functools import lru_cache

import boto3
from botocore.client import BaseClient, Config
from botocore.exceptions import ClientError
from fastapi import HTTPException, status

from ..config import settings

logger = logging.getLogger(__name__)


def _s3_credentials_configured() -> bool:
    return bool(settings.s3_access_key and settings.s3_secret_key)


@lru_cache(maxsize=1)
def get_s3_client() -> BaseClient:
    """Client for head/get/put against S3_ENDPOINT_URL."""
    if not _s3_credentials_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "s3_not_configured",
                "message": "S3_ACCESS_KEY / S3_SECRET_KEY are not set",
            },
        )
    return boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint_url,
        aws_access_key_id=settings.s3_access_key,
        aws_secret_access_key=settings.s3_secret_key,
        region_name=settings.s3_region,
        config=Config(
            signature_version="s3v4",
            s3={"addressing_style": settings.s3_addressing_style},
        ),
    )


@lru_cache(maxsize=1)
def get_s3_presign_client() -> BaseClient:
    """Client whose endpoint is baked into SigV4 (S3_PRESIGN_ENDPOINT_URL)."""
    if not _s3_credentials_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "s3_not_configured",
                "message": "S3_ACCESS_KEY / S3_SECRET_KEY are not set",
            },
        )
    return boto3.client(
        "s3",
        endpoint_url=settings.s3_presign_endpoint_url,
        aws_access_key_id=settings.s3_access_key,
        aws_secret_access_key=settings.s3_secret_key,
        region_name=settings.s3_region,
        config=Config(
            signature_version="s3v4",
            s3={"addressing_style": settings.s3_addressing_style},
        ),
    )


def head_object(*, bucket: str, key: str) -> dict:
    """Raise 422 s3_object_not_found if the object is missing."""
    client = get_s3_client()
    try:
        return client.head_object(Bucket=bucket, Key=key)
    except ClientError as exc:
        error_code = (exc.response.get("Error") or {}).get("Code", "")
        http_status = (exc.response.get("ResponseMetadata") or {}).get(
            "HTTPStatusCode",
        )
        if error_code in {"404", "NoSuchKey", "NotFound"} or http_status == 404:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "code": "s3_object_not_found",
                    "message": f"S3 object not found: s3://{bucket}/{key}",
                },
            ) from exc
        logger.exception("S3 head_object failed bucket=%s key=%s", bucket, key)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "code": "s3_error",
                "message": f"S3 head_object failed: {error_code or str(exc)}",
            },
        ) from exc


def generate_presigned_get(*, bucket: str, key: str) -> str:
    """Short-lived GET URL for ml-service (host from S3_PRESIGN_ENDPOINT_URL)."""
    client = get_s3_presign_client()
    try:
        return client.generate_presigned_url(
            "get_object",
            Params={"Bucket": bucket, "Key": key},
            ExpiresIn=settings.s3_presign_ttl_seconds,
        )
    except ClientError as exc:
        logger.exception("S3 presign failed bucket=%s key=%s", bucket, key)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "code": "s3_presign_failed",
                "message": "Failed to generate presigned GET URL",
            },
        ) from exc


_PDF_MAGIC = b"%PDF"


def get_object_bytes(*, bucket: str, key: str) -> bytes:
    """Download object bytes; require PDF magic header."""
    client = get_s3_client()
    try:
        response = client.get_object(Bucket=bucket, Key=key)
        body = response["Body"].read()
    except ClientError as exc:
        error_code = (exc.response.get("Error") or {}).get("Code", "")
        http_status = (exc.response.get("ResponseMetadata") or {}).get(
            "HTTPStatusCode",
        )
        if error_code in {"404", "NoSuchKey", "NotFound"} or http_status == 404:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "code": "s3_object_not_found",
                    "message": f"S3 object not found: s3://{bucket}/{key}",
                },
            ) from exc
        logger.exception("S3 get_object failed bucket=%s key=%s", bucket, key)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "code": "s3_error",
                "message": f"S3 get_object failed: {error_code or str(exc)}",
            },
        ) from exc

    if not body.startswith(_PDF_MAGIC):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "pdf_invalid",
                "message": f"Object s3://{bucket}/{key} is not a PDF",
            },
        )
    return body
