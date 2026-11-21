import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, chmodSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const source = join(root, 'src/app/core/auth.service.ts');

test('build configures public endpoints without rewriting source', () => {
  const dir = mkdtempSync(join(tmpdir(), 'frontend-build-test-'));
  try {
    const ng = join(dir, 'ng');
    writeFileSync(ng, '#!/usr/bin/env node\nconsole.log(JSON.stringify(process.argv.slice(2)))\n');
    chmodSync(ng, 0o755);
    const before = readFileSync(source, 'utf8');
    const run = (variables, args = []) => spawnSync(process.execPath, ['scripts/build.mjs', ...args], {
      cwd: root, encoding: 'utf8', env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, API_URL: '', BACKEND_HOST: '', ...variables },
    });
    const cases = [
      [{}, ['build']],
      [{ BACKEND_HOST: 'api.example.com' }, ['build', '--define', '__API_URL__="https://api.example.com/api"']],
      [{ API_URL: 'https://api.example.com/api', BACKEND_HOST: 'old.example.com' }, ['build', '--define', '__API_URL__="https://api.example.com/api"']],
    ];
    for (const [env, expected] of cases) {
      const result = run(env);
      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(JSON.parse(result.stdout), expected);
      assert.equal(result.stderr, '');
      assert.equal(readFileSync(source, 'utf8'), before);
    }
    const normalized = run({ API_URL: 'https://api.example.com/api/' });
    assert.equal(normalized.status, 0);
    assert.deepEqual(JSON.parse(normalized.stdout), ['build', '--define', '__API_URL__="https://api.example.com/api"']);
    const forwarded = run({}, ['--configuration=development']);
    assert.equal(forwarded.status, 0);
    assert.deepEqual(JSON.parse(forwarded.stdout), ['build', '--configuration=development']);
    for (const env of [
      { API_URL: 'http://api.example.com/api' },
      { API_URL: '/api' },
      { API_URL: 'https:example.com/api' },
      { API_URL: 'https://localhost/api' },
      { API_URL: 'https://localhost./api' },
      { API_URL: 'https://api.localhost./api' },
      { BACKEND_HOST: 'api.localhost.' },
      { API_URL: 'https:////api.example.com/api' },
      { API_URL: 'https://api.\texample.com/api' },
      { API_URL: 'https://127.0.0.1/api' },
      { API_URL: 'https://user:pass@api.example.com/api' },
      { API_URL: 'https://api.example.com/api?token=secret' },
      { API_URL: 'https://api.example.com/api#fragment' },
      { BACKEND_HOST: 'api.example.com/path' },
      { BACKEND_HOST: 'user@api.example.com' },
    ]) {
      const result = run(env);
      assert.equal(result.status, 1);
      assert.equal(result.stdout, '');
      assert.equal(result.stderr, 'Invalid public API configuration\n');
      assert.equal(readFileSync(source, 'utf8'), before);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('deployment build contracts route configuration through the wrapper', () => {
  const dockerfile = readFileSync(join(root, 'Dockerfile'), 'utf8');
  const compose = readFileSync(join(root, '../../docker-compose.yml'), 'utf8');
  const render = readFileSync(join(root, '../../render.yaml'), 'utf8');
  assert.match(dockerfile, /COPY scripts \.\/scripts\nARG API_URL=""\nRUN npm run build/);
  assert.match(compose, /frontend:\n    build:\n      context: \.\/apps\/frontend\n      args:\n        API_URL: \$\{API_URL:-\}/);
  assert.match(render, /buildCommand: cd apps\/frontend && npm ci && npm run build/);
  assert.match(render, /key: BACKEND_HOST[\s\S]*?envVarKey: RENDER_EXTERNAL_HOSTNAME/);
});
