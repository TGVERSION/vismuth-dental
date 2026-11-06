from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ...db import get_db
from ...deps import require_roles
from ...schemas.user_membership import UserMembershipRead, UserMembershipUpdate
from ...services.user_membership import assign_user_membership, list_user_memberships


router = APIRouter(prefix='/super-admin', tags=['super-admin-users'], dependencies=[Depends(require_roles('super_admin'))])


@router.get('/user-membership-roles')
async def membership_roles():
    return [
        {'value':'doctor', 'label':'Врач'},
        {'value':'operator', 'label':'Оператор контакт-центра'},
        {'value':'clinic_admin', 'label':'Администратор клиники'},
        {'value':'clinic_admin_doctor', 'label':'Администратор клиники и врач'},
    ]


@router.get('/users', response_model=list[UserMembershipRead])
async def users(db: AsyncSession = Depends(get_db)):
    return await list_user_memberships(db)


@router.put('/users/{user_id}/membership', response_model=UserMembershipRead)
async def update_membership(user_id: UUID, payload: UserMembershipUpdate, db: AsyncSession = Depends(get_db)):
    return await assign_user_membership(db, user_id, payload)
