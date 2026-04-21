import asyncio
import json
import logging
from datetime import datetime
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import AsyncSessionLocal
from app.models.autocomplete_stats import AutocompleteStats
from app.models.fullness_complaints_stats import FullnessComplaintsStats
from app.services.redis_stream import get_redis_client

logger = logging.getLogger("ml_mkb_events_worker")
logging.basicConfig(level=logging.INFO)


def _parse_shown_at(value: str) -> datetime:
    normalized = value[:-1] + "+00:00" if value.endswith("Z") else value
    return datetime.fromisoformat(normalized)


async def _save_event(db: AsyncSession, event: dict) -> None:
    row = AutocompleteStats(
        user_id=UUID(event["user_id"]),
        field_name=event["field_name"],
        prefix=event["prefix"],
        suggestions_count=int(event["suggestions_count"]),
        selected_text=event.get("selected_text"),
        event_type=event["event_type"],
        shown_at=_parse_shown_at(event["shown_at"]),
    )
    db.add(row)
    await db.commit()


async def _save_fullness_complaints_event(db: AsyncSession, event: dict) -> None:
    row = FullnessComplaintsStats(
        user_id=UUID(event["user_id"]),
        status=event.get("status"),
        color=event.get("color"),
        analysis=event.get("analysis"),
        suggested_text=event.get("suggested_text"),
    )
    db.add(row)
    await db.commit()


async def run_worker() -> None:
    redis = get_redis_client()
    stream_key = settings.redis_stream_key
    group = settings.redis_consumer_group
    consumer = settings.redis_consumer_name

    try:
        try:
            await redis.xgroup_create(stream_key, group, id="0", mkstream=True)
            logger.info("Consumer group created: %s", group)
        except Exception as exc:
            if "BUSYGROUP" not in str(exc):
                raise

        while True:
            messages = await redis.xreadgroup(
                groupname=group,
                consumername=consumer,
                streams={stream_key: ">"},
                count=20,
                block=5000,
            )
            if not messages:
                continue

            for _, entries in messages:
                for message_id, fields in entries:
                    raw_event = fields.get("event")
                    if raw_event is None:
                        await redis.xack(stream_key, group, message_id)
                        continue
                    try:
                        event = json.loads(raw_event)
                        async with AsyncSessionLocal() as db:
                            event_kind = event.get("event_kind", "autocomplete_stats")
                            if event_kind == "fullness_complaints_stats":
                                await _save_fullness_complaints_event(db, event)
                            else:
                                await _save_event(db, event)
                        await redis.xack(stream_key, group, message_id)
                    except Exception:
                        logger.exception("Failed to process stream message %s", message_id)
    finally:
        await redis.aclose()


if __name__ == "__main__":
    asyncio.run(run_worker())
