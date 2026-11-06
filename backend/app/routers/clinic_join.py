"""Общие ссылки клиники: публичная регистрация и собственный статус."""
import asyncio
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
from ..config import settings
from ..db import get_db
from ..deps import get_identity_user
from ..email import send_registration_code
from ..models.clinic_join import ClinicJoinLink, ClinicJoinRequest
from ..models.registration_pending import RegistrationPending
from ..models.service_user import ServiceUser
from ..models.specialization import RefSpecialization
from ..models.user_settings import UserSettings
from ..schemas.auth import RegisterConfirmRequest, RegisterResponse, TokenResponse
from ..schemas.clinic_join import JoinPreview, JoinRegistration, JoinSubmission, JoinRequestRead, JoinStatus
from ..security import generate_registration_code, hash_password, hash_registration_code, verify_registration_code
from ..services.clinic_join import create_join_request, ensure_role_specializations, load_join_link, read_request, read_requests
from ..services.clinic_members import validate_specialization_ids
from ..services.questionnaire_limits import hash_ip
from ..services.redis_stream import get_redis_client
from ..services.roles import set_user_role
from .auth import _attach_session_tokens

router = APIRouter(tags=['clinic-join'])


async def check_join_rate(request: Request, scope: str, identity: str = ''):
    """Redis provides one limit across workers. Tokens/emails are never put into keys."""
    client = get_redis_client()
    key = f'join:{scope}:{hash_ip(identity or (request.client.host if request.client else "unknown"))}'
    limit, window = (60, 60) if scope == 'preview' else (10, 900)
    try:
        count = await client.eval(
            "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n",
            1, key, window,
        )
    except Exception as exc:
        raise HTTPException(503, 'Проверка частоты запросов временно недоступна') from exc
    finally:
        await client.aclose()
    if int(count) > limit:
        raise HTTPException(429, 'Слишком много запросов. Попробуйте позднее')


@router.get('/auth/clinic-join/{token}', response_model=JoinPreview)
async def preview(token: str, request: Request, db: AsyncSession = Depends(get_db)):
    await check_join_rate(request, 'preview')
    if len(token) > 128 or len(token) < 32:
        raise HTTPException(404, 'Ссылка подключения недоступна')
    _, clinic = await load_join_link(db, token)
    specs = (await db.execute(select(RefSpecialization).where(RefSpecialization.id.is_not(None)).order_by(RefSpecialization.name))).scalars().all()
    return JoinPreview(clinic_id=clinic.id, clinic_name=clinic.name,
        roles=[{'value':'operator','label':'Оператор контакт-центра'}, {'value':'doctor','label':'Врач'}],
        specializations=[{'id':s.id,'code':s.code,'name':s.name} for s in specs])


@router.post('/auth/clinic-join/register', response_model=RegisterResponse)
async def register(payload: JoinRegistration, request: Request, db: AsyncSession = Depends(get_db)):
    await check_join_rate(request, 'register')
    login = str(payload.login).strip().lower()
    await check_join_rate(request, 'register-email', login)
    link, _ = await load_join_link(db, payload.token)
    ensure_role_specializations(payload.requested_role, payload.specialization_ids)
    ids = await validate_specialization_ids(db, payload.specialization_ids)
    existing = (await db.execute(select(ServiceUser.id).where(func.lower(ServiceUser.login) == login))).scalar_one_or_none()
    if existing:
        raise HTTPException(409, 'Почта уже зарегистрирована. Войдите в свою учётную запись')
    pending = (await db.execute(select(RegistrationPending).where(func.lower(RegistrationPending.login) == login).with_for_update())).scalar_one_or_none()
    code = generate_registration_code()
    values = dict(password_hash=hash_password(payload.password), code_hash=hash_registration_code(login, code),
        expires_at=datetime.now(timezone.utc)+timedelta(minutes=settings.registration_code_expire_minutes), code_attempts=0,
        clinic_join_context={'link_id':str(link.id), 'requested_role':payload.requested_role,
            'specialization_ids':ids, 'first_name':payload.first_name,'last_name':payload.last_name,'middle_name':payload.middle_name})
    if pending is None:
        pending = RegistrationPending(login=login, **values)
        db.add(pending)
    else:
        for name, value in values.items():
            setattr(pending, name, value)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(409, 'Регистрация уже изменена. Повторите запрос') from exc
    try:
        await asyncio.to_thread(send_registration_code, login, code)
    except Exception as exc:
        raise HTTPException(503, 'Не удалось отправить код подтверждения') from exc
    return RegisterResponse()


@router.post('/auth/clinic-join/confirm', response_model=TokenResponse)
async def confirm(payload: RegisterConfirmRequest, response: Response, request: Request, db: AsyncSession = Depends(get_db)):
    await check_join_rate(request, 'confirm')
    login = str(payload.login).strip().lower()
    # Read context without a row lock, then always lock clinic -> link -> pending.
    # Registration and rotation use the same order, preventing a lock cycle.
    from uuid import UUID
    from ..services.clinic_join import lock_clinic, ensure_join_available
    pending_stmt = select(RegistrationPending).where(func.lower(RegistrationPending.login) == login)
    pending = (await db.execute(pending_stmt)).scalar_one_or_none()
    if pending is None or not pending.clinic_join_context:
        raise HTTPException(400, 'Нет регистрации по ссылке клиники')
    link_id = UUID(pending.clinic_join_context['link_id'])
    link = (await db.execute(select(ClinicJoinLink).where(ClinicJoinLink.id == link_id))).scalar_one_or_none()
    if link is None:
        raise HTTPException(404, 'Ссылка подключения недоступна')
    clinic = await lock_clinic(db, link.clinic_id)
    link = (await db.execute(select(ClinicJoinLink).where(ClinicJoinLink.id == link_id, ClinicJoinLink.revoked_at.is_(None)).with_for_update().execution_options(populate_existing=True))).scalar_one_or_none()
    if link is None:
        raise HTTPException(404, 'Ссылка подключения отключена')
    ensure_join_available(clinic)
    pending = (await db.execute(pending_stmt.with_for_update().execution_options(populate_existing=True))).scalar_one_or_none()
    if pending is None or not pending.clinic_join_context or pending.clinic_join_context['link_id'] != str(link_id):
        raise HTTPException(409, 'Регистрация изменилась. Запросите новый код')
    if pending.expires_at < datetime.now(timezone.utc):
        raise HTTPException(400, 'Срок кода подтверждения истёк')
    if pending.code_attempts >= settings.registration_code_max_attempts:
        raise HTTPException(429, 'Превышено количество попыток')
    if not verify_registration_code(login, payload.code, pending.code_hash):
        pending.code_attempts += 1
        await db.commit()
        raise HTTPException(400, 'Неверный код')
    context = pending.clinic_join_context
    if (await db.execute(select(ServiceUser.id).where(func.lower(ServiceUser.login) == login))).scalar_one_or_none():
        raise HTTPException(409, 'Почта уже зарегистрирована')
    user = ServiceUser(login=login, password_hash=pending.password_hash, is_active=True, clinic_join_restricted=True,
        first_name=context['first_name'],last_name=context['last_name'],middle_name=context.get('middle_name'))
    db.add(user)
    try:
        await db.flush()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(409, 'Почта уже зарегистрирована') from exc
    await set_user_role(db, user, 'doctor')
    db.add(UserSettings(user_id=user.id))
    await create_join_request(db, user, clinic, context['requested_role'], context['specialization_ids'])
    await db.delete(pending)
    try:
        return await _attach_session_tokens(response, db, user)
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(409, 'Почта уже зарегистрирована') from exc


@router.post('/clinic-join/requests', response_model=JoinRequestRead)
async def submit(payload: JoinSubmission, request: Request, user: ServiceUser = Depends(get_identity_user), db: AsyncSession = Depends(get_db)):
    await check_join_rate(request, 'submit', str(user.id))
    _, clinic = await load_join_link(db, payload.token)
    item = await create_join_request(db, user, clinic, payload.requested_role, payload.specialization_ids)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(409, 'Заявка уже отправлена') from exc
    return await read_request(db, item)


@router.get('/clinic-join/me', response_model=JoinStatus)
async def my_status(user: ServiceUser = Depends(get_identity_user), db: AsyncSession = Depends(get_db)):
    items = (await db.execute(select(ClinicJoinRequest).where(ClinicJoinRequest.user_id == user.id).order_by(ClinicJoinRequest.created_at.desc(), ClinicJoinRequest.id.desc()).limit(100))).scalars().all()
    return JoinStatus(restricted=user.clinic_join_restricted, requests=await read_requests(db, items))
