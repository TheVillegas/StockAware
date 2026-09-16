#!/usr/bin/env bash
set -euo pipefail

node_state() {
  local directory="$1"
  shift
  local package="$directory/package.json"
  local lock="$directory/package-lock.json"
  if [[ ! -e "$package" && ! -e "$lock" ]]; then
    printf '%s\n' not_applicable
    return
  fi
  if [[ ! -f "$package" || ! -f "$lock" ]]; then
    printf '%s\n' invalid_contract
    return
  fi
  local script
  for script in "$@"; do
    if ! grep -Eq "\"$script\"[[:space:]]*:[[:space:]]*\"[^\"]+\"" "$package"; then
      printf '%s\n' invalid_contract
      return
    fi
  done
  printf '%s\n' applicable
}

optional_script_group_state() {
  local directory="$1"
  shift
  local package="$directory/package.json"
  local lock="$directory/package-lock.json"
  if [[ ! -e "$package" && ! -e "$lock" ]]; then
    printf '%s\n' not_applicable
    return
  fi
  if [[ ! -f "$package" || ! -f "$lock" ]]; then
    printf '%s\n' invalid_contract
    return
  fi
  local script found=0 total=0
  for script in "$@"; do
    total=$((total + 1))
    if grep -Eq "\"$script\"[[:space:]]*:[[:space:]]*\"[^\"]+\"" "$package"; then
      found=$((found + 1))
    fi
  done
  if [[ "$found" -eq 0 ]]; then
    printf '%s\n' not_applicable
    return
  fi
  if [[ "$found" -eq "$total" ]]; then
    printf '%s\n' applicable
    return
  fi
  printf '%s\n' invalid_contract
}

discover() {
  local repository="$1"
  local output="$2"
  local frontend backend intelligence compose postgres

  frontend="$(node_state "$repository/apps/frontend" lint typecheck test build)"
  backend="$(node_state "$repository/apps/backend" lint typecheck test build)"
  if [[ ! -e "$repository/apps/intelligence-service/pyproject.toml" && ! -e "$repository/apps/intelligence-service/uv.lock" ]]; then
    intelligence=not_applicable
  elif [[ -f "$repository/apps/intelligence-service/pyproject.toml" && -f "$repository/apps/intelligence-service/uv.lock" ]] && grep -Eq 'ruff|mypy|pytest' "$repository/apps/intelligence-service/pyproject.toml"; then
    intelligence=applicable
  else
    intelligence=invalid_contract
  fi
  if [[ ! -f "$repository/compose.yml" && ! -f "$repository/compose.yaml" && ! -f "$repository/docker-compose.yml" && ! -f "$repository/docker-compose.yaml" ]]; then
    compose=not_applicable
  elif [[ -f "$repository/apps/frontend/Dockerfile" && -f "$repository/apps/backend/Dockerfile" ]]; then
    compose=applicable
  else
    compose=invalid_contract
  fi
  postgres="$(optional_script_group_state "$repository/apps/backend" db:migrate:ci db:seed:ci test:integration:ci)"
  cat > "$output" <<EOF
frontend=$frontend
backend=$backend
intelligence=$intelligence
compose=$compose
postgres=$postgres
EOF
  if grep -qx '.*=invalid_contract' "$output"; then
    echo "CI manifest discovery found an invalid contract; add the required lockfile and scripts." >&2
    return 1
  fi
}

gate() {
  local rows="$1"
  local output="$2"
  local failed=0 row name expectation result
  : > "$output"
  IFS=';' read -r -a row_list <<< "$rows"
  for row in "${row_list[@]}"; do
    IFS=':' read -r name expectation result <<< "$row"
    if [[ -z "${name:-}" || -z "${expectation:-}" || -z "${result:-}" ]]; then
      echo "invalid gate row: $row" >&2
      failed=1
      continue
    fi
    printf '%s=%s/%s\n' "$name" "$expectation" "$result" >> "$output"
    if [[ "$expectation" == applicable && "$result" == success ]]; then
      continue
    fi
    if [[ "$expectation" == not_applicable && "$result" == skipped ]]; then
      continue
    fi
    echo "Unresolved CI control: $name ($expectation/$result)" >&2
    failed=1
  done
  return "$failed"
}

evidence() {
  local control="$1" directory="$2" status="$3"
  case "$control" in
    discovery|frontend|backend|intelligence|postgres|containers|critical-gate) ;;
    *) echo "invalid evidence control: $control" >&2; return 64 ;;
  esac
  mkdir -p "$directory"
  {
    echo "control=$control"
    echo "status=$status"
    echo "commit=${GITHUB_SHA:?GITHUB_SHA is required}"
    echo "run_id=${GITHUB_RUN_ID:?GITHUB_RUN_ID is required}"
    echo "content=redacted_metadata_only"
  } > "$directory/$control-summary.env"
}

case "${1:-}" in
  discover) discover "$2" "$3" ;;
  gate) gate "$2" "$3" ;;
  evidence) evidence "$2" "$3" "$4" ;;
  *) echo "usage: $0 {discover REPOSITORY OUTPUT|gate ROWS OUTPUT|evidence CONTROL DIRECTORY STATUS}" >&2; exit 64 ;;
esac
