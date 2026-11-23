#!/usr/bin/env python3
"""Print the commit currently live on the staging API service (BE-02).

Run before a deploy: that commit is the last healthy one the rollback returns to.
Writes `sha=<commit>` to $GITHUB_OUTPUT (empty when there is no live deploy yet).
Never prints the API key.
"""

import json
import os
import re
import sys
import urllib.error
import urllib.request
from typing import Any, TextIO

SHA = re.compile(r"^[0-9a-f]{40}$")


def sha_en_vivo(deploys: Any) -> str:
    # An error body (object) or unexpected items mean "unknown", never a crash.
    if not isinstance(deploys, list):
        return ""
    for item in deploys:
        deploy = item.get("deploy") if isinstance(item, dict) else None
        if not isinstance(deploy, dict):
            continue
        if deploy.get("status") != "live":
            continue
        sha = str((deploy.get("commit") or {}).get("id", ""))
        return sha if SHA.match(sha) else ""
    return ""


def escribir_salida(sha: str, destino: TextIO) -> None:
    destino.write(f"sha={sha}\n")


def consultar(servicio: str, clave: str) -> Any:
    peticion = urllib.request.Request(
        f"https://api.render.com/v1/services/{servicio}/deploys?limit=20",
        headers={"Authorization": f"Bearer {clave}", "Accept": "application/json"},
    )
    with urllib.request.urlopen(peticion, timeout=30) as respuesta:
        return json.load(respuesta)


def main() -> int:
    clave = os.environ.get("RENDER_API_KEY", "")
    servicio = os.environ.get("RENDER_SERVICE_ID_API", "")
    if not clave or not servicio:
        print("Faltan RENDER_API_KEY o RENDER_SERVICE_ID_API", file=sys.stderr)
        return 1
    try:
        sha = sha_en_vivo(consultar(servicio, clave))
    except (urllib.error.URLError, TimeoutError, ValueError) as error:
        # Without this SHA there is no automatic rollback, but the deploy can go on.
        print(f"No se pudo leer el deploy en vivo ({type(error).__name__})", file=sys.stderr)
        sha = ""
    print(f"SHA en vivo antes del deploy: {sha or 'ninguno'}")
    with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as salida:
        escribir_salida(sha, salida)
    return 0


if __name__ == "__main__":
    sys.exit(main())
