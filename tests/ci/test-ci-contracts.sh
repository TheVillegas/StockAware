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
rm "$workspace/evidence/.env"
for control in discovery frontend backend intelligence postgres containers critical-gate; do
  GITHUB_SHA=abc GITHUB_RUN_ID=123 bash "$contract" evidence "$control" "$workspace/evidence" success
  grep -qx "control=$control" "$workspace/evidence/$control-summary.env"
  grep -qx 'commit=abc' "$workspace/evidence/$control-summary.env"
  grep -qx 'run_id=123' "$workspace/evidence/$control-summary.env"
done
bash "$security_policy" validate-artifact "$workspace/evidence" | grep -qx 'artifact=redacted'
printf 'dump\n' > "$workspace/evidence/database.dump"
if bash "$security_policy" validate-artifact "$workspace/evidence"; then exit 1; fi
rm "$workspace/evidence/database.dump"
for excluded in .env scanner-report.json image.tar node_modules/package.json; do
  mkdir -p "$(dirname "$workspace/evidence/$excluded")"
  : > "$workspace/evidence/$excluded"
  if bash "$security_policy" validate-artifact "$workspace/evidence"; then exit 1; fi
  rm "$workspace/evidence/$excluded"
done

workflow="$root/.github/workflows/repository-checks.yml"
full_history_workflow="$root/.github/workflows/full-history-secret-audit.yml"
secret_range="$root/.github/scripts/secret-scan-range.sh"
range_repo="$workspace/range-repo"
mkdir -p "$range_repo"
git -C "$range_repo" init -q
git -C "$range_repo" config user.email ci@example.invalid
git -C "$range_repo" config user.name ci
printf 'base\n' > "$range_repo/file"
git -C "$range_repo" add file && git -C "$range_repo" commit -qm base
base="$(git -C "$range_repo" rev-parse HEAD)"
printf 'change\n' >> "$range_repo/file"
git -C "$range_repo" commit -am change -q
target="$(git -C "$range_repo" rev-parse HEAD)"
pr_range="$(cd "$range_repo" && bash "$secret_range" feature-range "$base" "$target")"
manual_range="$(cd "$range_repo" && bash "$secret_range" feature-range "$base" "$target")"
[[ "$pr_range" == "$manual_range" && "$pr_range" == "$base..$target" ]]
if (cd "$range_repo" && bash "$secret_range" feature-range missing "$target"); then exit 1; fi
if (cd "$range_repo" && bash "$secret_range" feature-range "$target" "$target"); then exit 1; fi

grep -q '^  ci-security:' "$workflow"
grep -q '^  ci-codeql:' "$workflow"
grep -q '^  ci-frontend-quality:' "$workflow"
grep -q '^  ci-backend-quality:' "$workflow"
grep -q '^  ci-intelligence-quality:' "$workflow"
grep -q '^  ci-postgres-integration:' "$workflow"
grep -q '^  ci-containers:' "$workflow"
grep -q 'uv sync --frozen' "$workflow"
grep -q 'npm audit --audit-level=high' "$workflow"
grep -q 'scan-ref: apps/intelligence-service' "$workflow"
for evidence in discovery frontend backend intelligence postgres containers critical-gate; do
  grep -q "evidence $evidence" "$workflow"
  grep -q "ci-evidence-\${{ github.sha }}-\${{ github.run_id }}-$evidence" "$workflow"
done
[[ "$(grep -c 'retention-days: 30' "$workflow")" -ge 8 ]]
grep -q 'docker compose config' "$workflow"
grep -q 'test:integration:ci' "$workflow"
grep -q 'security:applicable:${{ needs.ci-security.result }}' "$workflow"
grep -q 'codeql:${{' "$workflow"
grep -q "feature-range \"origin/\$INTEGRATION_BASE_REF\" \"\$GITHUB_SHA\"" "$workflow"
grep -q 'EVENT_BEFORE: ${{ github.event.before }}' "$workflow"
grep -q 'feature-range "$EVENT_BEFORE" "$GITHUB_SHA"' "$workflow"
grep -q '/tmp/gitleaks git --redact --no-banner --log-opts="$range" .' "$workflow"
grep -q '/tmp/gitleaks dir --redact --no-banner .' "$workflow"
grep -q '^  full-history-secret-audit:' "$full_history_workflow"
grep -q 'gitleaks/gitleaks-action@e0c47f4f8be36e29cdc102c57e68cb5cbf0e8d1e # v3.0.0' "$full_history_workflow"
if grep -Eqi 'baseline-path|gitleaks-ignore|gitleaks:allow|allowlist' "$workflow" "$full_history_workflow" "$secret_range"; then exit 1; fi

echo "CI contract fixtures passed"
