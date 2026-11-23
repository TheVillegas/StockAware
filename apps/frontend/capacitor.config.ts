import type { CapacitorConfig } from '@capacitor/cli';

// The Angular application builder writes the browser bundle to dist/browser.
// Native assets are refreshed from this directory by `cap sync`.
const config: CapacitorConfig = {
  appId: 'cl.pucv.stockaware',
  appName: 'StockAware',
  webDir: 'dist/browser',
};

export default config;
