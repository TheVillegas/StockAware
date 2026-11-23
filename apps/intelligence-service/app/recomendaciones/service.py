"""Explainable restock ranking (BE-01).

Each factor yields a score in [0, 1]; the final score is the weighted sum. A factor
without data contributes 0 and is reported as missing instead of being guessed.
"""

import math
from datetime import datetime, timedelta

from app.recomendaciones.models import ItemRanking, ItemRecomendado, Razon

PESO_COBERTURA = 0.4
PESO_MINIMO = 0.3
PESO_CONSUMO = 0.15
PESO_PRECIO = 0.15
DIAS_COBERTURA = 30
DIAS_PEDIDO = 30
VIGENCIA_PRECIO = timedelta(days=7)


def _clamp(valor: float) -> float:
    return max(0.0, min(1.0, valor))


def cantidad_sugerida(
    stock: int | None, minimo: int | None, consumo: float | None
) -> int:
    """Same rule as the frontend suggestedOrderQty (base rule)."""
    actual = stock or 0
    reponer = max(0, minimo - actual) if minimo is not None else 0
    uso = consumo if consumo is not None and consumo > 0 else 0
    return max(0, math.ceil(max(reponer, uso * DIAS_PEDIDO - actual)))


def _dias(cobertura: float) -> float:
    """Same display rule as the frontend coverageDays."""
    if cobertura <= 0:
        return 0
    return round(cobertura, 2) if cobertura < 1 else math.floor(cobertura)


def evaluar(item: ItemRanking, referencia: datetime) -> ItemRecomendado:
    razones: list[Razon] = []
    faltantes: list[str] = []
    total = 0.0
    consumo = item.consumo_diario if item.consumo_diario else None

    if consumo is not None and item.stock is not None:
        cobertura = max(0, item.stock) / consumo
        dias = _dias(cobertura)
        total += PESO_COBERTURA * _clamp(1 - cobertura / DIAS_COBERTURA)
        razones.append(
            Razon(
                factor="cobertura_dias",
                valor=dias,
                peso=PESO_COBERTURA,
                texto=f"Cobertura de {dias} días",
            )
        )
    else:
        faltantes.append("cobertura_dias")

    if item.stock_minimo and item.stock_minimo > 0 and item.stock is not None:
        deficit = item.stock_minimo - item.stock
        total += PESO_MINIMO * _clamp(deficit / item.stock_minimo)
        texto = (
            f"Faltan {deficit} unidades para el mínimo"
            if deficit > 0
            else "Stock sobre el mínimo"
        )
        razones.append(
            Razon(factor="bajo_minimo", valor=deficit, peso=PESO_MINIMO, texto=texto)
        )
    else:
        faltantes.append("bajo_minimo")

    if consumo is not None and item.consumo_reciente is not None:
        ratio = round(item.consumo_reciente / consumo, 2)
        total += PESO_CONSUMO * _clamp(ratio / 2)
        razones.append(
            Razon(
                factor="consumo_reciente",
                valor=ratio,
                peso=PESO_CONSUMO,
                texto=(
                    f"Consumo de los últimos 30 días {ratio} veces el promedio anual"
                ),
            )
        )
    else:
        faltantes.append("consumo_reciente")

    vigente = (
        item.precio_externo is not None
        and item.precio_externo_obtenido_en is not None
        and referencia - item.precio_externo_obtenido_en < VIGENCIA_PRECIO
    )
    if item.ultimo_precio is None:
        faltantes.append("ultimo_precio_pagado")
    if not vigente:
        faltantes.append("precio_externo_vigente")
    if vigente and item.ultimo_precio is not None and item.precio_externo is not None:
        variacion = round(
            (item.precio_externo - item.ultimo_precio) / item.ultimo_precio, 3
        )
        total += PESO_PRECIO * _clamp(-variacion * 2)
        sentido = "bajo" if variacion < 0 else "sobre"
        razones.append(
            Razon(
                factor="variacion_precio",
                valor=variacion,
                peso=PESO_PRECIO,
                texto=(
                    f"Precio externo {round(abs(variacion) * 100)}% {sentido} "
                    "el último pagado"
                ),
            )
        )

    return ItemRecomendado(
        cod_material=item.cod_material,
        puntaje=round(_clamp(total), 3),
        cantidad_sugerida=cantidad_sugerida(
            item.stock, item.stock_minimo, item.consumo_diario
        ),
        razones=razones,
        factores_faltantes=faltantes,
    )


def ranking(items: list[ItemRanking], referencia: datetime) -> list[ItemRecomendado]:
    """Highest score first; sorted() is stable, so ties keep the input order."""
    evaluados = [evaluar(item, referencia) for item in items]
    return sorted(evaluados, key=lambda r: -r.puntaje)
