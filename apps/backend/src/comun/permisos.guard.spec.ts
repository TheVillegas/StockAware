// @ts-nocheck — file is JS-shaped so Jest's default babel-jest can parse it.
const fs = require('fs');
const path = require('path');
const Module = require('module');
const ts = require('typescript');

// Jest 29 default-transforms *.ts with babel-jest, which cannot strip types.
// Load the guard through TypeScript's transpileModule instead.
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

Module._extensions['.ts'] = function (module, filename) {
  module._compile(compileTs(filename), filename);
};

const guardPath = path.join(__dirname, 'permisos.guard.ts');
const loaded = new Module(guardPath);
loaded.filename = guardPath;
loaded.paths = Module._nodeModulePaths(path.dirname(guardPath));
loaded._compile(compileTs(guardPath), guardPath);
const { PermisosGuard } = loaded.exports;

function reflectorCon(glosa) {
  return { getAllAndOverride: () => glosa };
}

function contexto(permisos, params) {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({
        user: { permisos, perfil: 'tester' },
        params: params || {},
      }),
    }),
  };
}

describe('PermisosGuard', () => {
  describe("static @Requiere('EMITE_OC')", () => {
    it('allows when permisos includes EMITE_OC', () => {
      const guard = new PermisosGuard(reflectorCon('EMITE_OC'));
      expect(guard.canActivate(contexto(['EMITE_OC']))).toBe(true);
    });

    it('denies when permisos does not include EMITE_OC', () => {
      const guard = new PermisosGuard(reflectorCon('EMITE_OC'));
      expect(() => guard.canActivate(contexto(['OTRA']))).toThrow(/no tiene la funcion EMITE_OC/);
    });
  });

  describe("@Requiere('@codigo')", () => {
    it('allows ADM_CATEGORIA when permisos includes it', () => {
      const guard = new PermisosGuard(reflectorCon('@codigo'));
      expect(
        guard.canActivate(contexto(['ADM_CATEGORIA'], { codigo: 'ADM_CATEGORIA' })),
      ).toBe(true);
    });

    it('denies ADM_CATEGORIA when permisos does not include it', () => {
      const guard = new PermisosGuard(reflectorCon('@codigo'));
      expect(() =>
        guard.canActivate(contexto(['MOD_CAT'], { codigo: 'ADM_CATEGORIA' })),
      ).toThrow(/no tiene la funcion ADM_CATEGORIA/);
    });
  });

  describe("@Requiere('@escritura')", () => {
    it('allows ADM_CATEGORIA when permisos includes MOD_CAT', () => {
      const guard = new PermisosGuard(reflectorCon('@escritura'));
      expect(
        guard.canActivate(contexto(['MOD_CAT'], { codigo: 'ADM_CATEGORIA' })),
      ).toBe(true);
    });

    it('denies ADM_CATEGORIA when permisos only includes ADM_CATEGORIA', () => {
      const guard = new PermisosGuard(reflectorCon('@escritura'));
      expect(() =>
        guard.canActivate(contexto(['ADM_CATEGORIA'], { codigo: 'ADM_CATEGORIA' })),
      ).toThrow(/no tiene la funcion MOD_CAT/);
    });

    it('allows ADM_COMUNA when permisos only includes ADM_COMUNA', () => {
      const guard = new PermisosGuard(reflectorCon('@escritura'));
      expect(
        guard.canActivate(contexto(['ADM_COMUNA'], { codigo: 'ADM_COMUNA' })),
      ).toBe(true);
    });

    it('denies an unknown codigo', () => {
      const guard = new PermisosGuard(reflectorCon('@escritura'));
      expect(() =>
        guard.canActivate(contexto(['ADM_COMUNA'], { codigo: 'NO_EXISTE' })),
      ).toThrow(/No existe el mantenedor NO_EXISTE/);
    });
  });
});
