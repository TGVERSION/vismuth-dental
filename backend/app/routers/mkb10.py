from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.exc import ProgrammingError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..deps import get_current_user
from ..models.mkb10 import Mkb10
from ..models.service_user import ServiceUser
from ..schemas.auth import MessageResponse
from ..schemas.mkb10 import Mkb10ItemRead, Mkb10SearchResponse


router = APIRouter(prefix="/mkb10", tags=["mkb10"])


@router.get(
    "",
    response_model=Mkb10SearchResponse,
    summary="Поиск диагнозов МКБ-10",
    description=(
        "Результаты отсортированы по возрастанию кода. totalCount — число совпадений "
        "до пагинации. За пределами списка возвращаются HTTP 200 и пустой items, "
        "а totalCount сохраняет число совпадений. Если совпадений нет, totalCount равен 0."
    ),
    responses={
        200: {
            "content": {"application/json": {"examples": {
                "match": {"value": {
                    "page": 1, "size": 10, "totalCount": 1,
                    "items": [{"code": "K29.1", "name": "Другие острые гастриты"}],
                }},
                "out_of_range": {"value": {"page": 2, "size": 10, "totalCount": 1, "items": []}},
                "no_match": {"value": {"page": 1, "size": 10, "totalCount": 0, "items": []}},
            }}},
        },
        401: {"model": MessageResponse, "description": "Ошибка аутентификации Bearer."},
        403: {"model": MessageResponse, "description": "Учётная запись неактивна или доступ ограничен."},
        500: {
            "model": MessageResponse,
            "description": "Ошибка базы данных или другая внутренняя ошибка.",
            "content": {"text/plain": {"schema": {"type": "string"}}},
        },
    },
)
async def search_mkb10(
    page: int = Query(1, ge=1, description="Номер страницы (>= 1)"),
    size: int = Query(10, ge=1, le=100, description="Размер страницы (1..100)"),
    searchValue: Optional[str] = Query(
        None,
        description=(
            "Частичное совпадение без учёта регистра по строке «код - название». "
            "Пропуск параметра или пустая строка возвращают весь справочник по страницам. "
            "Пробелы сохраняются. Символы % и _ работают как шаблоны SQL ILIKE."
        ),
        openapi_examples={"code": {"value": "k29.1"}, "name": {"value": "гастрит"}},
    ),
    current_user: ServiceUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Mkb10SearchResponse:
    # Зависимость нужна для обязательной проверки Bearer-токена.
    _ = current_user
    offset = (page - 1) * size

    filters = []
    if searchValue:
        full_mkb_value = func.concat(Mkb10.mkb_code, " - ", Mkb10.mkb_name)
        filters.append(full_mkb_value.ilike(f"%{searchValue}%"))

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
            "Выполните: alembic upgrade head (и при необходимости seed_refs)."
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

