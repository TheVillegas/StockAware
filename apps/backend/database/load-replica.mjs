import { createReadStream } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'init');

if (!process.env.PG_HOST) {
  console.log('PG_HOST is unset; replica load skipped');
  process.exit(0);
}

const client = new pg.Client({
  host: process.env.PG_HOST,
  port: Number(process.env.PG_PORT ?? 5432),
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DATABASE,
  ssl: process.env.PG_SSL === 'require' ? { rejectUnauthorized: false } : undefined,
});

async function sqlFile(name) {
  const full = path.join(root, name);
  if (name.endsWith('.gz')) {
    const chunks = [];
    for await (const chunk of createReadStream(full).pipe(createGunzip())) chunks.push(chunk);
    return Buffer.concat(chunks).toString('utf8');
  }
  return readFile(full, 'utf8');
}

await client.connect();
try {
  const existing = await client.query("SELECT to_regclass('public.data_clientes') AS table_name");
  if (existing.rows[0]?.table_name) {
    console.log('replica already loaded');
  } else {
    for (const name of ['01_schema.sql', '02_datos.sql.gz', '03_vistas.sql', '04_secuencias.sql']) {
      console.log(`loading ${name}`);
      await client.query(await sqlFile(name));
    }
    console.log('replica loaded');
  }
} finally {
  await client.end();
}
