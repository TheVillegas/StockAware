import pytest
from fastapi.testclient import TestClient

from app.main import app

TOKEN = "token-de-prueba-123456"


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    """Client authenticated as NestJS (BE-03 service token)."""
    monkeypatch.setenv("INTELLIGENCE_SERVICE_TOKEN", TOKEN)
    return TestClient(app, headers={"X-Service-Token": TOKEN})


@pytest.fixture
def anonimo(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    """Client without the service token, as a direct caller from the internet."""
    monkeypatch.setenv("INTELLIGENCE_SERVICE_TOKEN", TOKEN)
    return TestClient(app)
