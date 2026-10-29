"""Чтение загруженного PDF клинрека из multipart-запроса."""

import asyncio
import hashlib
import io

import pytest
from starlette.datastructures import UploadFile

from app.config import DmsConfig
from app.services.check_dms.errors import DmsError
from app.services.check_dms.upload import read_pdf_upload

PDF_BYTES = b"%PDF-1.7\n" + b"0" * 2048


def _upload(data: bytes) -> UploadFile:
    return UploadFile(file=io.BytesIO(data), filename="kr.pdf", size=len(data))


def test_reads_pdf_and_returns_sha256() -> None:
    content, digest = asyncio.run(read_pdf_upload(_upload(PDF_BYTES), DmsConfig()))

    assert content == PDF_BYTES
    assert digest == hashlib.sha256(PDF_BYTES).hexdigest()


def test_rejects_non_pdf_content() -> None:
    with pytest.raises(DmsError) as error:
        asyncio.run(read_pdf_upload(_upload(b"<html>not a pdf</html>"), DmsConfig()))

    assert error.value.code == "pdf_invalid"
    assert error.value.status_code == 422


def test_rejects_empty_file() -> None:
    with pytest.raises(DmsError) as error:
        asyncio.run(read_pdf_upload(_upload(b""), DmsConfig()))

    assert error.value.code == "pdf_invalid"


def test_rejects_oversized_pdf() -> None:
    with pytest.raises(DmsError) as error:
        asyncio.run(read_pdf_upload(_upload(PDF_BYTES), DmsConfig(max_pdf_bytes=1024)))

    assert error.value.code == "pdf_too_large"
    assert error.value.status_code == 413
