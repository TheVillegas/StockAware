// Ayuda para las pruebas: Jest 29 transforma *.ts con babel-jest, que no quita tipos ni
// decoradores. Transpila con TypeScript cada .ts relativo, con metadata de decoradores.
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const cache = new Map();
function cargaTs(file) {
  if (cache.has(file)) return cache.get(file).exports;
  const salida = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      experimentalDecorators: true,
      emitDecoratorMetadata: true,
      esModuleInterop: true,
      target: ts.ScriptTarget.ES2023,
    },
    fileName: file,
  }).outputText;
  const mod = { exports: {} };
  cache.set(file, mod);
  const dir = path.dirname(file);
  const requiere = (id) => {
    if (!id.startsWith('.')) return require(id);
    const base = path.resolve(dir, id);
    return cargaTs(fs.existsSync(`${base}.ts`) ? `${base}.ts` : path.join(base, 'index.ts'));
  };
  new Function('exports', 'require', 'module', '__filename', '__dirname', salida)(mod.exports, requiere, mod, file, dir);
  return mod.exports;
}

module.exports = { cargaTs };
