// @ts-nocheck
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

// The phone top bar no longer carries the page title: each page keeps one in content.
function templateOf(rel) {
  return readFileSync(join(__dirname, rel), 'utf8').match(/template:\s*`([\s\S]*?)`/)[1];
}

describe('Pages with app-page-header keep a visible content heading', () => {
  const unconditional = [
    '../bodega/guia.page.ts', '../bodega/recepcion.page.ts', '../bodega/movimientos.page.ts',
    '../mantenedor/mantenedor.page.ts', '../distribucion/distribucion.page.ts',
    '../balance/balance.page.ts', '../configuracion/configuracion.page.ts', '../compras/ordenes.page.ts',
  ];

  it('places sa-page-head before any state @if', () => {
    for (const rel of unconditional) {
      const content = templateOf(rel).split('<ion-content>')[1];
      const headAt = content.search(/<sa-page-head\b/);
      const ifAt = content.search(/@if\b/);
      expect({ rel, headFound: headAt >= 0 }).toEqual({ rel, headFound: true });
      if (ifAt >= 0) expect({ rel, headBeforeIf: headAt < ifAt }).toEqual({ rel, headBeforeIf: true });
    }
  });

  it('keeps a phone h1 on Stock while the duplicate page head is opted out', () => {
    const src = readFileSync(join(__dirname, '../bodega/stock.page.ts'), 'utf8');
    expect(src).toMatch(/<div class="stock-intro">[\s\S]*<h1>Stock por bodega<\/h1>/);
    expect(src).toMatch(/@media \(max-width: 767\.98px\)[\s\S]*\.stock-intro \{ display: grid/);
    expect(src).toMatch(/<sa-page-head title="Stock"[^>]*\[phoneTitle\]="false"/);
  });

  it('gives Inicio and Pendientes a heading on phones', () => {
    const src = readFileSync(join(__dirname, '../inicio/inicio.page.ts'), 'utf8');
    const after = src.split('@if (!esPendientes)')[1];
    const mobile = after.split('@else')[0];
    const pendientes = after.slice(after.indexOf('@else'));
    expect(mobile).toMatch(/<h1\b/);
    expect(pendientes).toMatch(/<header class="pendientes-head">[\s\S]*<h1\b/);
    expect(src).toMatch(/@media \(max-width: 767\.98px\)[\s\S]*\.movil-inicio \{ display: grid/);
  });
});
