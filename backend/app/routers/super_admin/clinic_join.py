from typing import Literal
from uuid import UUID
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from ...config import settings
from ...db import get_db
from ...deps import require_roles
from ...models.clinic_join import ClinicJoinLink, ClinicJoinRequest
from ...models.service_user import ServiceUser
from ...schemas.clinic_join import JoinRequestRead, JoinRequestList
from ...services.clinic_join import lock_clinic, read_request, read_requests, review_join_request, revoke_join_link, rotate_join_link

router = APIRouter(prefix='/super-admin', tags=['super-admin-clinic-join'], dependencies=[Depends(require_roles('super_admin'))])


@router.get('/clinics/{clinic_id}/join-link')
async def link_status(clinic_id: UUID, db: AsyncSession = Depends(get_db)):
    await lock_clinic(db, clinic_id)
    link = (await db.execute(select(ClinicJoinLink.id).where(ClinicJoinLink.clinic_id == clinic_id, ClinicJoinLink.revoked_at.is_(None)))).scalar_one_or_none()
    return {'active':link is not None}


@router.post('/clinics/{clinic_id}/join-link')
async def create_link(clinic_id: UUID, user: ServiceUser = Depends(require_roles('super_admin')), db: AsyncSession = Depends(get_db)):
    token = await rotate_join_link(db, clinic_id, user)
    return {'url':f'{settings.frontend_public_url.rstrip("/")}/clinic-join/{token}', 'active':True}


@router.delete('/clinics/{clinic_id}/join-link')
async def delete_link(clinic_id: UUID, db: AsyncSession = Depends(get_db)):
    await revoke_join_link(db, clinic_id)
    return {'active':False}


@router.get('/join-requests', response_model=JoinRequestList)
async def requests(clinic_id: UUID | None = None, status: Literal['pending','approved','rejected'] = 'pending', page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=100), db: AsyncSession = Depends(get_db)):
    stmt = select(ClinicJoinRequest).where(ClinicJoinRequest.status == status)
    if clinic_id:
        stmt = stmt.where(ClinicJoinRequest.clinic_id == clinic_id)
    total = int((await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one())
    rows = (await db.execute(stmt.order_by(ClinicJoinRequest.created_at.desc(),ClinicJoinRequest.id.desc()).offset((page-1)*page_size).limit(page_size))).scalars().all()
    return JoinRequestList(items=await read_requests(db,rows), total=total)


@router.post('/join-requests/{request_id}/approve', response_model=JoinRequestRead)
async def approve(request_id: UUID, user: ServiceUser = Depends(require_roles('super_admin')), db: AsyncSession = Depends(get_db)):
    return await review_join_request(db, request_id, user, 'approved')


@router.post('/join-requests/{request_id}/reject', response_model=JoinRequestRead)
async def reject(request_id: UUID, user: ServiceUser = Depends(require_roles('super_admin')), db: AsyncSession = Depends(get_db)):
    return await review_join_request(db, request_id, user, 'rejected')
