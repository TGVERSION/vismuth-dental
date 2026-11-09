from io import BytesIO
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from PIL import Image

from app import deps
from app.db import get_db
from app.main import app
from app.services.clinic_logo import MAX_LOGO_BYTES, normalize_logo


@pytest.mark.parametrize('format', ['PNG', 'JPEG', 'WEBP'])
def test_logo_validates_image_and_resizes_without_losing_aspect(format):
    source = BytesIO()
    Image.new('RGB', (2400, 800), 'blue').save(source, format=format)
    output = normalize_logo(source.getvalue())
    with Image.open(BytesIO(output)) as image:
        assert image.format == 'PNG' and image.size == (1200, 400)


@pytest.mark.parametrize('data,code', [(b'<svg onload="alert(1)"></svg>',422), (b'not an image',422),
                                    (b'x'*(MAX_LOGO_BYTES+1),413)])
def test_invalid_logo_rejected(data, code):
    with pytest.raises(HTTPException) as error:
        normalize_logo(data)
    assert error.value.status_code == code


def test_logo_rejects_excess_dimensions():
    source = BytesIO()
    Image.new('RGB', (4097, 1)).save(source, format='PNG')
    with pytest.raises(HTTPException) as error:
        normalize_logo(source.getvalue())
    assert error.value.status_code == 422


def test_logo_upload_requires_clinic_admin_and_public_missing_does_not_read_storage(monkeypatch):
    from app.services import clinic_logo
    def unexpected(*args):
        raise AssertionError('Storage must not be accessed')
    monkeypatch.setattr(clinic_logo, 'read_logo', unexpected)
    class DB:
        async def execute(self, statement):
            return SimpleNamespace(scalar_one_or_none=lambda: None)
    with TestClient(app) as client:
        assert client.put(f'/clinics/{uuid4()}/logo', content=b'png').status_code == 401
    app.dependency_overrides[deps.get_current_user] = lambda: SimpleNamespace(id=uuid4(),role='doctor')
    app.dependency_overrides[get_db] = lambda: DB()
    try:
        with TestClient(app) as client:
            assert client.put(f'/clinics/{uuid4()}/logo', content=b'png').status_code == 403
            assert client.get(f'/public/clinic-logos/{uuid4()}/{uuid4()}.png').status_code == 404
    finally:
        app.dependency_overrides.clear()
