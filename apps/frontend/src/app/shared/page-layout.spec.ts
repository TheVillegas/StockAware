// @ts-nocheck
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const pageFiles = [
  '../inicio/inicio.page.ts',
  '../compras/ordenes.page.ts',
  '../compras/orden.page.ts',
  '../bodega/stock.page.ts',
  '../bodega/movimientos.page.ts',
  '../bodega/recepcion.page.ts',
  '../bodega/guia.page.ts',
  '../distribucion/distribucion.page.ts',
  '../balance/balance.page.ts',
  '../mantenedor/mantenedor.page.ts',
];

const source = (relativePath) =>
  readFileSync(join(__dirname, relativePath), 'utf8');

describe('authenticated page content layout source contract', () => {
  it.each(pageFiles)('%s applies the shared content class', (pageFile) => {
    const template = source(pageFile).match(/template:\s*`([\s\S]*?)`/)?.[1] ?? '';
    expect(template).toMatch(/class="[^"]*page-content[^"]*"/);
  });

  it('defines responsive shared spacing in the global stylesheet', () => {
    const styles = source('../../styles.css');
    expect(styles).toMatch(/\.page-content\s*\{[^}]*padding/);
    expect(styles).toMatch(/@media\s*\([^)]*max-width/);
    expect(styles).toMatch(/\.page-content[^}]*padding/);
  });
});

// These source-structure checks do not render pages and are not proof of responsive appearance.
