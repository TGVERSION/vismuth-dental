"""Скачивание PDF клинрека и локальный кэш файла."""

import asyncio
import hashlib
import uuid
from pathlib import Path

import httpx
import pytest

from app.config import DmsConfig
from app.services.check_dms.errors import DmsError
from app.services.check_dms.source import download_pdf, save_pdf

PDF_BYTES = b"%PDF-1.7\n" + b"0" * 2048


def _client(handler) -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


def test_downloads_pdf_and_returns_sha256() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, content=PDF_BYTES)

    async def run() -> tuple[bytes, str]:
        async with _client(handler) as client:
            return await download_pdf("https://s3.local/source.pdf", DmsConfig(), client)

    content, digest = asyncio.run(run())

    assert content == PDF_BYTES
    assert digest == hashlib.sha256(PDF_BYTES).hexdigest()


def test_rejects_non_pdf_content() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, content=b"<html>not a pdf</html>")

    async def run() -> None:
        async with _client(handler) as client:
            await download_pdf("https://s3.local/source.pdf", DmsConfig(), client)

    with pytest.raises(DmsError) as error:
        asyncio.run(run())

    assert error.value.code == "pdf_invalid"
    assert error.value.status_code == 422


def test_rejects_oversized_pdf() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, content=PDF_BYTES, headers={"content-length": str(len(PDF_BYTES))})

    async def run() -> None:
        async with _client(handler) as client:
            await download_pdf(
                "https://s3.local/source.pdf",
                DmsConfig(max_pdf_bytes=1024),
                client,
            )

    with pytest.raises(DmsError) as error:
        asyncio.run(run())

    assert error.value.code == "pdf_too_large"
    assert error.value.status_code == 413


def test_reports_missing_object() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(404)

    async def run() -> None:
        async with _client(handler) as client:
            await download_pdf("https://s3.local/missing.pdf", DmsConfig(), client)

    with pytest.raises(DmsError) as error:
        asyncio.run(run())

    assert error.value.code == "s3_not_found"


def test_reports_timeout() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("slow", request=request)

    async def run() -> None:
        async with _client(handler) as client:
            await download_pdf("https://s3.local/slow.pdf", DmsConfig(), client)

    with pytest.raises(DmsError) as error:
        asyncio.run(run())

    assert error.value.code == "s3_timeout"
    assert error.value.status_code == 504


def test_save_pdf_is_idempotent() -> None:
    directory = Path("storage/test-pdfs") / uuid.uuid4().hex
    config = DmsConfig(pdf_dir=str(directory))
    digest = hashlib.sha256(PDF_BYTES).hexdigest()

    first = save_pdf(PDF_BYTES, digest, config)
    second = save_pdf(PDF_BYTES, digest, config)

    assert first == second
    assert first.read_bytes() == PDF_BYTES
    assert len(list(directory.glob("*.pdf"))) == 1
