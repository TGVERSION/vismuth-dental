from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.exc import ProgrammingError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..deps import get_current_user
from ..models.mkb10 import Mkb10
from ..models.service_user import ServiceUser
from ..schemas.mkb10 import Mkb10ItemRead, Mkb10SearchResponse


router = APIRouter(prefix="/mkb10", tags=["mkb10"])


@router.get("", response_model=Mkb10SearchResponse)
async def search_mkb10(
    page: int = Query(1, ge=1, description="Номер страницы (>= 1)"),
    size: int = Query(10, ge=1, le=100, description="Размер страницы (1..100)"),
    searchValue: Optional[str] = Query(
        None,
        description="Строка для поиска по названию диагноза (частичное совпадение)",
    ),
    current_user: ServiceUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Mkb10SearchResponse:
    # Зависимость нужна для обязательной проверки Bearer-токена.
    _ = current_user
    offset = (page - 1) * size

    filters = []
    if searchValue:
        filters.append(Mkb10.mkb_name.ilike(f"%{searchValue}%"))

    stmt_count = select(func.count()).select_from(Mkb10)
    if filters:
        stmt_count = stmt_count.where(*filters)

    stmt_items = (
        select(
            Mkb10.mkb_code.label("code"),
            Mkb10.mkb_name.label("name"),
        )
        .order_by(Mkb10.mkb_code.asc())
        .offset(offset)
        .limit(size)
    )
    if filters:
        stmt_items = stmt_items.where(*filters)

    try:
        totalCount = (await db.execute(stmt_count)).scalar_one()
        rows = (await db.execute(stmt_items)).mappings().all()
    except ProgrammingError as e:
        err = str(e.orig) if getattr(e, "orig", None) else str(e)
        detail = (
            "Таблица ref_mkb10 не найдена в БД. "
            "Выполните DDL из main_schema.sql (создание ref_mkb10)."
            if "ref_mkb10" in err
            else f"Ошибка PostgreSQL: {err}"
        )
        raise HTTPException(status_code=500, detail=detail) from e
    except SQLAlchemyError as e:
        raise HTTPException(status_code=500, detail=f"Ошибка БД: {e!s}") from e

    items = [
        Mkb10ItemRead(code=row["code"], name=row["name"])
        for row in rows
    ]
    return Mkb10SearchResponse(
        page=page,
        size=size,
        totalCount=totalCount,
        items=items,
    )

