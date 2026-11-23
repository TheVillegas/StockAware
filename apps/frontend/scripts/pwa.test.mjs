import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('production PWA only caches the static application shell', () => {
  assert.match(read('Dockerfile'), /^COPY angular\.json tsconfig\.json ngsw-config\.json \.\/\s*$/m);
  const config = JSON.parse(read('ngsw-config.json'));
  assert.equal(config.index, '/index.html');
  assert.deepEqual(config.dataGroups ?? [], []);
  assert.deepEqual(config.assetGroups.map(({ resources }) => resources.files), [
    ['/favicon.ico', '/index.html', '/manifest.webmanifest', '/*.css', '/*.js'],
    ['/assets/**', '/*.(woff|woff2|ttf)'],
  ]);
  assert.ok(config.assetGroups.every(({ resources }) => !resources.urls));
  assert.ok(config.navigationUrls.includes('!/api'));
  assert.ok(config.navigationUrls.includes('!/api/**'));
  const angular = JSON.parse(read('angular.json'));
  assert.equal(angular.projects.frontend.architect.build.configurations.production.serviceWorker, 'ngsw-config.json');
  assert.equal(angular.projects.frontend.architect.build.configurations.development.serviceWorker, undefined);
});

test('installable metadata includes sized local icons', () => {
  const manifest = JSON.parse(read('src/manifest.webmanifest'));
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.display, 'standalone');
  for (const size of ['192x192', '512x512']) {
    const icon = manifest.icons.find((item) => item.sizes === size && item.type === 'image/svg+xml');
    assert.ok(icon);
    const svg = read(`src/${icon.src.replace(/^\//, '')}`);
    const dimension = size.split('x')[0];
    assert.match(svg, new RegExp(`width="${dimension}" height="${dimension}"`));
  }
});

test('connectivity reports browser changes and removes its listeners', () => {
  const listeners = new Map();
  let cleanup;
  const navigator = { onLine: true };
  const window = {
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: (name, fn) => { if (listeners.get(name) === fn) listeners.delete(name); },
  };
  const signal = (initial) => {
    let value = initial;
    const current = () => value;
    current.set = (next) => { value = next; };
    return current;
  };
  const exports = {};
  const code = ts.transpileModule(read('src/app/core/connectivity.service.ts'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, experimentalDecorators: true },
  }).outputText;
  runInNewContext(code, { exports, navigator, window, require: () => ({
    Injectable: () => (target) => target, signal, inject: () => ({ onDestroy: (fn) => { cleanup = fn; } }),
  }) });
  const service = new exports.ConnectivityService();
  assert.equal(service.online(), true);
  navigator.onLine = false;
  listeners.get('offline')();
  assert.equal(service.online(), false);
  navigator.onLine = true;
  listeners.get('online')();
  assert.equal(service.online(), true);
  cleanup();
  assert.equal(listeners.size, 0);
});

test('offline shell and update registration are guarded', () => {
  const main = read('src/main.ts');
  const app = read('src/app/app.component.ts');
  assert.match(main, /!isDevMode\(\)\s*&&\s*!Capacitor\.isNativePlatform\(\)/);
  assert.match(app, /@if \(!connectivity\.online\(\)\)/);
  assert.match(app, /Sin conexión/);
  assert.match(app, /VERSION_READY/);
  assert.match(app, /location\.reload\(\)/);
});
