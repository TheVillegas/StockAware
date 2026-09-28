#!/usr/bin/env bash
set -euo pipefail

: "${PGHOST:?PGHOST is required}"
: "${PGPORT:?PGPORT is required}"
: "${PGUSER:?PGUSER is required}"
: "${PGPASSWORD:?PGPASSWORD is required}"
: "${PGDATABASE:?PGDATABASE is required}"

backend_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

psql --set ON_ERROR_STOP=1 \
  --host "$PGHOST" \
  --port "$PGPORT" \
  --username "$PGUSER" \
  --dbname "$PGDATABASE" \
  --file "$backend_root/database/init/01_schema.sql"

psql --set ON_ERROR_STOP=1 \
  --host "$PGHOST" \
  --port "$PGPORT" \
  --username "$PGUSER" \
  --dbname "$PGDATABASE" <<'SQL'
CREATE TABLE ci_migracion (id int PRIMARY KEY);
INSERT INTO ci_migracion (id) VALUES (1);
SQL
