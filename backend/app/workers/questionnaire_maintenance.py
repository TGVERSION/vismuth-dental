import asyncio
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, select

from app.config import settings
from app.db import AsyncSessionLocal, engine
from app.models.questionnaire import Questionnaire, QuestionnaireAnswer

logger = logging.getLogger("questionnaire_maintenance")
logging.basicConfig(level=logging.INFO)

POLL_SECONDS = 600


async def abandon_stale(now: datetime) -> int:
    threshold = now - timedelta(hours=settings.questionnaire_abandon_hours)
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Questionnaire).where(
                Questionnaire.status == "in_progress",
                Questionnaire.last_activity_at < threshold,
            ),
        )
        rows = list(result.scalars().all())
        for q in rows:
            await db.execute(
                delete(QuestionnaireAnswer).where(
                    QuestionnaireAnswer.questionnaire_id == q.id,
                ),
            )
            q.status = "abandoned"
            q.patient_first_name = None
            q.patient_middle_name = None
            q.appointment_date = None
            q.appointment_time = None
            q.session_token_hash = ""
            q.device_id_hash = None
            q.ip_hash = None
            q.code = None
            q.collect_form_state = None
            q.updated_at = now
        await db.commit()
        return len(rows)


async def purge_old(now: datetime) -> int:
    threshold = now - timedelta(days=settings.questionnaire_retention_days)
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Questionnaire).where(
                Questionnaire.status == "completed",
                Questionnaire.completed_at.is_not(None),
                Questionnaire.completed_at < threshold,
            ),
        )
        rows = list(result.scalars().all())
        for q in rows:
            await db.delete(q)
        await db.commit()
        return len(rows)


async def run_once() -> None:
    now = datetime.now(timezone.utc)
    abandoned = await abandon_stale(now)
    purged = await purge_old(now)
    if abandoned or purged:
        logger.info("abandoned=%s purged=%s", abandoned, purged)


async def main() -> None:
    logger.info("questionnaire maintenance worker started")
    try:
        while True:
            try:
                await run_once()
            except Exception:
                logger.exception("maintenance cycle failed")
            await asyncio.sleep(POLL_SECONDS)
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
