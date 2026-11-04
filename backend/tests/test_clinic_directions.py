"""Совместимость направлений клиники: настройки, обе ссылки и обычный старт."""

import asyncio
from datetime import date
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from starlette.requests import Request

from app.routers import public_questionnaire as public
from app.schemas.clinic import ClinicCreate, ClinicPatch, ClinicRead
from app.schemas.clinic_admin import MyClinicRead
from app.schemas.questionnaire import PublicLinkDoctor, QuestionnaireCreateRequest
from app.services import questionnaire_invites as invites
from app.services.questionnaire_step import StepDescriptor


@pytest.mark.parametrize("kind", ["general", "dental", "mixed"])
def test_clinic_settings_and_responses_accept_supported_directions(kind):
    assert ClinicCreate(name="Тест", access_until=date(2030, 1, 1),
                        access_type="trial", questionnaire_kind=kind).questionnaire_kind == kind
    assert ClinicPatch(questionnaire_kind=kind).questionnaire_kind == kind
    clinic = ClinicRead(
        id=uuid4(), name="Тест", phone=None, email=None, logo_url=None,
        brand_color=None, doctors_limit=10, access_until=date(2030, 1, 1),
        access_type="trial", questionnaire_kind=kind, public_slug="test-clinic",
        access_status_code="trial", access_status_label="Пробный период",
        created_at="2026-11-03T00:00:00Z", updated_at=None, deleted_at=None,
    )
    mine = MyClinicRead(
        clinic_id=clinic.id, clinic_name=clinic.name, clinic_public_slug=clinic.public_slug,
        clinic_public_url="https://example.test/q/test-clinic", questionnaire_kind=kind,
        membership_id=uuid4(), is_clinic_admin=True, is_doctor=True,
    )
    assert clinic.questionnaire_kind == mine.questionnaire_kind == kind


def test_unknown_direction_is_rejected():
    with pytest.raises(ValidationError):
        ClinicPatch(questionnaire_kind="unknown")


@pytest.mark.parametrize("kind,allowed", [("general", False), ("dental", True), ("mixed", True)])
def test_personal_dental_links_require_dental_direction(monkeypatch, kind, allowed):
    monkeypatch.setattr(invites, "ensure_clinic_subscription_active", lambda clinic: None)
    db = MagicMock(commit=AsyncMock(), refresh=AsyncMock())
    coroutine = invites.create_invite(
        db, SimpleNamespace(id=uuid4(), questionnaire_kind=kind),
        last_name="Тестовый", first_name="Пациент", middle_name=None,
        created_by_membership_id=None,
    )
    if not allowed:
        with pytest.raises(HTTPException) as error:
            asyncio.run(coroutine)
        assert error.value.status_code == 409
        db.add.assert_not_called()
        return
    questionnaire, token = asyncio.run(coroutine)
    assert token and questionnaire.kind == "dental" and questionnaire.status == "invited"
    db.commit.assert_awaited_once()


def _clinic(kind):
    return SimpleNamespace(
        id=uuid4(), name="Тест", phone=None, logo_url=None, brand_color=None,
        public_slug="test-clinic", access_until=date(2030, 1, 1), access_type="trial",
        questionnaire_kind=kind,
    )


@pytest.mark.parametrize("kind,blocked", [("general", False), ("dental", True), ("mixed", False)])
@pytest.mark.parametrize("doctor_link", [False, True])
def test_general_link_remains_available_with_mixed_directions(monkeypatch, kind, blocked, doctor_link):
    membership = SimpleNamespace(id=uuid4(), status="active", is_doctor=True) if doctor_link else None
    monkeypatch.setattr(public, "_resolve_slug", AsyncMock(return_value=(_clinic(kind), membership)))
    monkeypatch.setattr(public, "_doctor_payload", AsyncMock(return_value=PublicLinkDoctor(
        membership_id=membership.id if membership else uuid4(), public_slug="test-doctor",
    )))
    monkeypatch.setattr(public, "list_active_doctors", AsyncMock(return_value=[]))
    monkeypatch.setattr(public, "clinic_daily_limit_exceeded", AsyncMock(return_value=False))
    response = asyncio.run(public.get_public_link("test-clinic", AsyncMock()))
    assert response.blocked is blocked
    assert response.block_code == ("invite_only" if blocked else None)
    assert response.link_type == ("doctor" if doctor_link else "clinic")


@pytest.mark.parametrize("kind,allowed", [("general", True), ("dental", False), ("mixed", True)])
@pytest.mark.parametrize("doctor_link", [False, True])
def test_general_start_remains_available_with_mixed_directions(monkeypatch, kind, allowed, doctor_link):
    membership = SimpleNamespace(id=uuid4(), status="active", is_doctor=True) if doctor_link else None
    monkeypatch.setattr(public, "_resolve_slug", AsyncMock(return_value=(_clinic(kind), membership)))
    monkeypatch.setattr(public, "ensure_clinic_subscription_active", lambda clinic: None)
    for name in ["check_clinic_daily_limit", "check_device_limit", "check_ip_limit"]:
        monkeypatch.setattr(public, name, AsyncMock())
    monkeypatch.setattr(public, "resolve_initial_step", AsyncMock(return_value="choose_doctor"))
    monkeypatch.setattr(public, "build_step_descriptor", AsyncMock(return_value=StepDescriptor(
        step_key="choose_doctor", step_type="single_choice",
    )))
    db = MagicMock(flush=AsyncMock(), commit=AsyncMock())
    async def refresh(questionnaire):
        questionnaire.id = uuid4()
    db.refresh = AsyncMock(side_effect=refresh)
    request = Request({"type": "http", "headers": [], "client": ("127.0.0.1", 12345)})
    coroutine = public.create_questionnaire(
        QuestionnaireCreateRequest(slug="test-clinic"), request, db, x_device_id="test-device",
    )
    if not allowed:
        with pytest.raises(HTTPException) as error:
            asyncio.run(coroutine)
        assert error.value.status_code == 403
        assert error.value.detail["code"] == "invite_only"
        db.add.assert_not_called()
        return
    response = asyncio.run(coroutine)
    assert response.token and response.step.step_key == "choose_doctor"
    questionnaire = db.add.call_args.args[0]
    assert questionnaire.doctor_membership_id == (membership.id if membership else None)
    assert public.resolve_initial_step.await_args.kwargs["doctor_preselected"] is doctor_link
    db.commit.assert_awaited_once()
