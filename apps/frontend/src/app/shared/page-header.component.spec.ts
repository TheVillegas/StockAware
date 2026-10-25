// @ts-nocheck
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

// These source-level checks protect template/style structure; this project has
// no DOM test environment, so they do not claim to verify rendered behavior.
const source = readFileSync(join(__dirname, 'page-header.component.ts'), 'utf8');

describe('PageHeaderComponent structural contracts', () => {
  it('exposes the current page title as a level-one heading', () => {
    expect(source).toMatch(/<h1\b[^>]*class="page-title"[^>]*>\s*\{\{\s*title\(\)\s*\}\}\s*<\/h1>/);
  });

  it('is a phone-only bar with the menu button: hidden from the 768px breakpoint up', () => {
    expect(source).toMatch(/<ion-menu-button[^>]*aria-label="Abrir menú"/);
    expect(source).toMatch(/@media\s*\(min-width:\s*768px\)\s*\{\s*:host\s*\{\s*display:\s*none/);
    expect(source).toMatch(/\.page-title\s*\{[^}]*overflow:\s*hidden[^}]*text-overflow:\s*ellipsis[^}]*white-space:\s*nowrap/s);
  });

  it('keeps logout and page actions out of the bar (sidebar and sa-page-head own them)', () => {
    expect(source).not.toMatch(/Cerrar sesión/);
    expect(source).not.toMatch(/header-actions/);
  });

  it('removes the StockAware brand and the internal ERP function code from the bar', () => {
    expect(source).not.toMatch(/StockAware/);
    expect(source).not.toMatch(/class="codigo"/);
  });

  it('uses only --sa-* values in styles (no literal hex nor font-size px)', () => {
    const styles = source.match(/styles:\s*\[`([\s\S]*?)`\]/)?.[1] ?? '';
    expect(styles.length).toBeGreaterThan(0);
    expect(styles).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
    expect(styles).not.toMatch(/font-size:\s*\d+px/);
  });

  it('removes the Ionic header shadow', () => {
    expect(source).toMatch(/ion-header\s*\{[^}]*box-shadow:\s*none/);
  });
});
