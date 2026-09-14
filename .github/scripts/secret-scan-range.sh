#!/usr/bin/env bash
set -euo pipefail

feature_range() {
  local integration_base="${1:?integration base is required}"
  local target="${2:?scan target is required}"
  local merge_base commits target_sha

  git rev-parse --verify --quiet "${integration_base}^{commit}" >/dev/null || {
    echo "Unable to resolve protected integration base: $integration_base" >&2
    return 1
  }
  git rev-parse --verify --quiet "${target}^{commit}" >/dev/null || {
    echo "Unable to resolve scan target: $target" >&2
    return 1
  }
  target_sha="$(git rev-parse "${target}^{commit}")"
  merge_base="$(git merge-base "$integration_base" "$target")" || {
    echo "Unable to establish secret-scan merge base" >&2
    return 1
  }
  git merge-base --is-ancestor "$merge_base" "$integration_base" || return 1
  git merge-base --is-ancestor "$merge_base" "$target" || return 1
  commits="$(git rev-list --count "$merge_base..$target")"
  [[ "$commits" -gt 0 ]] || {
    echo "Secret-scan feature range is empty; refusing to scan an indeterminate change" >&2
    return 1
  }
  printf '%s..%s\n' "$merge_base" "$target_sha"
}

case "${1:-}" in
  feature-range) feature_range "$2" "$3" ;;
  *) echo "usage: $0 feature-range INTEGRATION_BASE TARGET" >&2; exit 64 ;;
esac
