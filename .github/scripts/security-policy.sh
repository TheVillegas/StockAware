#!/usr/bin/env bash
set -euo pipefail

required_variables=(
  PG_USER PG_DATABASE PG_PORT BACKEND_PORT FRONTEND_PORT CORS_ORIGIN JWT_EXPIRA
  NODE_VERSION PYTHON_VERSION
)

classify() {
  local kind="$1" severity="$2"
  if [[ "$kind" == secret || "$severity" == secret ]]; then
    printf '%s\n' block
  elif [[ "$severity" == HIGH || "$severity" == CRITICAL ]]; then
    printf '%s\n' block
  elif [[ "$severity" == MEDIUM || "$severity" == LOW ]]; then
    printf '%s\n' warn
  else
    printf '%s\n' invalid
    return 1
  fi
}

validate_exceptions() {
  local file="$1"
  python3 - "$file" <<'PY'
import datetime
import sys
import yaml

with open(sys.argv[1], encoding="utf-8") as source:
    document = yaml.safe_load(source) or {}
if set(document) != {"version", "exceptions"} or document["version"] != 1:
    raise SystemExit("security exceptions must contain version: 1 and exceptions")
if not isinstance(document["exceptions"], list):
    raise SystemExit("security exceptions must be a list")
required = {"scanner", "target", "reason", "issue", "reviewed_by", "expires_at"}
for entry in document["exceptions"]:
    if not isinstance(entry, dict) or set(entry) != required:
        raise SystemExit("each security exception must use the reviewed schema")
    if entry["scanner"] not in {"dependency", "image"}:
        raise SystemExit("secret and SAST exceptions are forbidden")
    if not all(isinstance(entry[key], str) and entry[key].strip() for key in required):
        raise SystemExit("security exception fields must be non-empty strings")
    if not (entry["issue"].startswith("#") or "/issues/" in entry["issue"]):
        raise SystemExit("security exception must link an issue")
    expiry = datetime.datetime.fromisoformat(entry["expires_at"].replace("Z", "+00:00"))
    if expiry.tzinfo is None or expiry <= datetime.datetime.now(datetime.timezone.utc):
        raise SystemExit("security exception is expired or lacks an offset")
print(f"security_exceptions={len(document['exceptions'])}")
PY
}

validate_env_schema() {
  local file="$1"
  if [[ ! -f "$file" ]]; then
    printf '%s\n' env_schema=not_applicable
    return
  fi
  local variable
  for variable in "${required_variables[@]}"; do
    grep -Eq "^${variable}=" "$file" || {
      echo "Missing required example variable: $variable" >&2
      return 1
    }
  done
  if grep -Eq '^(PG_PASSWORD|JWT_SECRET)=' "$file"; then
    echo "Managed secrets must not appear in .env.example" >&2
    return 1
  fi
  printf '%s\n' env_schema=validated
}

validate_artifact() {
  local directory="$1"
  local file
  while IFS= read -r -d '' file; do
    case "${file#$directory/}" in
      discovery-summary.env|frontend-summary.env|backend-summary.env|intelligence-summary.env|postgres-summary.env|containers-summary.env|critical-gate-summary.env|security-summary.env) ;;
      *) echo "Unsafe evidence file: ${file#$directory/}" >&2; return 1 ;;
    esac
  done < <(find "$directory" -type f -print0)
  printf '%s\n' artifact=redacted
}

case "${1:-}" in
  classify) classify "$2" "$3" ;;
  validate-exceptions) validate_exceptions "$2" ;;
  validate-env-schema) validate_env_schema "$2" ;;
  validate-artifact) validate_artifact "$2" ;;
  *) echo "usage: $0 {classify KIND SEVERITY|validate-exceptions FILE|validate-env-schema FILE|validate-artifact DIRECTORY}" >&2; exit 64 ;;
esac
