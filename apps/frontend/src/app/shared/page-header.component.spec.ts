// @ts-nocheck
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

// These source-level checks protect template/style structure; this project has
// no DOM test environment, so they do not claim to verify rendered behavior.
const source = readFileSync(join(__dirname, 'page-header.component.ts'), 'utf8');

describe('PageHeaderComponent structural contracts', () => {
  it('leaves the level-one heading to the page content (sa-page-head or the page intro)', () => {
    expect(source).not.toMatch(/<h1\b/);
  });

  it('is a phone-only bar with the menu button: hidden from the 768px breakpoint up', () => {
    expect(source).toMatch(/<ion-menu-button[^>]*aria-label="Abrir menú"/);
    expect(source).toMatch(/@media\s*\(min-width:\s*768px\)\s*\{\s*:host\s*\{\s*display:\s*none/);
  });

  it('offers mobile Volver with Ionic overlay, menu and route fallback handling', () => {
    expect(source).toMatch(/>\s*Volver\s*</);
    expect(source).toMatch(/\(click\)="volver\(\)"/);
    expect(source).toMatch(/getTop\(\)/);
    expect(source).toMatch(/isOpen\(\)/);
    expect(source).toMatch(/canGoBack\(\)/);
    expect(source).toMatch(/navigateRoot\('\/inicio'\)/);
  });

  it('keeps logout and page actions out of the bar (sidebar and sa-page-head own them)', () => {
    expect(source).not.toMatch(/Cerrar sesión/);
    expect(source).not.toMatch(/header-actions/);
  });

  it('shows the artboard brand on every phone page without an internal ERP function code', () => {
    expect(source).not.toMatch(/flujoOperativo/);
    expect(source).toMatch(/class="topbar-mark"[^>]*>\s*<sa-icon name="warehouse"/);
    expect(source).toMatch(/>StockAware</);
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
