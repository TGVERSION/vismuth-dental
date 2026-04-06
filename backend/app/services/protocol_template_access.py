"""Доступ к шаблонам протокола: те же правила, что у GET /protocol-templates/{id}."""

from uuid import UUID

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.protocol_template import ProtocolTemplate
from ..models.service_user import ServiceUser
from ..schemas.protocol_template import ProtocolPrivacy


async def get_accessible_protocol_template(
    db: AsyncSession,
    *,
    template_id: UUID,
    user: ServiceUser,
) -> ProtocolTemplate | None:
    """Общий шаблон или личный шаблон текущего пользователя; не удалённый."""
    stmt = (
        select(ProtocolTemplate)
        .where(
            ProtocolTemplate.id == template_id,
            ProtocolTemplate.deleted_at.is_(None),
            or_(
                ProtocolTemplate.privacy == ProtocolPrivacy.general.value,
                and_(
                    ProtocolTemplate.privacy == ProtocolPrivacy.personal.value,
                    ProtocolTemplate.creator_id == user.id,
                ),
            ),
        )
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()
