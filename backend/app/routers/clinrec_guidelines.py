from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..config import settings
from ..db import get_db
from ..deps import get_current_user, require_roles
from ..models.clinrec_guideline import ClinrecGuideline
from ..models.service_user import ServiceUser
from ..schemas.clinrec_guideline import (
    ClinrecGuidelineCreate,
    ClinrecGuidelineIndexResponse,
    ClinrecGuidelinePatch,
    ClinrecGuidelineRead,
)
from ..services.clinrec_guidelines import (
    get_guideline_or_404,
    guideline_to_read,
    raise_integrity_conflict,
    replace_mkb_prefixes,
    resolve_active_guideline,
    touch_updated_at,
    validate_s3_key,
)
from ..services.clinrec_ml import request_delete_index, request_index
from ..services.roles import user_has_any_role

router = APIRouter(prefix="/clinrec/guidelines", tags=["clinrec"])

require_super_admin = require_roles("super_admin")


def _is_super_admin(user: ServiceUser) -> bool:
    return user_has_any_role(user, "super_admin")


@router.post(
    "",
    response_model=ClinrecGuidelineRead,
    status_code=status.HTTP_201_CREATED,
    summary="Создать guideline в каталоге",
)
async def create_guideline(
    payload: ClinrecGuidelineCreate,
    _: ServiceUser = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
) -> ClinrecGuidelineRead:
    validate_s3_key(payload.source_id, payload.version, payload.s3_key)
    now = datetime.now(timezone.utc)
    guideline = ClinrecGuideline(
        code=payload.code,
        source_id=payload.source_id,
        title=payload.title.strip(),
        short_title=payload.short_title.strip() if payload.short_title else None,
        status="uploaded",
        version=payload.version,
        s3_bucket=settings.s3_bucket,
        s3_key=payload.s3_key,
        created_at=now,
    )
    db.add(guideline)
    await db.flush()
    await replace_mkb_prefixes(db, guideline, payload.mkb_prefixes)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise_integrity_conflict(exc)
    guideline = await get_guideline_or_404(db, guideline.id)
    return guideline_to_read(guideline)


@router.get(
    "",
    response_model=List[ClinrecGuidelineRead],
    summary="Список guidelines",
)
async def list_guidelines(
    status_filter: Optional[str] = Query(
        None,
        alias="status",
        description="Фильтр статуса (только super_admin)",
    ),
    current_user: ServiceUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[ClinrecGuidelineRead]:
    stmt = (
        select(ClinrecGuideline)
        .options(selectinload(ClinrecGuideline.mkb_prefixes))
        .order_by(ClinrecGuideline.code.asc())
    )
    if _is_super_admin(current_user):
        if status_filter:
            stmt = stmt.where(ClinrecGuideline.status == status_filter)
    else:
        if status_filter and status_filter != "active":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied",
            )
        stmt = stmt.where(ClinrecGuideline.status == "active")

    rows = (await db.execute(stmt)).scalars().all()
    return [guideline_to_read(g) for g in rows]


@router.get(
    "/resolve",
    response_model=ClinrecGuidelineRead,
    summary="Resolve active guideline по МКБ / диагнозу",
)
async def resolve_guideline(
    mkb: Optional[str] = Query(None, description="Код МКБ, напр. I10"),
    diagnosis: Optional[str] = Query(
        None,
        description="Строка диагноза, напр. 'I10 – Артериальная гипертензия'",
    ),
    current_user: ServiceUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ClinrecGuidelineRead:
    _ = current_user
    if not mkb and not diagnosis:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "mkb_required",
                "message": "Provide mkb= or diagnosis=",
            },
        )
    guideline = await resolve_active_guideline(db, mkb=mkb, diagnosis=diagnosis)
    return guideline_to_read(guideline)


@router.get(
    "/{guideline_id}",
    response_model=ClinrecGuidelineRead,
    summary="Guideline по id",
)
async def get_guideline(
    guideline_id: UUID,
    current_user: ServiceUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ClinrecGuidelineRead:
    guideline = await get_guideline_or_404(db, guideline_id)
    if not _is_super_admin(current_user) and guideline.status != "active":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "guideline_not_found",
                "message": "Guideline not found",
            },
        )
    return guideline_to_read(guideline)


@router.patch(
    "/{guideline_id}",
    response_model=ClinrecGuidelineRead,
    summary="Обновить guideline",
)
async def patch_guideline(
    guideline_id: UUID,
    payload: ClinrecGuidelinePatch,
    _: ServiceUser = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
) -> ClinrecGuidelineRead:
    guideline = await get_guideline_or_404(db, guideline_id)
    data = payload.model_dump(exclude_unset=True)

    new_source_id = data.get("source_id", guideline.source_id)
    new_version = data.get("version", guideline.version)
    new_s3_key = data.get("s3_key", guideline.s3_key)

    if "source_id" in data or "version" in data or "s3_key" in data:
        validate_s3_key(new_source_id, new_version, new_s3_key)

    version_or_key_changed = (
        ("version" in data and data["version"] != guideline.version)
        or ("s3_key" in data and data["s3_key"] != guideline.s3_key)
        or ("source_id" in data and data["source_id"] != guideline.source_id)
    )

    if "code" in data:
        guideline.code = data["code"]
    if "source_id" in data:
        guideline.source_id = data["source_id"]
    if "title" in data:
        guideline.title = data["title"].strip()
    if "short_title" in data:
        short = data["short_title"]
        guideline.short_title = short.strip() if short else None
    if "version" in data:
        guideline.version = data["version"]
    if "s3_key" in data:
        guideline.s3_key = data["s3_key"]
    if "status" in data:
        guideline.status = data["status"]
    if "mkb_prefixes" in data:
        await replace_mkb_prefixes(db, guideline, data["mkb_prefixes"] or [])

    if version_or_key_changed and guideline.status == "active":
        guideline.status = "uploaded"
        guideline.index_error = None
    elif version_or_key_changed and guideline.status not in {
        "indexing",
        "disabled",
    }:
        if guideline.status != "draft":
            guideline.status = "uploaded"
            guideline.index_error = None

    touch_updated_at(guideline)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise_integrity_conflict(exc)
    guideline = await get_guideline_or_404(db, guideline_id)
    return guideline_to_read(guideline)


@router.delete(
    "/{guideline_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Удалить guideline",
)
async def delete_guideline(
    guideline_id: UUID,
    current_user: ServiceUser = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
) -> None:
    guideline = await get_guideline_or_404(db, guideline_id)
    code = guideline.code
    was_indexed = guideline.status in {"active", "failed"}

    await db.delete(guideline)
    await db.commit()

    if was_indexed:
        # ML DELETE /clinrec/index/{code} — best-effort; пока эндпоинта нет — no-op.
        await request_delete_index(code, user_id=current_user.id)


@router.post(
    "/{guideline_id}/index",
    response_model=ClinrecGuidelineIndexResponse,
    summary="Индексировать PDF guideline в ML (синхронно)",
)
async def index_guideline(
    guideline_id: UUID,
    current_user: ServiceUser = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
) -> ClinrecGuidelineIndexResponse:
    """Оркестрация index: S3 head + presign + POST ML ``/clinrec/index``.

    Пока ml-service не реализует путь — upstream 502, статус ``failed``.
    Контракт тела: ``services.clinrec_ml.build_index_payload``.
    """
    guideline = await get_guideline_or_404(db, guideline_id)

    if guideline.status == "indexing":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "guideline_indexing",
                "message": "Guideline is already being indexed",
            },
        )
    if guideline.status not in {"uploaded", "failed", "active"}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "guideline_not_indexable",
                "message": (
                    f"Cannot index guideline in status '{guideline.status}'"
                ),
            },
        )

    guideline.status = "indexing"
    guideline.index_error = None
    touch_updated_at(guideline)
    await db.commit()

    chunks: Optional[int] = None
    try:
        body = await request_index(guideline, user_id=current_user.id)
        chunks = body.get("chunks") if isinstance(body, dict) else None
        guideline.status = "active"
        guideline.index_error = None
    except HTTPException as exc:
        detail = exc.detail
        if isinstance(detail, dict):
            message = detail.get("message") or detail.get("code") or str(detail)
        else:
            message = str(detail)
        guideline.status = "failed"
        guideline.index_error = message[:2000]
        touch_updated_at(guideline)
        await db.commit()
        raise

    touch_updated_at(guideline)
    await db.commit()

    return ClinrecGuidelineIndexResponse(
        id=guideline.id,
        code=guideline.code,
        status=guideline.status,
        version=guideline.version,
        chunks=chunks if isinstance(chunks, int) else None,
        index_error=guideline.index_error,
    )
