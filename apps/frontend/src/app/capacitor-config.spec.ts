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

  it('includes the matching Android runtime', () => {
    const pkg = JSON.parse(read('package.json'));

    expect(pkg.dependencies['@capacitor/android']).toBe('^7.6.9');
  });

  it('builds a staging debug APK without deployment credentials', () => {
    const workflow = read('../../.github/workflows/android-apk.yml');
    expect(workflow).toContain('contents: read');
    expect(workflow).toContain('feat/ef-staging-multiplatform');
    expect(workflow).toContain('https://stockaware-api.onrender.com/api');
    expect(workflow).toContain('npm run build');
    expect(workflow).toContain('npx cap sync android');
    expect(workflow).toContain('./gradlew assembleDebug');
    expect(workflow).toContain('apps/frontend/android/app/build/outputs/apk/debug/app-debug.apk');
    expect(workflow).not.toMatch(/secrets\.|deploy|publish/i);
  });

  it('depends on the Capacitor 7 core package', () => {
    const pkg = JSON.parse(read('package.json'));

    expect(pkg.dependencies['@capacitor/core']).toMatch(/^(?:\^|~)?7(?:\.|$)/);
    expect(pkg.dependencies['@capacitor/cli']).toBeUndefined();
  });
});
