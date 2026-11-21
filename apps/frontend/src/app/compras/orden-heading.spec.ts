// @ts-nocheck
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

// The phone top bar shows the brand, so every state needs a content heading.
const template = readFileSync(join(__dirname, 'orden.page.ts'), 'utf8')
  .match(/template:\s*`([\s\S]*?)`/)[1];
const heads = (s) => (s.match(/<sa-page-head\b/g) || []).length;
const loading = template.split('@if (cargando())')[1].split('@else if (esNueva())')[0];
const nueva = template.split('@else if (esNueva())')[1].split('@else if (oc(); as o)')[0];
const detail = template.split('@else if (oc(); as o)')[1].split('@else if (error())')[0];
const failed = template.split('@else if (error())')[1];

describe('Orden page visible title', () => {
  it('renders exactly one phone-visible sa-page-head in every branch', () => {
    for (const branch of [loading, nueva, detail, failed]) {
      expect(heads(branch)).toBe(1);
      expect(branch).not.toMatch(/\[phoneTitle\]="false"/);
    }
  });

  it('uses the nueva back link when the order fails to load', () => {
    const link = (s) => s.match(/<a class="volver"[\s\S]*?<\/a>/)[0];
    expect(link(failed)).toBe(link(nueva));
  });
});
