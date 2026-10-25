#!/usr/bin/env bash
set -euo pipefail

: "${PGHOST:?PGHOST is required}"
: "${PGPORT:?PGPORT is required}"
: "${PGUSER:?PGUSER is required}"
: "${PGPASSWORD:?PGPASSWORD is required}"
: "${PGDATABASE:?PGDATABASE is required}"

# Marker only. This script must not read database/init/02_datos.sql.gz.
psql --set ON_ERROR_STOP=1 \
  --host "$PGHOST" \
  --port "$PGPORT" \
  --username "$PGUSER" \
  --dbname "$PGDATABASE" <<'SQL'
CREATE TABLE ci_seed_marker (id int PRIMARY KEY);
INSERT INTO ci_seed_marker (id) VALUES (1);
SQL
