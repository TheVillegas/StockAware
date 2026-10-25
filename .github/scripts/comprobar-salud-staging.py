#!/usr/bin/env python3
"""Comprueba el JSON de salud de staging. No imprime cuerpos con secretos."""

import json
import sys


def comprobar(tipo: str, cuerpo: dict, sha: str) -> None:
    if tipo == "api":
        esperado = {
            "estado": "ok",
            "servicio": "erp-backend",
            "postgres": "ok",
            "version": sha,
        }
        if {clave: cuerpo.get(clave) for clave in esperado} != esperado:
            raise SystemExit(1)
        return
    if tipo == "intelligence":
        esperado = {"status": "ok", "service": "intelligence-service", "version": sha}
        if {clave: cuerpo.get(clave) for clave in esperado} != esperado:
            raise SystemExit(1)
        return
    raise SystemExit(1)


def main() -> None:
    tipo, ruta, sha = sys.argv[1:]
    with open(ruta, encoding="utf-8") as archivo:
        comprobar(tipo, json.load(archivo), sha)


if __name__ == "__main__":
    main()
