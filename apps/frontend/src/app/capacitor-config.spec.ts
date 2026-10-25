// @ts-nocheck
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const frontendRoot = join(__dirname, '../..');

const read = (relativePath) => readFileSync(join(frontendRoot, relativePath), 'utf8');

describe('initial Capacitor configuration', () => {
  it('declares the StockAware app id and Angular browser webDir', () => {
    const config = read('capacitor.config.ts');

    expect(config).toContain("appId: 'cl.pucv.stockaware'");
    expect(config).toContain("webDir: 'dist/browser'");
  });

  it('depends on the Capacitor 7 core package', () => {
    const pkg = JSON.parse(read('package.json'));

    expect(pkg.dependencies['@capacitor/core']).toMatch(/^(?:\^|~)?7(?:\.|$)/);
    expect(pkg.dependencies['@capacitor/cli']).toBeUndefined();
  });
});
