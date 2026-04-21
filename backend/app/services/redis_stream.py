import json
from datetime import datetime, timezone
from uuid import UUID

from redis.asyncio import Redis

from ..config import settings
from ..schemas.ml_mkb_code import MkbEventType


def get_redis_client() -> Redis:
    return Redis.from_url(settings.redis_url, decode_responses=True)


def build_event_payload(
    *,
    user_id: UUID,
    field_name: str,
    description: str,
    n_candidates: int,
    selected_text: str | None,
    event_type: MkbEventType,
    shown_at: datetime | None = None,
) -> dict[str, str]:
    event_time = shown_at or datetime.now(timezone.utc)
    payload = {
        "user_id": str(user_id),
        "field_name": field_name,
        "prefix": description,
        "suggestions_count": n_candidates,
        "selected_text": selected_text,
        "event_type": event_type.value,
        "shown_at": event_time.isoformat(),
    }
    # Store body as JSON to keep XADD payload stable.
    return {"event": json.dumps(payload, ensure_ascii=False)}


def build_fullness_complaints_payload(
    *,
    user_id: UUID,
    status: str,
    color: str,
    analysis: str,
    suggested_text: str,
) -> dict[str, str]:
    payload = {
        "event_kind": "fullness_complaints_stats",
        "user_id": str(user_id),
        "status": status,
        "color": color,
        "analysis": analysis,
        "suggested_text": suggested_text,
    }
    return {"event": json.dumps(payload, ensure_ascii=False)}


async def publish_event(redis: Redis, payload: dict[str, str]) -> str:
    return await redis.xadd(settings.redis_stream_key, payload, id="*")
