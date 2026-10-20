// @ts-nocheck
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

// Source-level checks for the app shell (side menu). This project has no DOM
// test environment, so these do not claim to verify rendered behavior.
const source = readFileSync(join(__dirname, 'app.component.ts'), 'utf8');

const styles = source.match(/styles:\s*\[`([\s\S]*?)`\]/)?.[1] ?? '';

describe('AppComponent shell structural contracts', () => {
  it('paints the whole menu with the shell background', () => {
    expect(styles).toMatch(/ion-menu[^}]*var\(--sa-shell\)/);
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

  it('marks the active item with the shell-mark color, without a side stripe', () => {
    expect(styles).toMatch(/\.activo[^}]*var\(--sa-shell-mark\)/s);
    expect(styles).not.toMatch(/border-inline-start:\s*3px/);
  });

  it('keeps Inicio as the first menu item', () => {
    expect(source).toMatch(/routerLink="\/inicio"/);
  });

  it('uses only --sa-* values in styles (no literal hex nor font-size px)', () => {
    expect(styles.length).toBeGreaterThan(0);
    expect(styles).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
    expect(styles).not.toMatch(/font-size:\s*\d+px/);
  });

  it('paints the menu with the shell color instead of the page background', () => {
    expect(source).toMatch(/ion-menu\s*\{[^}]*--ion-background-color:\s*var\(--sa-shell\)/);
  });

  it('renders purpose entries from the navigation model, without accordions or greyed options', () => {
    expect(source).toMatch(/construirNavegacion\(this\.auth\.menu\(\)\)/);
    expect(source).toMatch(/@for \(e of seccion\.entradas/);
    expect(source).toMatch(/\[routerLink\]="e\.ruta"/);
    expect(source).toMatch(/<sa-icon slot="start" \[name\]="iconoEntrada\(e\.key\)"/);
    expect(source).toMatch(/<sa-icon slot="start" name="home"/);
    expect(source).not.toMatch(/ion-accordion/);
    expect(source).not.toMatch(/pendiente/);
  });

  it('offers a Crear menu built from the profile permissions', () => {
    expect(source).toMatch(/accionesCrear\(this\.auth\.menu\(\)\)/);
    expect(source).toMatch(/<details class="crear"/);
    expect(source).toMatch(/aria-label="Cerrar sesión"/);
  });

  it('marks the active entry for every code it groups and announces it', () => {
    expect(source).toMatch(/entradaActiva\(this\.navegacion\(\), this\.url\(\)\)/);
    expect(source).toMatch(/\[attr\.aria-current\]/);
  });
});
