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
        expect(template).toMatch(/<sa-table-wrap|class="[^"]*sa-table-wrap[^"]*"/);
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

  it('stock.page list loading uses the shared list skeleton', () => {
    const template = source('stock.page.ts').match(/template:\s*`([\s\S]*?)`/)?.[1] ?? '';
    const list = readFileSync(join(__dirname, '../shared/sa-list.component.ts'), 'utf8');
    expect(template).toMatch(/\[loading\]="cargando\(\)"/);
    expect(list).toMatch(/ion-skeleton-text/);
  });

  it('guia.page keeps showing stock in material suggestions', () => {
    const template = source('guia.page.ts').match(/template:\s*`([\s\S]*?)`/)?.[1] ?? '';
    expect(template).toMatch(/@if\s*\(esMaterial\(\)\)\s*\{[^}]*s\.stock/);
  });

  it('stock mobile exposes the existing query and a detail overlay without removing desktop operations', () => {
    const content = source('stock.page.ts');
    const template = content.match(/template:\s*`([\s\S]*?)`/)?.[1] ?? '';
    expect(template).toMatch(/class="stock-mobile"/);
    expect(template).toMatch(/\(click\)="abrirDetalle\(f, \$event\)"/);
    expect(template).toMatch(/<ion-modal[^>]*\[isOpen\]="!!detalle\(\)"[^>]*\(didDismiss\)="cerrarDetalle\(\)"/);
    expect(template).toMatch(/\[breakpoints\]="\[0, 1\]"/);
    expect(template).toMatch(/\[initialBreakpoint\]="1"/);
    expect(template).toMatch(/aria-label="Detalle de material"/);
    expect(template).toMatch(/<ion-content class="detalle-content">/);
    expect(template).toMatch(/hayConsulta\(\) && !cargando\(\) && !errorConsulta\(\)/);
    expect(template).toMatch(/\[emptyTitle\]="errorConsulta\(\)/);
    expect(template).toMatch(/Volver/);
    expect(template).toMatch(/f\.nombre[\s\S]*f\.cod_material[\s\S]*f\.bodega[\s\S]*f\.stock[\s\S]*f\.stock_minimo/);
    expect(template).toMatch(/estadoStock\(f\.stock, f\.stock_minimo\)/);
    expect(template).toMatch(/app-bodega-combobox[\s\S]*ion-searchbar/);
    expect(template).toMatch(/abrirAjuste\(f\)/);
    expect(template).toMatch(/precios\.set\(f\)/);
    expect(content).toMatch(/focus\(\{ preventScroll: true \}\)/);
    expect(content).toMatch(/primeros 500: acota bodega o búsqueda/);
  });

  it('keeps operation failures distinct from query failures through the Stock class', () => {
    const ts = require('typescript');
    const vm = require('node:vm');
    const code = ts.transpileModule(source('stock.page.ts'), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true,
    } }).outputText;
    const signal = (initial) => { let value = initial; const get = () => value; get.set = (next) => { value = next; }; return get; };
    let onParams;
    const route = { queryParamMap: { pipe: () => ({ subscribe: (fn) => { onParams = fn; fn({ get: () => null }); } }) } };
    const router = { navigate: jest.fn() };
    const location = { getState: () => ({ stockDetalleAbierto: true }), back: jest.fn() };
    const http = { get: () => ({}) };
    class HttpClient {} class AuthService {} class ActivatedRoute {} class Router {} class Location {}
    const services = new Map([[HttpClient, http], [AuthService, {}], [ActivatedRoute, route], [Router, router], [Location, location]]);
    const core = { Component: () => (target) => target, inject: (token) => services.get(token), signal,
      computed: (fn) => fn, effect: () => {} };
    const modules = {
      '@angular/core': core, '@angular/common/http': { HttpClient }, '@angular/common': { Location },
      '@angular/router': { ActivatedRoute, Router }, '../core/auth.service': { AuthService, API: '/api' },
      '@angular/core/rxjs-interop': { takeUntilDestroyed: () => ({}) },
      rxjs: { firstValueFrom: () => Promise.resolve([]) },
      './stock-state': require('./stock-state'), '../shared/consulta': require('../shared/consulta'),
    };
    const exports = {};
    vm.runInNewContext(code, { exports, require: (name) => modules[name] ?? {}, URLSearchParams });
    const page = new exports.StockPage();
    page.bodega.set(1);
    const row = { cod_material: 'A', id_bodega: 1, stock: 20, stock_minimo: 10, tarifa: 1 };
    page.datos.set([row]); page.filtro.set('crit'); page.alternar(row);
    page.crearPedido();
    expect(page.error()).toBe('Los materiales elegidos ya tienen stock suficiente: no hay nada que pedir');
    expect(page.errorConsulta()).toBe('');
    expect(page.tituloVacio()).toBe('Nada en este estado');
    expect(page.resumen().total).toBe(1);
    expect(page.seleccion().size).toBe(1);
    expect(router.navigate).not.toHaveBeenCalled();
    const focus = jest.fn();
    page.abrirDetalle(row, { currentTarget: { focus } });
    expect(router.navigate).toHaveBeenCalledWith([], { queryParams: { stockDetalle: 'A|1' }, queryParamsHandling: 'merge', state: { stockDetalleAbierto: true } });
    onParams({ get: (key) => key === 'stockDetalle' ? 'A|1' : null });
    expect(page.detalle()).toBe(row);
    page.cerrarDetalle();
    expect(location.back).toHaveBeenCalledTimes(1);
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    onParams({ get: () => null });
    expect(page.detalle()).toBeNull();
    expect(page.bodega()).toBe(1);
    expect(page.filtro()).toBe('crit');
    expect(page.seleccion().size).toBe(1);
  });

  it('stock.page delegates the stock state to the tested stockState helper', () => {
    expect(source('stock.page.ts')).toMatch(/from '\.\/stock-state'/);
  });

  it('bodega pages contain no long dashes in templates', () => {
    pageFiles.forEach((f) => expect(source(f)).not.toMatch(/[\u2013\u2014]/));
  });
});
