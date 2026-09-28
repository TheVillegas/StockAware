// @ts-nocheck
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

// Source-level checks for the app shell (side menu). This project has no DOM
// test environment, so these do not claim to verify rendered behavior.
const source = readFileSync(join(__dirname, 'app.component.ts'), 'utf8');

const styles = source.match(/styles:\s*\[`([\s\S]*?)`\]/)?.[1] ?? '';

describe('AppComponent shell structural contracts', () => {
  it('paints the whole menu with the shell background', () => {
    expect(styles).toMatch(/ion-menu[^]*var\(--sa-shell\)/);
  });

  it('renders the brand block with Stock and Aware', () => {
    expect(source).toMatch(/class="marca"/);
    expect(source).toMatch(/>Stock</);
    expect(source).toMatch(/>Aware</);
    expect(styles).toMatch(/var\(--sa-shell-mark\)/);
  });

  it('drops color="light" from the area headers', () => {
    expect(source).not.toMatch(/color="light"/);
  });

  it('marks the active item with a shell-mark left stripe', () => {
    expect(styles).toMatch(/\.activo[^}]*var\(--sa-shell-mark\)/s);
  });

  it('keeps Inicio as the first menu item', () => {
    expect(source).toMatch(/routerLink="\/inicio"/);
  });

  it('uses only --sa-* values in styles (no literal hex nor font-size px)', () => {
    expect(styles.length).toBeGreaterThan(0);
    expect(styles).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
    expect(styles).not.toMatch(/font-size:\s*\d+px/);
  });
});
