from fastapi.testclient import TestClient

from app.main import app


def test_mobile_voice_probe_is_standalone_public_nonindexed_and_uncached():
    with TestClient(app) as client:
        response = client.get('/public/voice-input-test')
    assert response.status_code == 200
    assert response.headers['content-type'].startswith('text/html')
    assert response.headers['cache-control'] == 'no-store'
    assert response.headers['x-robots-tag'] == 'noindex, nofollow'
    assert 'Начать голосовой ввод' in response.text
    assert 'webkitSpeechRecognition' in response.text
