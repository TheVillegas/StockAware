import type { CapacitorConfig } from '@capacitor/cli';

// The Angular application builder writes the browser bundle to dist/browser.
// This is initial config, not an Android package.
const config: CapacitorConfig = {
  appId: 'cl.pucv.stockaware',
  appName: 'StockAware',
  webDir: 'dist/browser',
};

export default config;
