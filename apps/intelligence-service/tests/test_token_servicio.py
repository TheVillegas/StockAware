import pytest
from fastapi.testclient import TestClient

from app.main import app
from tests.conftest import TOKEN

PROTEGIDAS = [
    ("POST", "/v1/echo", {"mensaje": "hola"}),
    ("POST", "/v1/materiales/normalizar", {"descripcion": "Guante"}),
    ("POST", "/v1/precios/preparar", {"cod_material": "M-1", "nombre": "Cable"}),
    ("POST", "/v1/recomendaciones/ranking", {"referencia": "x", "items": []}),
]


@pytest.mark.parametrize(("metodo", "ruta", "cuerpo"), PROTEGIDAS)
def test_sin_token_responde_401(
    anonimo: TestClient, metodo: str, ruta: str, cuerpo: dict[str, object]
) -> None:
    response = anonimo.request(metodo, ruta, json=cuerpo)
    assert response.status_code == 401
    assert response.json() == {"error": "unauthorized"}


@pytest.mark.parametrize("token", ["otro-token", "", TOKEN + "x", TOKEN[:-1]])
def test_token_incorrecto_responde_401(anonimo: TestClient, token: str) -> None:
    response = anonimo.post(
        "/v1/echo", json={"mensaje": "hola"}, headers={"X-Service-Token": token}
    )
    assert response.status_code == 401
    assert response.json() == {"error": "unauthorized"}


def test_token_correcto_pasa(anonimo: TestClient) -> None:
    response = anonimo.post(
        "/v1/echo", json={"mensaje": "hola"}, headers={"X-Service-Token": TOKEN}
    )
    assert response.status_code == 200
    assert response.json()["eco"] == "hola"


def test_health_no_exige_token(anonimo: TestClient) -> None:
    assert anonimo.get("/health").status_code == 200


def test_sin_token_configurado_rechaza_todo(monkeypatch: pytest.MonkeyPatch) -> None:
    """Fail closed: a missing secret must not open the service."""
    monkeypatch.delenv("INTELLIGENCE_SERVICE_TOKEN", raising=False)
    client = TestClient(app)
    response = client.post(
        "/v1/echo", json={"mensaje": "hola"}, headers={"X-Service-Token": ""}
    )
    assert response.status_code == 401
    assert client.get("/health").status_code == 200


def test_rechazo_conserva_correlacion(anonimo: TestClient) -> None:
    response = anonimo.post(
        "/v1/echo", json={"mensaje": "hola"}, headers={"x-request-id": "corr-401-abc"}
    )
    assert response.status_code == 401
    assert response.headers["x-request-id"] == "corr-401-abc"
