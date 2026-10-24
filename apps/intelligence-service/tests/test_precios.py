import pytest
from fastapi.testclient import TestClient


def test_prepare_blocks_logo_materials(client: TestClient) -> None:
    body = {"cod_material": "M-1", "nombre": "Polera con LOGO bordado"}
    response = client.post("/v1/precios/preparar", json=body)
    assert response.json() == {
        "termino_busqueda": "polera logo bordado",
        "cotizable": False,
        "motivo": "personalizado",
    }


@pytest.mark.parametrize(
    "nombre",
    [
        "Guante nitrilo talla 40",
        "Guante nitrilo T-42",
        "Guante nitrilo XL",
        "Guante nitrilo S",
    ],
)
def test_prepare_strips_sizes_and_still_quotes(client: TestClient, nombre: str) -> None:
    response = client.post(
        "/v1/precios/preparar", json={"cod_material": "1", "nombre": nombre}
    )
    assert response.json() == {
        "termino_busqueda": "guante nitrilo",
        "cotizable": True,
        "motivo": None,
    }


def test_prepare_without_term_is_not_quotable(client: TestClient) -> None:
    response = client.post(
        "/v1/precios/preparar", json={"cod_material": "1", "nombre": "Talla XL"}
    )
    assert response.json()["motivo"] == "sin_termino"
    assert response.json()["cotizable"] is False


def test_openapi_documents_prepare_endpoint(client: TestClient) -> None:
    schema = client.get("/openapi.json").json()
    responses = schema["paths"]["/v1/precios/preparar"]["post"]["responses"]
    assert {"200", "422", "500"} <= set(responses)
