import json
from typing import Any

import pytest
from fastapi.testclient import TestClient

REFERENCE = "2030-01-15T12:00:00Z"
MATERIAL = {
    "cod_material": "M-1",
    "nombre": "Cable ficticio",
    "termino_busqueda": "cable ficticio",
}


def vtex(
    name: str, pid: str = "1", ean: str = "7800000000017", **offer: Any
) -> dict[str, Any]:
    commertial = {"Price": 900, "ListPrice": 1200, "IsAvailable": True} | offer
    return {
        "productId": pid,
        "productName": name,
        "brand": "Acme",
        "categories": ["/Ferreteria/Cables/", "/Ferreteria/"],
        "link": f"https://tienda.example/{pid}/p",
        "items": [{"ean": ean, "sellers": [{"commertialOffer": commertial}]}],
    }


def entity(eid: int, updated: str, registry: bool = True) -> dict[str, Any]:
    return {
        "id": eid,
        "name": "Cable ficticio USB",
        "ean": "12345678",
        "external_url": f"https://tienda.example/e/{eid}",
        "last_pricing_update": updated,
        "active_registry": {
            "timestamp": updated,
            "is_available": True,
            "normal_price": "10990.00",
            "offer_price": "9990.00",
        }
        if registry
        else None,
    }


def rhona_card(pid: int, name: str, price: str, before: str = "") -> str:
    url = f"https://tienda.example/producto/{pid}/x.html"
    return (
        '<div class="blockProducto "><div class="marca">'
        f'<a href="{url}">ACME</a></div><div class="titulo">'
        f'<a href="{url}">{name}</a><span class="descripcion"><a href="{url}">'
        'texto</a></span></div><div class="valor">'
        f'<a href="{url}">$  {price}</a> C/U'
        f'<div class="precio_antes">{before}</div></div></div>'
    )


def sodimac_card(key: str, brand: str, name: str, price: str) -> str:
    return (
        f'<a href="" data-pod="catalyst-pod" data-key="{key}"><img src="x.jpg"/>'
        f'<b class="pod-title">{brand}</b><b class="pod-subTitle">{name}</b>'
        f'<ol><li data-internet-price="{price}"><span>$ {price}</span></li></ol>'
        '<li class="wholesale">$ 1</li></a>'
    )


def call(client: TestClient, source: str, kind: str, *pages: str) -> dict[str, Any]:
    body = {
        "material": MATERIAL,
        "referencia": REFERENCE,
        "fuentes": [{"fuente": source, "tipo": kind, "contenido": list(pages)}],
    }
    response = client.post("/v1/precios/procesar", json=body)
    assert response.status_code == 200
    result: dict[str, Any] = response.json()["resultados"][0]
    return result


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


def test_vtex_source_maps_prices_ean_and_category(client: TestClient) -> None:
    page = json.dumps([vtex("Cable ficticio 2m", ean="EXRM-0302")])
    result = call(client, "dimeiggs", "json", page)
    assert result["estado"] == "ok"
    assert result["candidatos"][0] == {
        "id_externo": "1",
        "nombre": "Cable ficticio 2m",
        "marca": "Acme",
        "ean": None,
        "categoria_fuente": "Ferreteria > Cables",
        "precio_normal": 1200,
        "precio_oferta": 900,
        "disponible": True,
        "url": "https://tienda.example/1/p",
        "puntaje": 0.8,
    }


@pytest.mark.parametrize(
    ("ean", "expected"),
    [("12345678", "12345678"), ("7800000000017", "7800000000017"), ("123456789", None)],
)
def test_ean_keeps_only_8_or_13_digits(
    client: TestClient, ean: str, expected: str | None
) -> None:
    result = call(
        client, "dartel", "json", json.dumps([vtex("Cable ficticio", ean=ean)])
    )
    assert result["candidatos"][0]["ean"] == expected


def test_candidates_are_deduplicated_ordered_and_capped(client: TestClient) -> None:
    products = [vtex(f"Cable ficticio {i}", pid=str(i)) for i in range(7)]
    products.append(vtex("Cable ficticio duplicado", pid="0"))
    products.append(vtex("Cable acme ficticio exacto", pid="best", ean="x"))
    products.append(vtex("Martillo", pid="other"))
    result = call(client, "dartel", "json", json.dumps(products))
    ids = [c["id_externo"] for c in result["candidatos"]]
    scores = [c["puntaje"] for c in result["candidatos"]]
    assert len(ids) == 5
    assert ids.count("0") == 1 and "other" not in ids
    assert scores == sorted(scores, reverse=True)
    assert result["descartados"] == 5  # 1 duplicate, 1 unrelated, 3 past the top 5


def test_brand_adds_to_score(client: TestClient) -> None:
    material = {**MATERIAL, "termino_busqueda": "cable acme"}
    page = json.dumps([vtex("Cable largo", pid="1")])
    body = {
        "material": material,
        "referencia": REFERENCE,
        "fuentes": [{"fuente": "dartel", "tipo": "json", "contenido": [page]}],
    }
    result = client.post("/v1/precios/procesar", json=body).json()["resultados"][0]
    assert result["candidatos"][0]["puntaje"] == 0.6


def test_solotodo_keeps_only_active_and_recent_entries(client: TestClient) -> None:
    results = [
        entity(1, "2030-01-10T00:00:00Z"),
        entity(2, "2029-12-31T12:00:00Z"),  # exactly 15 days old
        entity(3, "2030-01-10T00:00:00Z", registry=False),
    ]
    result = call(client, "solotodo", "json", json.dumps({"results": results}))
    assert [c["id_externo"] for c in result["candidatos"]] == ["1"]
    assert result["candidatos"][0]["precio_normal"] == 10990
    assert result["candidatos"][0]["precio_oferta"] == 9990


def test_solotodo_all_stale_is_no_results_not_a_failure(client: TestClient) -> None:
    page = json.dumps({"results": [entity(1, "2029-01-01T00:00:00Z")]})
    result = call(client, "solotodo", "json", page)
    assert result["estado"] == "sin_resultados"


def test_rhona_html_cards(client: TestClient) -> None:
    page = rhona_card(7, "Cable ficticio 3m", "20.445", "$ 25.000") + rhona_card(
        8, "Cable ficticio", "1.500"
    )
    result = call(client, "rhona", "html", f"<html><body>{page}</body></html>")
    first, second = result["candidatos"]
    assert (first["id_externo"], first["nombre"]) == ("7", "Cable ficticio 3m")
    assert (first["precio_normal"], first["precio_oferta"]) == (25000, 20445)
    assert (second["precio_normal"], second["precio_oferta"]) == (1500, None)
    assert first["url"] == "https://tienda.example/producto/7/x.html"


def test_sodimac_html_cards_across_pages(client: TestClient) -> None:
    page_1 = sodimac_card("111", "ACME", "Cable ficticio 5m", "19.990")
    page_2 = sodimac_card("222", "ACME", "Cable ficticio 9m", "2.290")
    result = call(client, "sodimac", "html", page_1, page_2)
    assert [c["id_externo"] for c in result["candidatos"]] == ["111", "222"]
    assert result["candidatos"][0]["precio_normal"] == 19990
    assert result["candidatos"][0]["marca"] == "ACME"
    assert result["candidatos"][0]["url"].endswith("/articulo/111")


@pytest.mark.parametrize(
    ("source", "kind", "page"),
    [
        ("dartel", "json", "not json"),
        ("dartel", "json", '{"unexpected": true}'),
        ("dartel", "json", json.dumps([{"productId": 1}])),
        ("solotodo", "json", json.dumps([1, 2])),
        ("rhona", "html", "<html><body><p>layout changed</p></body></html>"),
        ("sodimac", "html", "<div data-pod='catalyst-pod'></div>"),
        ("sodimac", "json", "[]"),
    ],
)
def test_unparseable_content_is_reported_per_source(
    client: TestClient, source: str, kind: str, page: str
) -> None:
    result = call(client, source, kind, page)
    assert result["estado"] == "invalid_content"
    assert result["candidatos"] == []


def test_empty_catalog_has_no_results(client: TestClient) -> None:
    assert call(client, "dimeiggs", "json", "[]")["estado"] == "sin_resultados"


def test_one_bad_source_does_not_affect_the_others(client: TestClient) -> None:
    good = json.dumps([vtex("Cable ficticio")])
    body = {
        "material": MATERIAL,
        "referencia": REFERENCE,
        "fuentes": [
            {"fuente": "dartel", "tipo": "json", "contenido": [good]},
            {"fuente": "rhona", "tipo": "html", "contenido": ["<p>broken</p>"]},
        ],
    }
    response = client.post("/v1/precios/procesar", json=body)
    states = {r["fuente"]: r["estado"] for r in response.json()["resultados"]}
    assert states == {"dartel": "ok", "rhona": "invalid_content"}


@pytest.mark.parametrize(
    "patch",
    [
        {"fuentes": []},
        {"referencia": "2030-01-15T12:00:00"},
        {"material": {**MATERIAL, "termino_busqueda": ""}},
        {"fuentes": [{"fuente": "ebay", "tipo": "json", "contenido": ["[]"]}]},
        {"fuentes": [{"fuente": "dartel", "tipo": "json", "contenido": []}]},
        {"fuentes": [{"fuente": "dartel", "tipo": "json", "contenido": ["[]"]}] * 2},
    ],
)
def test_process_rejects_invalid_requests(
    client: TestClient, patch: dict[str, Any]
) -> None:
    valid = {
        "material": MATERIAL,
        "referencia": REFERENCE,
        "fuentes": [{"fuente": "dartel", "tipo": "json", "contenido": ["[]"]}],
    }
    response = client.post("/v1/precios/procesar", json=valid | patch)
    assert response.status_code == 422
    assert response.json() == {"error": "invalid_request"}


def test_openapi_documents_price_endpoints(client: TestClient) -> None:
    schema = client.get("/openapi.json").json()
    for path in ("/v1/precios/preparar", "/v1/precios/procesar"):
        responses = schema["paths"][path]["post"]["responses"]
        assert {"200", "422", "500"} <= set(responses)
