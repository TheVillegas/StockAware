// @ts-nocheck — file is JS-shaped so Jest's default babel-jest can parse it.
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

// Jest 29 default-transforms *.ts with babel-jest, which cannot strip types.
// Load the controller through TypeScript's transpileModule instead of booting Nest or TypeORM.
function compileTs(filename) {
  return ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      experimentalDecorators: true,
      esModuleInterop: true,
      target: ts.ScriptTarget.ES2023,
    },
    fileName: filename,
  }).outputText;
}

const controllerPath = path.join(__dirname, 'salud.controller.ts');
const compiled = compileTs(controllerPath);
const loaded = { exports: {} };
const run = new Function('exports', 'require', 'module', '__filename', '__dirname', compiled);
run(loaded.exports, require, loaded, controllerPath, path.dirname(controllerPath));
const { SaludController } = loaded.exports;

describe('SaludController', () => {
  it('returns erp health without a JWT guard or TypeORM', () => {
    const source = fs.readFileSync(controllerPath, 'utf8');
    expect(source).not.toMatch(/UseGuards|JwtAuthGuard|TypeOrm/);
    expect(new SaludController().salud()).toEqual({
      estado: 'ok',
      servicio: 'erp-backend',
    });
  });
});
