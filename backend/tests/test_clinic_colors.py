"""Independent persisted colors and public branding contract."""
import asyncio
from datetime import date
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from pydantic import ValidationError
from app.schemas.clinic import ClinicCreate, ClinicPatch
from app.schemas.clinic_admin import ClinicAdminPatch
from app.routers import public_questionnaire as public


@pytest.mark.parametrize('schema', [ClinicPatch, ClinicAdminPatch])
def test_each_color_patch_is_independent(schema):
    assert schema(button_color='#125D38').model_dump(exclude_unset=True) == {'button_color':'#125D38'}
    assert schema(brand_color='#F3F8FD').model_dump(exclude_unset=True) == {'brand_color':'#F3F8FD'}
    assert schema(button_color=None).model_dump(exclude_unset=True) == {'button_color':None}


@pytest.mark.parametrize('value', ['red', '#FFF', 'url(x)', '#1234567'])
def test_button_color_requires_complete_hex(value):
    with pytest.raises(ValidationError):
        ClinicPatch(button_color=value)


def test_existing_clinic_can_keep_background_without_configuring_buttons():
    value=ClinicCreate(name='Test',access_until=date(2030,1,1),access_type='trial',brand_color='#F3F8FD')
    assert value.brand_color=='#F3F8FD' and value.button_color is None


@pytest.mark.parametrize('kind,expired', [('general',False),('mixed',False),('dental',False),('general',True)])
def test_public_link_returns_both_colors_including_blocked_links(monkeypatch,kind,expired):
    clinic=SimpleNamespace(id=uuid4(),name='Test',phone=None,logo_url=None,brand_color='#F3F8FD',button_color='#125D38',public_slug='test-clinic',questionnaire_kind=kind,access_type='trial',access_until=date(2020 if expired else 2030,1,1))
    monkeypatch.setattr(public,'_resolve_slug',AsyncMock(return_value=(clinic,None)))
    monkeypatch.setattr(public,'list_active_doctors',AsyncMock(return_value=[]))
    monkeypatch.setattr(public,'clinic_daily_limit_exceeded',AsyncMock(return_value=False))
    result=asyncio.run(public.get_public_link('test-clinic',db=AsyncMock()))
    assert result.brand_color=='#F3F8FD' and result.button_color=='#125D38'
