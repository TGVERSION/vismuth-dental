import random
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..models.questionnaire import Questionnaire


async def allocate_code(db: AsyncSession, clinic_id: UUID) -> str:
    await db.execute(
        text("SELECT pg_advisory_xact_lock(hashtext(:key))"),
        {"key": str(clinic_id)},
    )
    window_start = datetime.now(timezone.utc) - timedelta(
        days=settings.questionnaire_code_window_days,
    )
    result = await db.execute(
        select(Questionnaire.code).where(
            Questionnaire.clinic_id == clinic_id,
            Questionnaire.code.is_not(None),
            Questionnaire.completed_at.is_not(None),
            Questionnaire.completed_at > window_start,
        ),
    )
    used = {row[0] for row in result.all() if row[0]}
    free = [f"{i:04d}" for i in range(10000) if f"{i:04d}" not in used]
    if not free:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="No free questionnaire codes",
        )
    return random.choice(free)
