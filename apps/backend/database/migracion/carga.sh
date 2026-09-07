#!/bin/sh
# Carga los datos anonimizados en PostgreSQL.
#   1. anonimiza.php  -> genera /tmp/datos/*.tsv leyendo MySQL (solo lectura)
#   2. este script    -> crea el esquema y hace COPY de cada tabla
#
# Uso:  ./carga.sh <contenedor_pg> <usuario> <base>
set -e
PG=${1:-stockaware-db}; USR=${2:-stockaware}; BD=${3:-erp_replica}

docker exec "$PG" psql -U "$USR" -d postgres -c "DROP DATABASE IF EXISTS $BD;"
docker exec "$PG" psql -U "$USR" -d postgres -c "CREATE DATABASE $BD;"
docker exec -i "$PG" psql -U "$USR" -d "$BD" -q < ../init/01_schema.sql

docker exec "$PG" sh -c 'for f in /tmp/datos/*.tsv; do
  t=$(basename "$f" .tsv)
  psql -U '"$USR"' -d '"$BD"' -q -c "\copy \"$t\" FROM '"'"'$f'"'"'"
done'
echo "Carga terminada."

# Vistas y sincronizacion de secuencias: van DESPUES de cargar los datos.
docker exec -i "$PG" psql -U "$USR" -d "$BD" -q < ../init/03_vistas.sql
docker exec -i "$PG" psql -U "$USR" -d "$BD" -q < ../init/04_secuencias.sql
echo "Vistas y secuencias listas."

# Regenerar la semilla que usa docker-compose para el arranque automatico:
#   docker exec <contenedor> pg_dump -U <usr> -d <bd> --data-only --disable-triggers \
#     --no-owner --no-privileges | gzip -9 > ../init/02_datos.sql.gz
