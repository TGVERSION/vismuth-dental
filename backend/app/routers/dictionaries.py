import re
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..dictionaries_config import REF_TABLES, SEARCH_FIELDS
from ..deps import get_current_user
from ..models.dictionary import Dictionary
from ..models.service_user import ServiceUser
from ..schemas.dictionaries import DictionaryRead, RefSearchResponse

router = APIRouter(tags=["dictionaries"])

_SAFE_IDENT_RE = re.compile(r"^[a-z_][a-z0-9_]*$")


def _quote_ident(identifier: str) -> str:
    if not _SAFE_IDENT_RE.fullmatch(identifier):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Invalid table/column identifier in server config",
        )
    return f'"{identifier}"'


@router.get("/dictionary", response_model=list[DictionaryRead])
async def list_dictionary(
    current_user: ServiceUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[Dictionary]:
    _ = current_user
    stmt = (
        select(Dictionary)
        .where(Dictionary.deleted_at.is_(None))
        .order_by(Dictionary.id.asc())
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/ref/{name}", response_model=RefSearchResponse)
async def get_ref_values(
    name: str,
    search: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: ServiceUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RefSearchResponse:
    _ = current_user

    dict_stmt = select(Dictionary.id).where(
        Dictionary.name == name,
        Dictionary.deleted_at.is_(None),
    )
    dict_result = await db.execute(dict_stmt)
    if dict_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dictionary not found")

    table_name = REF_TABLES.get(name)
    if table_name is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Dictionary table is not whitelisted",
        )

    searchable_columns = SEARCH_FIELDS.get(name, [])
    quoted_table = _quote_ident(table_name)

    where_sql = ""
    params: dict[str, object] = {"limit": limit, "offset": offset}
    if search:
        term = search.strip()
        if term:
            if not searchable_columns:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Search is not supported for this dictionary",
                )
            or_parts = [f'{_quote_ident(column)} ILIKE :search' for column in searchable_columns]
            where_sql = " WHERE " + " OR ".join(or_parts)
            params["search"] = f"%{term}%"

    stmt_count = text(f"SELECT COUNT(*) FROM {quoted_table}{where_sql}")
    stmt_items = text(
        f"SELECT * FROM {quoted_table}{where_sql} "
        "ORDER BY row_id ASC LIMIT :limit OFFSET :offset",
    )

    total = (await db.execute(stmt_count, params)).scalar_one()
    items = (await db.execute(stmt_items, params)).mappings().all()

    return RefSearchResponse(
        name=name,
        total=total,
        limit=limit,
        offset=offset,
        items=[dict(item) for item in items],
    )
