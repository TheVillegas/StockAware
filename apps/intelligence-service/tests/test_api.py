import json

from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.main import (
    EchoRequest,
    app,
    handle_internal_error,
    handle_invalid_request,
)


def test_health_returns_ok(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "intelligence-service"}


def test_echo_returns_message(client: TestClient) -> None:
    response = client.post("/v1/echo", json={"mensaje": "hola"})
    assert response.status_code == 200
    assert response.json() == {"eco": "hola", "servicio": "intelligence-service"}


def test_echo_rejects_missing_body(client: TestClient) -> None:
    response = client.post(
        "/v1/echo",
        content=b"",
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 422
    assert response.json() == {"error": "invalid_request"}


def test_echo_rejects_empty_message(client: TestClient) -> None:
    response = client.post("/v1/echo", json={"mensaje": ""})
    assert response.status_code == 422
    assert response.json() == {"error": "invalid_request"}


def test_echo_rejects_oversized_message(client: TestClient) -> None:
    response = client.post("/v1/echo", json={"mensaje": "x" * 501})
    assert response.status_code == 422
    assert response.json() == {"error": "invalid_request"}


def test_normalizar_real_phrase(client: TestClient) -> None:
    response = client.post(
        "/v1/materiales/normalizar",
        json={"descripcion": "Guantes de nitrilo, guantes"},
    )
    assert response.status_code == 200
    assert response.json() == {
        "tokens": ["guantes", "nitrilo"],
        "descripcion_normalizada": "guantes nitrilo",
        "servicio": "intelligence-service",
    }


def test_normalizar_rejects_empty_input(client: TestClient) -> None:
    response = client.post("/v1/materiales/normalizar", json={"descripcion": ""})
    assert response.status_code == 422
    assert response.json() == {"error": "invalid_request"}


def test_normalizar_drops_duplicate_tokens(client: TestClient) -> None:
    response = client.post(
        "/v1/materiales/normalizar",
        json={"descripcion": "nitrilo nitrilo extra"},
    )
    assert response.status_code == 200
    assert response.json()["tokens"] == ["nitrilo", "extra"]
    assert response.json()["descripcion_normalizada"] == "nitrilo extra"


def test_normalizar_rejects_description_with_no_tokens(client: TestClient) -> None:
    response = client.post(
        "/v1/materiales/normalizar",
        json={"descripcion": "de la y"},
    )
    assert response.status_code == 422
    assert response.json() == {"error": "invalid_request"}


def test_echo_rejects_non_json_body(client: TestClient) -> None:
    response = client.post(
        "/v1/echo",
        content=b"not-json",
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 422
    assert response.json() == {"error": "invalid_request"}


def test_app_registers_controlled_error_handlers() -> None:
    assert app.exception_handlers[RequestValidationError] is handle_invalid_request
    assert app.exception_handlers[Exception] is handle_internal_error


def test_invalid_request_handler_returns_controlled_json() -> None:
    request = Request(
        {
            "type": "http",
            "asgi": {"version": "3.0"},
            "http_version": "1.1",
            "method": "POST",
            "scheme": "http",
            "path": "/v1/echo",
            "raw_path": b"/v1/echo",
            "query_string": b"",
            "headers": [],
            "client": ("testclient", 50000),
            "server": ("testserver", 80),
        }
    )
    try:
        EchoRequest.model_validate({})
    except ValidationError as exc:
        validation_error = RequestValidationError(exc.errors())
    else:
        raise AssertionError("expected EchoRequest validation to fail")

    response = handle_invalid_request(request, validation_error)
    assert response.status_code == 422
    assert json.loads(bytes(response.body)) == {"error": "invalid_request"}


def test_internal_error_handler_returns_controlled_json() -> None:
    request = Request(
        {
            "type": "http",
            "asgi": {"version": "3.0"},
            "http_version": "1.1",
            "method": "GET",
            "scheme": "http",
            "path": "/health",
            "raw_path": b"/health",
            "query_string": b"",
            "headers": [],
            "client": ("testclient", 50000),
            "server": ("testserver", 80),
        }
    )
    response = handle_internal_error(request, RuntimeError("boom"))
    assert response.status_code == 500
    assert json.loads(bytes(response.body)) == {"error": "internal_error"}
