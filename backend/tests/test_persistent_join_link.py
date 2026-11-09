import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4
import pytest
from fastapi import HTTPException
from app.services import clinic_join as service


def link():
    return SimpleNamespace(id=uuid4(), clinic_id=uuid4(), token_hash='a'*64, revoked_at=None)


def test_signed_token_stable_and_bound_to_link_and_clinic():
    item=link()
    first=service.displayed_join_token(item)
    assert len(first)==97 and service.displayed_join_token(item)==first
    item.clinic_id=uuid4()
    assert service.displayed_join_token(item)!=first


def test_read_existing_link_does_not_rotate(monkeypatch):
    item=link()
    db=AsyncMock()
    db.execute.return_value=SimpleNamespace(scalar_one_or_none=lambda:item)
    monkeypatch.setattr(service,'lock_clinic',AsyncMock(return_value=SimpleNamespace(deleted_at=None)))
    rotate=AsyncMock();monkeypatch.setattr(service,'rotate_join_link',rotate)
    assert asyncio.run(service.current_join_token(db,item.clinic_id,SimpleNamespace(id=uuid4())))==service.displayed_join_token(item)
    rotate.assert_not_awaited()


def test_missing_link_created_once_under_clinic_lock(monkeypatch):
    db=AsyncMock();db.execute.return_value=SimpleNamespace(scalar_one_or_none=lambda:None)
    monkeypatch.setattr(service,'lock_clinic',AsyncMock(return_value=SimpleNamespace(deleted_at=None)))
    rotate=AsyncMock(return_value='new');monkeypatch.setattr(service,'rotate_join_link',rotate)
    assert asyncio.run(service.current_join_token(db,uuid4(),SimpleNamespace(id=uuid4())))=='new'
    rotate.assert_awaited_once()


def test_tampered_signed_token_rejected_before_clinic_lookup(monkeypatch):
    item=link();db=AsyncMock();db.execute.return_value=SimpleNamespace(scalar_one_or_none=lambda:item)
    lock=AsyncMock();monkeypatch.setattr(service,'lock_clinic',lock)
    with pytest.raises(HTTPException) as err:
        asyncio.run(service.load_join_link(db,item.id.hex+'.'+'0'*64))
    assert err.value.status_code==404
    lock.assert_not_awaited()
