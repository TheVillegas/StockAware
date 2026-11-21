// @ts-nocheck
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

// The phone top bar shows the brand, so every state needs a content heading.
const template = readFileSync(join(__dirname, 'orden.page.ts'), 'utf8')
  .match(/template:\s*`([\s\S]*?)`/)[1];

describe('Orden page visible title', () => {
  it('keeps a content heading while the order is loading', () => {
    const loading = template.split('@if (cargando())')[1].split('@else if (esNueva())')[0];
    expect(loading).toMatch(/<sa-page-head\b|<h1\b/);
  });

  it('keeps a content heading when the order fails to load', () => {
    const failed = template.split('@else if (error())')[1];
    expect(failed).toMatch(/<sa-page-head\b|<h1\b/);
  });
});
