"""Catalog helpers: s3_key validation, MKB resolve, read mapping."""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models.clinrec_guideline import ClinrecGuideline, ClinrecGuidelineMkb
from ..schemas.clinrec_guideline import ClinrecGuidelineRead

# Leading MKB token from "I10 – ..." / "I11.0 Hyper..." / "i10"
_MKB_TOKEN_RE = re.compile(
    r"^([A-Za-z]\d{2}(?:\.\d{1,4})?)",
    re.UNICODE,
)

_S3_KEY_SEGMENT_RE = re.compile(r"^[A-Za-z0-9._-]+$")


def expected_s3_key(source_id: int, version: str) -> str:
    return f"guidelines/{source_id}/{version}/source.pdf"


def validate_s3_key(source_id: int, version: str, s3_key: str) -> str:
    expected = expected_s3_key(source_id, version)
    if s3_key != expected:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "invalid_s3_key",
                "message": (
                    f"s3_key must be '{expected}' "
                    f"(guidelines/{{source_id}}/{{version}}/source.pdf)"
                ),
            },
        )
    for segment in (str(source_id), version):
        if not _S3_KEY_SEGMENT_RE.match(segment):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "code": "invalid_s3_key_segment",
                    "message": (
                        "source_id and version may contain only [A-Za-z0-9._-]"
                    ),
                },
            )
    return s3_key


def extract_mkb_code(raw: str) -> Optional[str]:
    """Extract leading MKB code from diagnosis string or bare code."""
    text = (raw or "").strip()
    if not text:
        return None
    # "I10 – name" / "I10 - name" / "I10 name"
    first = text.split()[0].rstrip("–—-.,;")
    match = _MKB_TOKEN_RE.match(first) or _MKB_TOKEN_RE.match(text)
    if not match:
        return None
    return match.group(1).upper()


def guideline_to_read(guideline: ClinrecGuideline) -> ClinrecGuidelineRead:
    prefixes = sorted(m.mkb_prefix for m in guideline.mkb_prefixes)
    return ClinrecGuidelineRead(
        id=guideline.id,
        code=guideline.code,
        source_id=guideline.source_id,
        title=guideline.title,
        short_title=guideline.short_title,
        status=guideline.status,
        version=guideline.version,
        s3_bucket=guideline.s3_bucket,
        s3_key=guideline.s3_key,
        index_error=guideline.index_error,
        mkb_prefixes=prefixes,
        created_at=guideline.created_at,
        updated_at=guideline.updated_at,
    )


async def get_guideline_or_404(
    db: AsyncSession,
    guideline_id: UUID,
) -> ClinrecGuideline:
    result = await db.execute(
        select(ClinrecGuideline)
        .where(ClinrecGuideline.id == guideline_id)
        .options(selectinload(ClinrecGuideline.mkb_prefixes)),
    )
    guideline = result.scalar_one_or_none()
    if guideline is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "guideline_not_found",
                "message": "Guideline not found",
            },
        )
    return guideline


async def get_guideline_by_code(
    db: AsyncSession,
    code: str,
) -> Optional[ClinrecGuideline]:
    result = await db.execute(
        select(ClinrecGuideline)
        .where(ClinrecGuideline.code == code)
        .options(selectinload(ClinrecGuideline.mkb_prefixes)),
    )
    return result.scalar_one_or_none()


_DMS_RESOLVE_STATUSES = frozenset({"uploaded", "active", "failed"})


async def resolve_guideline_by_mkb(
    db: AsyncSession,
    *,
    mkb: Optional[str] = None,
    diagnosis: Optional[str] = None,
    statuses: frozenset[str] = frozenset({"active"}),
) -> ClinrecGuideline:
    """Longest matching mkb_prefix among guidelines with given statuses."""
    code: Optional[str] = None
    if mkb:
        code = extract_mkb_code(mkb) or mkb.strip().upper().replace(" ", "")
    elif diagnosis:
        code = extract_mkb_code(diagnosis)

    if not code:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "mkb_required",
                "message": "Provide mkb= or diagnosis= with a leading MKB code",
            },
        )

    result = await db.execute(
        select(ClinrecGuidelineMkb, ClinrecGuideline)
        .join(
            ClinrecGuideline,
            ClinrecGuideline.id == ClinrecGuidelineMkb.guideline_id,
        )
        .where(ClinrecGuideline.status.in_(statuses))
        .options(selectinload(ClinrecGuideline.mkb_prefixes)),
    )
    rows = result.all()

    best: Optional[ClinrecGuideline] = None
    best_len = -1
    for mapping, guideline in rows:
        prefix = mapping.mkb_prefix
        if code.startswith(prefix) and len(prefix) > best_len:
            best = guideline
            best_len = len(prefix)

    if best is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "guideline_not_found",
                "message": f"No guideline for MKB '{code}'",
            },
        )
    return best


async def resolve_active_guideline(
    db: AsyncSession,
    *,
    mkb: Optional[str] = None,
    diagnosis: Optional[str] = None,
) -> ClinrecGuideline:
    """Longest matching mkb_prefix among active guidelines."""
    return await resolve_guideline_by_mkb(
        db,
        mkb=mkb,
        diagnosis=diagnosis,
        statuses=frozenset({"active"}),
    )


async def resolve_dms_guideline(
    db: AsyncSession,
    *,
    mkb: str,
) -> ClinrecGuideline:
    """Resolve for DMS: PDF in S3 matters, Chroma index does not."""
    return await resolve_guideline_by_mkb(
        db,
        mkb=mkb,
        statuses=_DMS_RESOLVE_STATUSES,
    )


async def replace_mkb_prefixes(
    db: AsyncSession,
    guideline: ClinrecGuideline,
    prefixes: list[str],
) -> None:
    """Replace MKB prefixes without lazy-loading the relationship (async-safe)."""
    await db.execute(
        delete(ClinrecGuidelineMkb).where(
            ClinrecGuidelineMkb.guideline_id == guideline.id,
        ),
    )
    for prefix in prefixes:
        db.add(
            ClinrecGuidelineMkb(
                guideline_id=guideline.id,
                mkb_prefix=prefix,
            ),
        )


def touch_updated_at(guideline: ClinrecGuideline) -> None:
    guideline.updated_at = datetime.now(timezone.utc)


def raise_integrity_conflict(exc: IntegrityError) -> None:
    err = str(exc.orig) if getattr(exc, "orig", None) else str(exc)
    lower = err.lower()
    if "uq_clinrec_guideline_code" in lower:
        code = "guideline_code_conflict"
        message = "Guideline code already exists"
    elif "uq_clinrec_guideline_source_id" in lower:
        code = "guideline_source_id_conflict"
        message = "source_id already exists"
    elif "uq_clinrec_guideline_mkb_prefix" in lower:
        code = "mkb_prefix_conflict"
        message = "mkb_prefix already mapped to another guideline"
    else:
        code = "guideline_conflict"
        message = "Guideline conflict"
    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail={"code": code, "message": message},
    ) from exc
