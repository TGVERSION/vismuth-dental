import asyncio
import json
import logging
from datetime import datetime
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import AsyncSessionLocal, engine
from app.models.autocomplete_stats import AutocompleteStats
from app.models.fullness_complaints_stats import FullnessComplaintsStats
from app.models.ml_response_log import MlResponseLog
from app.services.redis_stream import get_redis_client

logger = logging.getLogger("ml_mkb_events_worker")
logging.basicConfig(level=logging.INFO)


def _parse_shown_at(value: str) -> datetime:
    normalized = value[:-1] + "+00:00" if value.endswith("Z") else value
    return datetime.fromisoformat(normalized)


async def _save_event(db: AsyncSession, event: dict) -> None:
    type_autocomplete = event.get("type_autocomplete", "ml_autocomplete")
    row = AutocompleteStats(
        user_id=UUID(event["user_id"]),
        field_name=event.get("field_name"),
        prefix=event["prefix"],
        suggestions_count=int(event["suggestions_count"]),
        selected_text=event.get("selected_text"),
        event_type=event["event_type"],
        type_autocomplete=type_autocomplete,
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


async def _save_ml_response_log_event(db: AsyncSession, event: dict) -> None:
    row = MlResponseLog(
        user_id=UUID(event["user_id"]),
        endpoint_name=event["endpoint_name"],
        ml_path=event["ml_path"],
        http_status_code=event.get("http_status_code"),
        response_status=event["response_status"],
        response_comment=event.get("response_comment"),
        response_payload=event.get("response_payload"),
    )
    db.add(row)
    await db.commit()


async def _persist_event(event: dict) -> None:
    event_kind = event.get("event_kind", "autocomplete_stats")
    last_error: Exception | None = None

    for attempt in range(2):
        try:
            async with AsyncSessionLocal() as db:
                if event_kind == "fullness_complaints_stats":
                    await _save_fullness_complaints_event(db, event)
                elif event_kind == "ml_response_log":
                    await _save_ml_response_log_event(db, event)
                else:
                    await _save_event(db, event)
            return
        except Exception as exc:
            last_error = exc
            logger.warning(
                "DB save failed for event_kind=%s (attempt %s/2): %s",
                event_kind,
                attempt + 1,
                exc,
            )
            await engine.dispose()

    assert last_error is not None
    raise last_error


async def _process_stream_entries(
    redis,
    *,
    stream_key: str,
    group: str,
    consumer: str,
    entries: list[tuple[str, dict]],
) -> None:
    for message_id, fields in entries:
        raw_event = fields.get("event")
        if raw_event is None:
            await redis.xack(stream_key, group, message_id)
            continue
        try:
            event = json.loads(raw_event)
            await _persist_event(event)
            await redis.xack(stream_key, group, message_id)
        except Exception:
            logger.exception("Failed to process stream message %s", message_id)


async def _claim_pending_entries(redis, *, stream_key: str, group: str, consumer: str) -> None:
    start_id = "0-0"
    while True:
        next_start_id, claimed, _deleted = await redis.xautoclaim(
            stream_key,
            group,
            consumer,
            min_idle_time=0,
            start_id=start_id,
            count=20,
        )
        if claimed:
            await _process_stream_entries(
                redis,
                stream_key=stream_key,
                group=group,
                consumer=consumer,
                entries=claimed,
            )
        if next_start_id == start_id:
            break
        start_id = next_start_id


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
            await _claim_pending_entries(
                redis,
                stream_key=stream_key,
                group=group,
                consumer=consumer,
            )

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
                await _process_stream_entries(
                    redis,
                    stream_key=stream_key,
                    group=group,
                    consumer=consumer,
                    entries=entries,
                )
    finally:
        await redis.aclose()


if __name__ == "__main__":
    asyncio.run(run_worker())
