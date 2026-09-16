#!/usr/bin/env bash
set -euo pipefail

root="$(git rev-parse --show-toplevel)"
contract="$root/.github/scripts/ci-contract.sh"
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

while IFS='|' read -r case expected_exit rows; do
  [[ "$case" == "case" ]] && continue
  result=0
  bash "$contract" gate "$rows" "$workspace/$case-gate.env" || result=$?
  [[ "$result" == "$expected_exit" ]]
done < "$fixtures/gate-cases.tsv"

echo "CI contract fixtures passed"
