#!/bin/sh
set -e
cd /app
/usr/local/bin/node database/load-replica.mjs
exec /usr/local/bin/node dist/main.js
