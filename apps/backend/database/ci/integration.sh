#!/usr/bin/env bash
set -euo pipefail

: "${PGHOST:?PGHOST is required}"
: "${PGPORT:?PGPORT is required}"
: "${PGUSER:?PGUSER is required}"
: "${PGPASSWORD:?PGPASSWORD is required}"
: "${PGDATABASE:?PGDATABASE is required}"

psql --set ON_ERROR_STOP=1 \
  --host "$PGHOST" \
  --port "$PGPORT" \
  --username "$PGUSER" \
  --dbname "$PGDATABASE" <<'SQL'
DO $$
BEGIN
  IF to_regclass('public.acceso_perfiles') IS NULL THEN
    RAISE EXCEPTION 'acceso_perfiles is missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM ci_migracion WHERE id = 1) THEN
    RAISE EXCEPTION 'ci_migracion does not contain id 1';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM ci_seed_marker WHERE id = 1) THEN
    RAISE EXCEPTION 'ci_seed_marker does not contain id 1';
  END IF;
END
$$;
SQL
