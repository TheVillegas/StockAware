from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.recomendaciones.models import ItemRanking
from app.recomendaciones.service import cantidad_sugerida, evaluar

REFERENCIA = datetime(2026, 11, 20, 12, 0, tzinfo=UTC)
URL = "/v1/recomendaciones/ranking"


def item(**cambios: Any) -> ItemRanking:
    base: dict[str, Any] = {
        "cod_material": "M-001",
        "stock": None,
        "stock_minimo": None,
        "consumo_diario": None,
        "consumo_reciente": None,
        "ultimo_precio": None,
        "precio_externo": None,
        "precio_externo_obtenido_en": None,
    }
    base.update(cambios)
    return ItemRanking(**base)


def razon(resultado: Any, factor: str) -> Any:
    return next(r for r in resultado.razones if r.factor == factor)


def test_sin_datos_lista_todos_los_factores_faltantes() -> None:
    r = evaluar(item(), REFERENCIA)
    assert r.puntaje == 0
    assert r.razones == []
    assert r.factores_faltantes == [
        "cobertura_dias",
        "bajo_minimo",
        "consumo_reciente",
        "ultimo_precio_pagado",
        "precio_externo_vigente",
    ]


@pytest.mark.parametrize(
    ("stock", "consumo", "valor", "score"),
    [
        (0, 1.0, 0, 1.0),
        (-5, 1.0, 0, 1.0),
        (15, 1.0, 15, 0.5),
        (30, 1.0, 30, 0.0),
        (90, 1.0, 90, 0.0),
        (1, 2.0, 0.5, 1 - 0.5 / 30),
    ],
)
def test_cobertura_dias(stock: int, consumo: float, valor: float, score: float) -> None:
    r = evaluar(item(stock=stock, consumo_diario=consumo), REFERENCIA)
    c = razon(r, "cobertura_dias")
    assert c.peso == 0.4
    assert c.valor == valor
    assert c.texto == f"Cobertura de {valor} días"
    assert r.puntaje == round(0.4 * score, 3)
    assert "cobertura_dias" not in r.factores_faltantes


@pytest.mark.parametrize("consumo", [None, 0.0])
def test_cobertura_falta_sin_consumo(consumo: float | None) -> None:
    r = evaluar(item(stock=10, consumo_diario=consumo), REFERENCIA)
    assert "cobertura_dias" in r.factores_faltantes
    assert "consumo_reciente" in r.factores_faltantes


@pytest.mark.parametrize(
    ("stock", "minimo", "valor", "score", "texto"),
    [
        (0, 10, 10, 1.0, "Faltan 10 unidades para el mínimo"),
        (5, 10, 5, 0.5, "Faltan 5 unidades para el mínimo"),
        (10, 10, 0, 0.0, "Stock sobre el mínimo"),
        (20, 10, -10, 0.0, "Stock sobre el mínimo"),
        (-10, 10, 20, 1.0, "Faltan 20 unidades para el mínimo"),
    ],
)
def test_bajo_minimo(
    stock: int, minimo: int, valor: int, score: float, texto: str
) -> None:
    r = evaluar(item(stock=stock, stock_minimo=minimo), REFERENCIA)
    b = razon(r, "bajo_minimo")
    assert (b.peso, b.valor, b.texto) == (0.3, valor, texto)
    assert r.puntaje == round(0.3 * score, 3)


@pytest.mark.parametrize("minimo", [None, 0])
def test_bajo_minimo_falta_sin_minimo(minimo: int | None) -> None:
    r = evaluar(item(stock=5, stock_minimo=minimo), REFERENCIA)
    assert "bajo_minimo" in r.factores_faltantes


@pytest.mark.parametrize(
    ("reciente", "ratio", "score"),
    [(0.0, 0.0, 0.0), (1.0, 1.0, 0.5), (2.0, 2.0, 1.0), (5.0, 5.0, 1.0)],
)
def test_consumo_reciente(reciente: float, ratio: float, score: float) -> None:
    r = evaluar(
        item(stock=None, consumo_diario=1.0, consumo_reciente=reciente), REFERENCIA
    )
    c = razon(r, "consumo_reciente")
    assert (c.peso, c.valor) == (0.15, ratio)
    assert c.texto == (
        f"Consumo de los últimos 30 días {ratio} veces el promedio anual"
    )
    assert r.puntaje == round(0.15 * score, 3)


def test_consumo_reciente_falta_sin_dato() -> None:
    r = evaluar(item(consumo_diario=1.0), REFERENCIA)
    assert "consumo_reciente" in r.factores_faltantes


@pytest.mark.parametrize(
    ("externo", "variacion", "score", "texto"),
    [
        (800.0, -0.2, 0.4, "Precio externo 20% bajo el último pagado"),
        (500.0, -0.5, 1.0, "Precio externo 50% bajo el último pagado"),
        (100.0, -0.9, 1.0, "Precio externo 90% bajo el último pagado"),
        (1000.0, 0.0, 0.0, "Precio externo 0% sobre el último pagado"),
        (1200.0, 0.2, 0.0, "Precio externo 20% sobre el último pagado"),
    ],
)
def test_variacion_precio(
    externo: float, variacion: float, score: float, texto: str
) -> None:
    r = evaluar(
        item(
            ultimo_precio=1000.0,
            precio_externo=externo,
            precio_externo_obtenido_en=REFERENCIA - timedelta(days=1),
        ),
        REFERENCIA,
    )
    v = razon(r, "variacion_precio")
    assert (v.peso, v.valor, v.texto) == (0.15, variacion, texto)
    assert r.puntaje == round(0.15 * score, 3)
    assert "precio_externo_vigente" not in r.factores_faltantes
    assert "ultimo_precio_pagado" not in r.factores_faltantes


def test_variacion_falta_sin_ultimo_precio() -> None:
    r = evaluar(
        item(precio_externo=500.0, precio_externo_obtenido_en=REFERENCIA), REFERENCIA
    )
    assert "ultimo_precio_pagado" in r.factores_faltantes
    assert "precio_externo_vigente" not in r.factores_faltantes
    assert all(x.factor != "variacion_precio" for x in r.razones)


def test_vigencia_de_siete_dias() -> None:
    def con_edad(edad: timedelta) -> Any:
        return evaluar(
            item(
                ultimo_precio=1000.0,
                precio_externo=500.0,
                precio_externo_obtenido_en=REFERENCIA - edad,
            ),
            REFERENCIA,
        )

    vigente = con_edad(timedelta(days=7) - timedelta(seconds=1))
    vencido = con_edad(timedelta(days=7))
    assert "precio_externo_vigente" not in vigente.factores_faltantes
    assert "precio_externo_vigente" in vencido.factores_faltantes
    assert vencido.puntaje == 0


def test_precio_sin_fecha_no_es_vigente() -> None:
    r = evaluar(item(ultimo_precio=1000.0, precio_externo=500.0), REFERENCIA)
    assert "precio_externo_vigente" in r.factores_faltantes


def test_puntaje_suma_ponderada() -> None:
    r = evaluar(
        item(
            stock=0,
            stock_minimo=10,
            consumo_diario=1.0,
            consumo_reciente=2.0,
            ultimo_precio=1000.0,
            precio_externo=500.0,
            precio_externo_obtenido_en=REFERENCIA,
        ),
        REFERENCIA,
    )
    assert r.puntaje == 1.0
    assert r.factores_faltantes == []
    assert [x.factor for x in r.razones] == [
        "cobertura_dias",
        "bajo_minimo",
        "consumo_reciente",
        "variacion_precio",
    ]


@pytest.mark.parametrize(
    ("stock", "minimo", "uso", "esperado"),
    [
        (0, 5, 1.0, 30),
        (10, 50, 1.0, 40),
        (0, 0, 0.11, 4),
        (100, 10, 1.0, 0),
        (2, None, None, 0),
        (2, 5, None, 3),
        (None, 5, 1.0, 30),
    ],
)
def test_cantidad_sugerida_regla_base(
    stock: int | None, minimo: int | None, uso: float | None, esperado: int
) -> None:
    assert cantidad_sugerida(stock, minimo, uso) == esperado


def cuerpo(*items: dict[str, Any]) -> dict[str, Any]:
    return {"referencia": REFERENCIA.isoformat(), "items": list(items)}


def test_endpoint_ordena_por_puntaje_y_desempata_por_orden(client: TestClient) -> None:
    response = client.post(
        URL,
        json=cuerpo(
            {"cod_material": "A", "stock": 50, "stock_minimo": 10},
            {"cod_material": "B", "stock": 0, "stock_minimo": 10},
            {"cod_material": "C", "stock": 100, "stock_minimo": 10},
            {"cod_material": "D", "stock": 5, "stock_minimo": 10},
        ),
    )
    assert response.status_code == 200
    items = response.json()["items"]
    assert [i["cod_material"] for i in items] == ["B", "D", "A", "C"]
    assert items[0]["puntaje"] == 0.3
    assert items[0]["cantidad_sugerida"] == 10
    assert items[0]["razones"][0] == {
        "factor": "bajo_minimo",
        "valor": 10,
        "peso": 0.3,
        "texto": "Faltan 10 unidades para el mínimo",
    }
    assert "cobertura_dias" in items[0]["factores_faltantes"]


@pytest.mark.parametrize(
    "body",
    [
        cuerpo(),
        cuerpo(*({"cod_material": f"M{i}"} for i in range(501))),
        cuerpo({"cod_material": "A"}, {"cod_material": "A"}),
        cuerpo({"cod_material": "A", "consumo_diario": -1}),
        cuerpo({"cod_material": ""}),
        {"referencia": "2026-11-20T12:00:00", "items": [{"cod_material": "A"}]},
    ],
)
def test_endpoint_rechaza_entradas_invalidas(
    client: TestClient, body: dict[str, Any]
) -> None:
    response = client.post(URL, json=body)
    assert response.status_code == 422
    assert response.json() == {"error": "invalid_request"}
