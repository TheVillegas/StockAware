import { createReadStream } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const require = createRequire(import.meta.url);
const { from: copyFrom } = require('pg-copy-streams');
const { planDump } = require('./load-replica-plan.js');

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

const truncatePublicTables = `
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> 'replica_carga'
  LOOP
    EXECUTE format('TRUNCATE TABLE public.%I RESTART IDENTITY CASCADE', r.tablename);
  END LOOP;
END $$;
`;

async function sqlFile(name) {
  const full = path.join(root, name);
  if (name.endsWith('.gz')) {
    const chunks = [];
    for await (const chunk of createReadStream(full).pipe(createGunzip())) chunks.push(chunk);
    return Buffer.concat(chunks).toString('utf8');
  }
  return readFile(full, 'utf8');
}

async function runDump(sql) {
  for (const step of planDump(sql)) {
    if (step.kind === 'sql') {
      await client.query(step.text);
      continue;
    }
    await pipeline(Readable.from([step.payload]), client.query(copyFrom(step.command)));
  }
}

async function runFile(name) {
  console.log(`loading ${name}`);
  const sql = await sqlFile(name);
  if (name.endsWith('.gz')) await runDump(sql);
  else await client.query(sql);
  await client.query('SET search_path TO public');
}

await client.connect();
try {
  const marker = await client.query("SELECT to_regclass('public.replica_carga') AS table_name");
  if (marker.rows[0]?.table_name) {
    console.log('replica already loaded');
  } else {
    const existing = await client.query("SELECT to_regclass('public.data_clientes') AS table_name");
    const files = existing.rows[0]?.table_name
      ? ['02_datos.sql.gz', '03_vistas.sql', '04_secuencias.sql']
      : ['01_schema.sql', '02_datos.sql.gz', '03_vistas.sql', '04_secuencias.sql'];
    if (existing.rows[0]?.table_name) {
      console.log('schema exists without data; truncating public tables');
      await client.query(truncatePublicTables);
    }
    for (const name of files) await runFile(name);
    await client.query('CREATE TABLE IF NOT EXISTS public.replica_carga (id int primary key)');
    await client.query('INSERT INTO public.replica_carga (id) VALUES (1) ON CONFLICT DO NOTHING');
    console.log('replica loaded');
  }
} finally {
  await client.end();
}
