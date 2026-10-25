const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { setTimeout: delay } = require('node:timers/promises');
const { test } = require('node:test');

const root = path.resolve(__dirname, '../..');
const backend = path.join(root, 'apps/backend');
const python = process.env.INTELLIGENCE_PYTHON || path.join(root, 'apps/intelligence-service/.venv/bin/python');
const backendRequire = createRequire(path.join(backend, 'package.json'));
const ts = backendRequire('typescript');
const config = ts.readConfigFile(path.join(backend, 'tsconfig.json'), ts.sys.readFile);
if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
const { options } = ts.convertCompilerOptionsFromJson(config.config.compilerOptions, backend);

// Load the production TypeScript graph without generating dist files or replacing fetch.
require.extensions['.ts'] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: options, fileName: filename });
  module._compile(outputText, filename);
};
backendRequire('reflect-metadata');
const { Body, Controller, HttpCode, Inject, Module, Post } = backendRequire('@nestjs/common');
const { NestFactory } = backendRequire('@nestjs/core');
const { ConfigService } = backendRequire('@nestjs/config');
const { IntelligenceService } = require(path.join(backend, 'src/inteligencia/inteligencia.service.ts'));
const { entrarCorrelacion } = require(path.join(backend, 'src/comun/correlacion.ts'));
const correlation = 'ep2-http-integration';

let child;
let nest;
let output = '';
let cleanupPromise;

async function stopPython() {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, 'exit');
  child.kill('SIGTERM');
  const timer = setTimeout(() => child.kill('SIGKILL'), 3000);
  try { await exited; } finally { clearTimeout(timer); }
}

function cleanup() {
  cleanupPromise ??= Promise.allSettled([nest?.close(), stopPython()]);
  return cleanupPromise;
}
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => { void cleanup().finally(() => process.exit(1)); });
}

async function startPython() {
  // Port 0 lets Uvicorn bind an available loopback port atomically.
  child = spawn(python, ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '0', '--no-access-log'], {
    cwd: path.join(root, 'apps/intelligence-service'),
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let spawnError;
  child.once('error', error => { spawnError = error; });
  for (const stream of [child.stdout, child.stderr]) {
    stream.on('data', chunk => { output = (output + chunk.toString()).slice(-32_768); });
  }
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (spawnError) throw new Error(`Cannot start FastAPI with ${python}: ${spawnError.message}`);
    if (child.exitCode !== null || child.signalCode !== null) throw new Error(`FastAPI exited before readiness:\n${output}`);
    const address = output.match(/Uvicorn running on (http:\/\/127\.0\.0\.1:\d+)/)?.[1];
    if (address) {
      const health = await fetch(`${address}/health`, { signal: AbortSignal.timeout(1000) });
      assert.equal(health.status, 200);
      assert.equal((await health.json()).service, 'intelligence-service');
      return address;
    }
    await delay(50);
  }
  throw new Error(`FastAPI was not ready within 15s. Check INTELLIGENCE_PYTHON and uv sync --frozen.\n${output}`);
}

async function startNest(address) {
  // Test-only controller: real Nest serialization/error mapping and production client,
  // without bootstrapping the ERP database, authentication or external retrieval.
  class ProbeController {
    constructor(service) { this.service = service; }
    preparar(body) { return entrarCorrelacion(correlation, () => this.service.preparar(body.cod_material, body.nombre)); }
    procesar(body) { return entrarCorrelacion(correlation, () => this.service.procesar(body.material, body.fuentes, new Date(body.referencia))); }
    normalizar(body) { return entrarCorrelacion(correlation, () => this.service.normalizar(body.descripcion)); }
  }
  Controller('integration')(ProbeController);
  Inject(IntelligenceService)(ProbeController, undefined, 0);
  for (const route of ['preparar', 'procesar', 'normalizar']) {
    const descriptor = Object.getOwnPropertyDescriptor(ProbeController.prototype, route);
    Post(route)(ProbeController.prototype, route, descriptor);
    HttpCode(200)(ProbeController.prototype, route, descriptor);
    Body()(ProbeController.prototype, route, 0);
  }
  class ProbeModule {}
  Module({
    controllers: [ProbeController],
    providers: [IntelligenceService, { provide: ConfigService, useValue: new ConfigService({ INTELLIGENCE_SERVICE_URL: address }) }],
  })(ProbeModule);
  nest = await NestFactory.create(ProbeModule, { logger: false, abortOnError: false });
  await nest.listen(0, '127.0.0.1');
  return nest.getUrl();
}

test('production Nest client integrates with live FastAPI', { timeout: 45_000 }, async t => {
  try {
    const address = await startNest(await startPython());
    const post = async (route, body) => {
      const response = await fetch(`${address}/integration/${route}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body), signal: AbortSignal.timeout(7000),
      });
      return { status: response.status, body: await response.json() };
    };
    const material = { cod_material: 'HTTP-1', nombre: 'Cable ficticio', termino_busqueda: 'cable ficticio' };
    const product = {
      productId: 'fixture-1', productName: 'Cable ficticio 2m', brand: 'Acme',
      link: 'https://www.dartel.cl/fixture-1/p', categories: ['/Ferreteria/Cables/'],
      items: [{ ean: '7800000000017', sellers: [{ commertialOffer: { ListPrice: 1200, Price: 900, IsAvailable: true } }] }],
    };
    const processBody = {
      material, referencia: '2030-01-15T12:00:00Z',
      fuentes: [{ fuente: 'dartel', tipo: 'json', contenido: [JSON.stringify([product, product, { ...product, productId: 'bad-host', link: 'https://example.invalid/item' }])] }],
    };
    await t.test('prepares a normalized quotable search term', async () => {
      assert.deepEqual(await post('preparar', { cod_material: 'HTTP-1', nombre: 'Cable ficticio talla XL' }), {
        status: 200, body: { termino_busqueda: 'cable ficticio', cotizable: true, motivo: null },
      });
    });
    await t.test('processes, deduplicates and validates source candidates across the HTTP boundary', async () => {
      assert.deepEqual(await post('procesar', processBody), {
        status: 200,
        body: [{ fuente: 'dartel', estado: 'ok', invalidos: 1, candidatos: [{
          id_externo: 'fixture-1', nombre: 'Cable ficticio 2m', marca: 'Acme',
          ean: '7800000000017', categoria_fuente: 'Ferreteria > Cables', precio_normal: 1200,
          precio_oferta: 900, disponible: true, url: product.link, puntaje: 0.8,
        }] }],
      });
    });
    await t.test('keeps invalid source content distinct from a failed HTTP hop', async () => {
      const body = { ...processBody, fuentes: [{ fuente: 'dartel', tipo: 'json', contenido: ['not-json'] }] };
      assert.deepEqual(await post('procesar', body), {
        status: 200, body: [{ fuente: 'dartel', estado: 'invalid_content', candidatos: [], invalidos: 0 }],
      });
    });
    await t.test('maps an internal FastAPI validation failure to 502', async () => {
      assert.deepEqual(await post('preparar', { cod_material: 'HTTP-1', nombre: '' }), {
        status: 502, body: { error: 'intelligence_error' },
      });
    });
    await t.test('preserves the public normalization validation error', async () => {
      assert.deepEqual(await post('normalizar', { descripcion: '' }), {
        status: 422, body: { error: 'invalid_request' },
      });
    });
    await stopPython();
    await t.test('forwards correlation IDs into actual FastAPI request logs', () => {
      const logs = output.split('\n').filter(line => line.startsWith('{')).map(line => JSON.parse(line));
      for (const route of ['preparar', 'procesar']) {
        assert.ok(logs.some(log => log.path === `/v1/precios/${route}` && log.status === 200 && log.correlation_id === correlation));
      }
    });
    await t.test('maps a stopped upstream to 502 without inventing results', async () => {
      assert.deepEqual(await post('preparar', { cod_material: 'HTTP-1', nombre: 'Cable' }), {
        status: 502, body: { error: 'intelligence_unreachable' },
      });
    });
  } finally {
    await cleanup();
  }
});
