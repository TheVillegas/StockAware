#!/usr/bin/env python3
"""Functional smoke tests after the staging deploy (BE-10).

Logs in with the test user and checks stock, prices, recommendations and that a
route without permission answers 403. Never prints the token, the password or
response bodies. Exit 0 when every step passes, 1 on the first failure.
"""

import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from collections.abc import Callable, Mapping
from typing import Any

REQUERIDAS = (
    "STAGING_SMOKE_USER",
    "STAGING_SMOKE_PASSWORD",
    "STAGING_SMOKE_BODEGA",
    "STAGING_SMOKE_MATERIAL",
    "STAGING_SMOKE_FORBIDDEN_PATH",
)
BASE_POR_DEFECTO = "https://stockaware-api.onrender.com/api"
TIMEOUT_S = 70


class Fallo(Exception):
    pass


def pedir(
    url: str, token: str | None = None, cuerpo: dict[str, Any] | None = None
) -> tuple[int, Any]:
    headers = {"Accept": "application/json"}
    datos = None
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if cuerpo is not None:
        headers["Content-Type"] = "application/json"
        datos = json.dumps(cuerpo).encode()
    peticion = urllib.request.Request(url, data=datos, headers=headers)
    try:
        with urllib.request.urlopen(peticion, timeout=TIMEOUT_S) as respuesta:
            status, crudo = respuesta.status, respuesta.read()
    except urllib.error.HTTPError as error:
        status, crudo = error.code, error.read()
    except (urllib.error.URLError, TimeoutError) as error:
        raise Fallo(f"sin respuesta ({type(error).__name__})") from None
    try:
        return status, json.loads(crudo or b"null")
    except ValueError:
        return status, None


def exigir(condicion: bool, detalle: str) -> None:
    if not condicion:
        raise Fallo(detalle)


def main(env: Mapping[str, str], salida: Callable[[str], None]) -> int:
    faltan = [nombre for nombre in REQUERIDAS if not env.get(nombre)]
    if faltan:
        salida(f"Faltan secretos o variables: {' '.join(faltan)}")
        return 1
    base = env.get("STAGING_API_BASE", BASE_POR_DEFECTO).rstrip("/")
    bodega = urllib.parse.quote(env["STAGING_SMOKE_BODEGA"])
    material = env["STAGING_SMOKE_MATERIAL"]
    prohibida = "/" + env["STAGING_SMOKE_FORBIDDEN_PATH"].lstrip("/")
    paso = "login"
    try:
        status, cuerpo = pedir(
            f"{base}/auth/login",
            cuerpo={
                "user": env["STAGING_SMOKE_USER"],
                "clave": env["STAGING_SMOKE_PASSWORD"],
            },
        )
        # Nest answers POST with 201 by default (auth.controller.ts has no @HttpCode).
        exigir(status in (200, 201), f"HTTP {status}")
        token = cuerpo.get("access_token") if isinstance(cuerpo, dict) else None
        exigir(isinstance(token, str) and bool(token), "sin access_token")
        salida("login: ok")

        paso = "stock"
        status, cuerpo = pedir(f"{base}/bodega/stock?bodega={bodega}", token)
        exigir(status == 200, f"HTTP {status}")
        exigir(isinstance(cuerpo, list), "la respuesta no es una lista")
        salida(f"stock: ok ({len(cuerpo)} materiales)")

        paso = "precios"
        url = f"{base}/precios/{urllib.parse.quote(material, safe='')}"
        status, cuerpo = pedir(url, token)
        exigir(status == 200, f"HTTP {status}")
        exigir(
            isinstance(cuerpo, dict) and cuerpo.get("cod_material") == material,
            "no corresponde al material pedido",
        )
        salida("precios: ok")

        paso = "recomendaciones"
        url = f"{base}/recomendaciones?bodega={bodega}&modo=adaptativo"
        status, cuerpo = pedir(url, token)
        exigir(status == 200, f"HTTP {status}")
        exigir(
            isinstance(cuerpo, dict) and isinstance(cuerpo.get("items"), list),
            "sin items",
        )
        exigir(cuerpo.get("degradado") is False, "el motor respondió degradado")
        salida(f"recomendaciones: ok ({len(cuerpo['items'])} items)")

        paso = "permiso"
        status, _ = pedir(f"{base}{prohibida}", token)
        exigir(status == 403, f"se esperaba 403 y respondió {status}")
        salida("permiso: ok (403)")
    except Fallo as fallo:
        salida(f"Smoke falló en {paso}: {fallo}")
        return 1
    salida("Smoke de staging OK")
    return 0


if __name__ == "__main__":
    sys.exit(main(os.environ, lambda linea: print(linea, flush=True)))
