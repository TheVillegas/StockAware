// @ts-nocheck
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const source = readFileSync(join(__dirname, 'balance.page.ts'), 'utf8');

describe('Balance monthly chart layout', () => {
  // The screen-reader labels are absolutely positioned; without a positioned
  // scroller they escape its clipping and widen the whole phone page.
  it('makes the monthly scroller the containing block of its hidden labels', () => {
    expect(source).toMatch(/\.meses-scroll\s*\{[^}]*position:\s*relative/);
    expect(source).toMatch(/\.meses-scroll\s*\{[^}]*overflow-x:\s*auto/);
  });
});
