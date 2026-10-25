#!/usr/bin/env bash
# Despliega el SHA actual en los tres servicios de Render y comprueba su salud.
# No imprime la clave ni los identificadores completos.
set -euo pipefail

directorio="$(cd "$(dirname "$0")" && pwd)"
faltan=()
for nombre in RENDER_API_KEY RENDER_SERVICE_ID_API RENDER_SERVICE_ID_INTELLIGENCE RENDER_SERVICE_ID_WEB STAGING_SHA; do
  if [[ -z "${!nombre:-}" ]]; then
    faltan+=("$nombre")
  fi
done
if ((${#faltan[@]} > 0)); then
  echo "Faltan secretos o variables: ${faltan[*]}" >&2
  echo "Agrégalos en GitHub. Este script no imprime sus valores." >&2
  exit 1
fi

API_HEALTH="${STAGING_API_HEALTH:-https://stockaware-api.onrender.com/api/health}"
INTEL_HEALTH="${STAGING_INTELLIGENCE_HEALTH:-https://stockaware-intelligence.onrender.com/health}"
WEB_URL="${STAGING_WEB:-https://stockaware-web.onrender.com/}"

pedir_deploy() {
  local id="$1" cuerpo http
  cuerpo="$(mktemp)"
  http="$(curl -sS -o "$cuerpo" -w '%{http_code}' \
    -X POST "https://api.render.com/v1/services/${id}/deploys" \
    -H "Authorization: Bearer ${RENDER_API_KEY}" \
    -H 'Accept: application/json' \
    -H 'Content-Type: application/json' \
    --data "{\"commitId\":\"${STAGING_SHA}\"}")"
  python3 - "$cuerpo" "$http" <<'PY'
import json, sys
ruta, http = sys.argv[1:]
if http not in ("201", "202"):
    print(f"Render respondió {http} al crear el deploy", file=sys.stderr)
    sys.exit(1)
print(json.load(open(ruta, encoding="utf-8"))["id"])
PY
  rm -f "$cuerpo"
}

esperar() {
  local id="$1" deploy="$2" intento cuerpo http estado
  for intento in $(seq 1 80); do
    cuerpo="$(mktemp)"
    http="$(curl -sS -o "$cuerpo" -w '%{http_code}' \
      -H "Authorization: Bearer ${RENDER_API_KEY}" \
      -H 'Accept: application/json' \
      "https://api.render.com/v1/services/${id}/deploys/${deploy}")"
    estado="$(python3 - "$cuerpo" "$http" <<'PY'
import json, sys
ruta, http = sys.argv[1:]
if http != "200":
    print(f"http_{http}")
else:
    print(json.load(open(ruta, encoding="utf-8")).get("status", ""))
PY
)"
    rm -f "$cuerpo"
    echo "deploy ${deploy} ${estado} (${intento})"
    case "$estado" in
      live) return 0 ;;
      build_failed|update_failed|canceled|pre_deploy_failed|deactivated) return 1 ;;
    esac
    sleep 20
  done
  echo "El deploy ${deploy} no llegó a live" >&2
  return 1
}

consultar() {
  local url="$1" destino intento http
  destino="$(mktemp)"
  for intento in $(seq 1 12); do
    http="$(curl -sS -o "$destino" -w '%{http_code}' --max-time 70 "$url" || true)"
    if [[ "$http" == "200" ]]; then
      echo "$destino"
      return 0
    fi
    echo "salud ${url} respondió ${http} (${intento})" >&2
    sleep 10
  done
  rm -f "$destino"
  return 1
}

echo "Desplegando ${STAGING_SHA}"
# Bash no aborta set -e dentro de una sustitución. El || exit cubre un POST rechazado.
deploy_api="$(pedir_deploy "$RENDER_SERVICE_ID_API")" || exit 1
deploy_intel="$(pedir_deploy "$RENDER_SERVICE_ID_INTELLIGENCE")" || exit 1
deploy_web="$(pedir_deploy "$RENDER_SERVICE_ID_WEB")" || exit 1
if [[ -z "$deploy_api" || -z "$deploy_intel" || -z "$deploy_web" ]]; then
  echo "Render no devolvió el id del deploy" >&2
  exit 1
fi
esperar "$RENDER_SERVICE_ID_API" "$deploy_api"
esperar "$RENDER_SERVICE_ID_INTELLIGENCE" "$deploy_intel"
esperar "$RENDER_SERVICE_ID_WEB" "$deploy_web"

cuerpo_api="$(consultar "$API_HEALTH")"
cuerpo_intel="$(consultar "$INTEL_HEALTH")"
python3 "$directorio/comprobar-salud-staging.py" api "$cuerpo_api" "$STAGING_SHA"
python3 "$directorio/comprobar-salud-staging.py" intelligence "$cuerpo_intel" "$STAGING_SHA"
rm -f "$cuerpo_api" "$cuerpo_intel"

web_http="000"
for _intento in $(seq 1 12); do
  web_http="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 70 "$WEB_URL" || true)"
  if [[ "$web_http" == "200" ]]; then
    break
  fi
  echo "La web respondió ${web_http}" >&2
  sleep 10
done
if [[ "$web_http" != "200" ]]; then
  exit 1
fi
echo "Staging ${STAGING_SHA} en vivo: NestJS, FastAPI, PostgreSQL y la web"
