import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const host = process.env.BACKEND_HOST;
if (!host) {
  process.exit(0);
}

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/app/core/auth.service.ts');
// Older Render services may still run this script before `ng build`.
// Match only the fallback; the Angular define still takes precedence.
const fallback = "export const API = typeof __API_URL__ === 'undefined' ? ";
const needle = `${fallback}'http://localhost:3000/api' : __API_URL__;`;
const next = `${fallback}${JSON.stringify(`https://${host}/api`)} : __API_URL__;`;
const source = fs.readFileSync(file, 'utf8');
if (!source.includes(needle) && !source.includes(next)) {
  console.error('API constant not found');
  process.exit(1);
}
if (source.includes(needle)) {
  fs.writeFileSync(file, source.replace(needle, next));
}
console.log(`frontend API set to https://${host}/api`);
