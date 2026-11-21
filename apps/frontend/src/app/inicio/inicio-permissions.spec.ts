// @ts-nocheck
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { construirNavegacion, pendientesPerfil } = require('../shared/workspace-navigation');

const page = () => readFileSync(join(__dirname, 'inicio.page.ts'), 'utf8');
const menu = [{ codigo: 'COMPRAS', opciones: [{ codigo: 'EMITE_HES', implementada: true }] }];

// Execute the actual projection expression with the real shared navigation helper.
function recibir(permisos) {
  const expression = page().match(/readonly pendienteRecibir = computed\(\(\) => ([\s\S]*?)\);/)[1];
  const project = new Function('pendientesPerfil', `return function () { return ${expression}; }`)(pendientesPerfil);
  return project.call({ navegacion: () => construirNavegacion(menu), auth: { sesion: () => ({ permisos }) } });
}

describe('Pendientes permissions and detail-first', () => {
  it.each([{ permisos: [] }, { permisos: ['EMITE_HES'] }, { permisos: ['CON_DOC_EMI'] }])('hides receiving without both permissions: $permisos', ({ permisos }) => {
    expect(recibir(permisos)).toBeNull();
  });
  it('shows the existing filtered receiving route only with both permissions', () => {
    expect(recibir(['EMITE_HES', 'CON_DOC_EMI'])).toEqual(expect.objectContaining({
      key: 'oc-recibir', ruta: '/f/EMITE_HES', query: { estado: 'EMITIDO' },
    }));
  });
  it('keeps approval in Inicio but requires the detail first in Pendientes', () => {
    expect(page()).toMatch(/@if \(!esPendientes\)\s*\{\s*<ion-button size="small"[\s\S]*?\(click\)="aprobar\(o\)"/);
    expect(page()).toContain("[routerLink]=\"['/oc', o.id]\"");
  });
  it('exposes real-state attention and area filters without a capped stock total', () => {
    expect(page()).toContain('Resumen de atención');
    expect(page()).toContain('aria-label="Filtrar pendientes por área"');
    expect(page()).toContain('stockTope() ? null');
    expect(page()).toContain('areaVisible(');
  });
});
