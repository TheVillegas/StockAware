// @ts-nocheck
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const pageFiles = [
  'stock.page.ts',
  'movimientos.page.ts',
  'recepcion.page.ts',
  'guia.page.ts',
];

const source = (fileName) =>
  readFileSync(join(__dirname, fileName), 'utf8');

const VOSEO_TOKENS = [
  'elegí', 'buscá', 'ingresá', 'tocá', 'podés', 'tenés',
  'revisá', 'confirmá', 'seleccioná', 'registrá', 'indicá', 'agregá', 'usá'
];

describe('Bodega pages UI system migration', () => {
  describe.each(pageFiles)('%s', (pageFile) => {
    let template = '';
    let styles = '';

    beforeAll(() => {
      const content = source(pageFile);
      template = content.match(/template:\s*`([\s\S]*?)`/)?.[1] ?? '';
      styles = content.match(/styles:\s*\[`([\s\S]*?)`\]/)?.[1] ?? '';
    });

    it('uses sa-table-wrap and sa-table when it has a table', () => {
      if (template.includes('<table')) {
        expect(template).toMatch(/class="[^"]*sa-table-wrap[^"]*"/);
        expect(template).toMatch(/class="[^"]*sa-table[^"]*"/);
      }
    });

    it('does not define local .tabla, .aviso, .vacio, or .pastilla rules', () => {
      expect(styles).not.toMatch(/\.tabla\s*\{/);
      expect(styles).not.toMatch(/\.aviso\s*\{/);
      expect(styles).not.toMatch(/\.vacio\s*\{/);
      expect(styles).not.toMatch(/\.pastilla\s*\{/);
    });

    it('does not use literal hex colors', () => {
      expect(styles).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
    });

    it('does not use literal px font-size', () => {
      expect(styles).not.toMatch(/font-size:\s*\d+px/);
    });

    it('renders stacked inputs and selects with the outline fill (spec 3.2)', () => {
      const stacked = template.match(/<ion-(?:input|select)\b[^>]*labelPlacement="stacked"[^>]*>/g) ?? [];
      stacked.forEach((tag) => expect(tag).toMatch(/fill="outline"/));
    });

    it('does not cancel the .page-content padding', () => {
      expect(styles).not.toMatch(/\.cuerpo\s*\{[^}]*padding:\s*0\s*;/);
    });

    it('does not contain voseo tokens', () => {
      const lowerTemplate = template.toLowerCase();
      VOSEO_TOKENS.forEach((token) => {
        expect(lowerTemplate).not.toContain(token.toLowerCase());
      });
    });
  });

  it('stock.page contains stock state pills SIN STOCK, BAJO MÍNIMO, OK', () => {
    const template = source('stock.page.ts').match(/template:\s*`([\s\S]*?)`/)?.[1] ?? '';
    expect(template).toMatch(/SIN STOCK/);
    expect(template).toMatch(/BAJO MÍNIMO/);
    expect(template).toMatch(/\bOK\b/);
  });

  it('stock.page list loading uses ion-skeleton-text', () => {
    const template = source('stock.page.ts').match(/template:\s*`([\s\S]*?)`/)?.[1] ?? '';
    // Check for skeleton-text when cargando() is true
    expect(template).toMatch(/cargando\(\)[\s\S]*?ion-skeleton-text/);
  });

  it('guia.page keeps showing stock in material suggestions', () => {
    const template = source('guia.page.ts').match(/template:\s*`([\s\S]*?)`/)?.[1] ?? '';
    expect(template).toMatch(/@if\s*\(esMaterial\(\)\)\s*\{[^}]*s\.stock/);
  });

  it('stock.page delegates the stock state to the tested stockState helper', () => {
    expect(source('stock.page.ts')).toMatch(/from '\.\/stock-state'/);
  });

  it('bodega pages contain no long dashes in templates', () => {
    pageFiles.forEach((f) => expect(source(f)).not.toMatch(/[\u2013\u2014]/));
  });
});
