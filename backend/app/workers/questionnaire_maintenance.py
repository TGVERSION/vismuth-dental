import asyncio
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import and_, delete, or_, select

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
                # Анкету по персональной ссылке не бросаем по бездействию:
                # пациент может вернуться к ней до срока ссылки.
                Questionnaire.invite_expires_at.is_(None),
            ).with_for_update(skip_locked=True),
        )
        rows = list(result.scalars().all())
        for q in rows:
            await db.execute(
                delete(QuestionnaireAnswer).where(
                    QuestionnaireAnswer.questionnaire_id == q.id,
                ),
            )
            q.status = "abandoned"
            q.dental_answers = None
            q.gastro_answers = None
            q.structured = None
            q.gaps = None
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
                or_(
                    and_(Questionnaire.status == 'completed',
                         Questionnaire.completed_at.is_not(None),
                         Questionnaire.completed_at < threshold),
                    and_(Questionnaire.status == 'abandoned',
                         Questionnaire.current_step == 'guard_stopped',
                         Questionnaire.last_activity_at < threshold),
                ),
            ),
        )
        rows = list(result.scalars().all())
        for q in rows:
            await db.delete(q)
        await db.commit()
        return len(rows)


async def purge_expired_invites(now: datetime) -> int:
    """Незаполненные анкеты по персональной ссылке после её срока удаляются."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            delete(Questionnaire)
            .where(
                Questionnaire.invite_expires_at.is_not(None),
                Questionnaire.invite_expires_at < now,
                Questionnaire.status.in_(("invited", "in_progress")),
            )
            .returning(Questionnaire.id),
        )
        deleted = len(result.all())
        await db.commit()
        return deleted


async def run_once() -> None:
    now = datetime.now(timezone.utc)
    abandoned = await abandon_stale(now)
    purged = await purge_old(now)
    expired = await purge_expired_invites(now)
    if abandoned or purged or expired:
        logger.info(
            "abandoned=%s purged=%s expired_invites=%s",
            abandoned,
            purged,
            expired,
        )


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
