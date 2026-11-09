"""Standalone, client-only speech recognition probe for real mobile browsers."""
from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import HTMLResponse

router = APIRouter(tags=['system'])
_PAGE = Path(__file__).resolve().parents[1] / 'static' / 'voice-input-test.html'


@router.get('/public/voice-input-test', response_class=HTMLResponse, include_in_schema=False)
def voice_input_test():
    return HTMLResponse(_PAGE.read_text(encoding='utf-8'), headers={
        'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow',
        'X-Content-Type-Options': 'nosniff',
    })
