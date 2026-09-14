#!/usr/bin/env bash
set -euo pipefail

root="$(git rev-parse --show-toplevel)"
contract="$root/.github/scripts/ci-contract.sh"
security_policy="$root/.github/scripts/security-policy.sh"
fixtures="$root/tests/ci/fixtures"
workspace="$(mktemp -d)"
trap 'rm -rf "$workspace"' EXIT

while IFS='|' read -r case frontend expected; do
  [[ "$case" == "case" ]] && continue
  fixture="$workspace/$case"
  mkdir -p "$fixture/apps/frontend"
  if [[ "$frontend" != "none" ]]; then
    printf '%s\n' '{"scripts":{"lint":"true","typecheck":"true","test":"true","build":"true"}}' > "$fixture/apps/frontend/package.json"
  fi
  if [[ "$frontend" == "complete" ]]; then
    : > "$fixture/apps/frontend/package-lock.json"
  fi
  result=0
  bash "$contract" discover "$fixture" "$fixture/discovery.env" || result=$?
  if [[ "$expected" == "invalid_contract" ]]; then
    [[ "$result" == 1 ]]
  else
    [[ "$result" == 0 ]]
  fi
  grep -qx "frontend=$expected" "$fixture/discovery.env"
done < "$fixtures/manifest-cases.tsv"

activated="$workspace/activated"
mkdir -p "$activated/apps"/{frontend,backend,intelligence-service}
printf '%s\n' '{"scripts":{"lint":"true","typecheck":"true","test":"true","build":"true"}}' > "$activated/apps/frontend/package.json"
printf '%s\n' '{"scripts":{"lint":"true","typecheck":"true","test":"true","build":"true","db:migrate:ci":"true","db:seed:ci":"true","test:integration:ci":"true"}}' > "$activated/apps/backend/package.json"
: > "$activated/apps/frontend/package-lock.json"
: > "$activated/apps/backend/package-lock.json"
printf '%s\n' '[project]' 'dependencies = ["ruff", "mypy", "pytest"]' > "$activated/apps/intelligence-service/pyproject.toml"
: > "$activated/apps/intelligence-service/uv.lock"
printf '%s\n' 'services: {}' > "$activated/docker-compose.yml"
: > "$activated/apps/frontend/Dockerfile"
: > "$activated/apps/backend/Dockerfile"
bash "$contract" discover "$activated" "$activated/discovery.env"
for contract_state in frontend backend intelligence compose postgres; do
  grep -qx "$contract_state=applicable" "$activated/discovery.env"
done
sed -i 's/"db:seed:ci":"true",//' "$activated/apps/backend/package.json"
if bash "$contract" discover "$activated" "$activated/discovery.env"; then exit 1; fi
grep -qx 'postgres=invalid_contract' "$activated/discovery.env"
sed -i 's/"db:migrate:ci":"true",/"db:migrate:ci":"true","db:seed:ci":"true",/' "$activated/apps/backend/package.json"
rm "$activated/apps/frontend/Dockerfile"
if bash "$contract" discover "$activated" "$activated/discovery.env"; then exit 1; fi
grep -qx 'compose=invalid_contract' "$activated/discovery.env"

while IFS='|' read -r case expected_exit rows; do
  [[ "$case" == "case" ]] && continue
  result=0
  bash "$contract" gate "$rows" "$workspace/$case-gate.env" || result=$?
  [[ "$result" == "$expected_exit" ]]
done < "$fixtures/gate-cases.tsv"

[[ "$(bash "$security_policy" classify dependency HIGH)" == block ]]
[[ "$(bash "$security_policy" classify dependency CRITICAL)" == block ]]
[[ "$(bash "$security_policy" classify dependency MEDIUM)" == warn ]]
[[ "$(bash "$security_policy" classify dependency LOW)" == warn ]]
[[ "$(bash "$security_policy" classify secret LOW)" == block ]]

cat > "$workspace/exceptions.yml" <<'EOF'
version: 1
exceptions: []
EOF
bash "$security_policy" validate-exceptions "$workspace/exceptions.yml" | grep -qx 'security_exceptions=0'
cat > "$workspace/exceptions.yml" <<'EOF'
version: 1
exceptions:
  - scanner: dependency
    target: pkg:npm/example@1.0.0
    reason: accepted until upstream patch
    issue: '#15'
    reviewed_by: maintainer
    expires_at: '2099-01-01T00:00:00Z'
EOF
bash "$security_policy" validate-exceptions "$workspace/exceptions.yml" | grep -qx 'security_exceptions=1'
sed -i 's/scanner: dependency/scanner: secret/' "$workspace/exceptions.yml"
if bash "$security_policy" validate-exceptions "$workspace/exceptions.yml"; then exit 1; fi
sed -i 's/scanner: secret/scanner: dependency/; s/2099-01-01/2000-01-01/' "$workspace/exceptions.yml"
if bash "$security_policy" validate-exceptions "$workspace/exceptions.yml"; then exit 1; fi

cat > "$workspace/.env.example" <<'EOF'
PG_USER=ci
PG_DATABASE=ci
PG_PORT=5432
BACKEND_PORT=3000
FRONTEND_PORT=4200
CORS_ORIGIN=http://localhost
JWT_EXPIRA=1h
NODE_VERSION=22
PYTHON_VERSION=3.13
EOF
bash "$security_policy" validate-env-schema "$workspace/.env.example" | grep -qx 'env_schema=validated'
printf 'PG_PASSWORD=not-allowed\n' >> "$workspace/.env.example"
if bash "$security_policy" validate-env-schema "$workspace/.env.example"; then exit 1; fi

mkdir -p "$workspace/evidence"
printf 'run_id=1\n' > "$workspace/evidence/security-summary.env"
bash "$security_policy" validate-artifact "$workspace/evidence" | grep -qx 'artifact=redacted'
printf 'unsafe\n' > "$workspace/evidence/.env"
if bash "$security_policy" validate-artifact "$workspace/evidence"; then exit 1; fi

workflow="$root/.github/workflows/repository-checks.yml"
grep -q '^  ci-security:' "$workflow"
grep -q '^  ci-codeql:' "$workflow"
grep -q '^  ci-frontend-quality:' "$workflow"
grep -q '^  ci-backend-quality:' "$workflow"
grep -q '^  ci-intelligence-quality:' "$workflow"
grep -q '^  ci-postgres-integration:' "$workflow"
grep -q '^  ci-containers:' "$workflow"
grep -q 'uv sync --frozen' "$workflow"
grep -q 'docker compose config' "$workflow"
grep -q 'test:integration:ci' "$workflow"
grep -q 'security:applicable:${{ needs.ci-security.result }}' "$workflow"
grep -q 'codeql:${{' "$workflow"

echo "CI contract fixtures passed"
