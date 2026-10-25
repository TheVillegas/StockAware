import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const host = process.env.BACKEND_HOST;
if (!host) {
  process.exit(0);
}

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/app/core/auth.service.ts');
const needle = "export const API = 'http://localhost:3000/api';";
const next = `export const API = 'https://${host}/api';`;
const source = fs.readFileSync(file, 'utf8');
if (!source.includes(needle) && !source.includes(next)) {
  console.error('API constant not found');
  process.exit(1);
}
if (source.includes(needle)) {
  fs.writeFileSync(file, source.replace(needle, next));
}
console.log(`frontend API set to https://${host}/api`);
