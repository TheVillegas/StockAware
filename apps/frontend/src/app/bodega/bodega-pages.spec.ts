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

function stockPageVm({ location, rows, trackEffects } = {}) {
  const ts = require('typescript');
  const vm = require('node:vm');
  const code = ts.transpileModule(source('stock.page.ts'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true,
  } }).outputText;
  let active = null;
  const signal = (initial) => {
    let value = initial;
    const readers = new Set();
    const get = () => {
      if (active) readers.add(active);
      return value;
    };
    get.set = (next) => {
      value = next;
      if (!trackEffects) return;
      [...readers].forEach((run) => run());
    };
    return get;
  };
  let onParams;
  const route = { queryParamMap: { pipe: () => ({ subscribe: (fn) => { onParams = fn; fn({ get: () => null }); } }) } };
  const router = { navigate: jest.fn() };
  const loc = location ?? { getState: () => ({ stockDetalleAbierto: true }), back: jest.fn() };
  const http = { get: () => ({}) };
  class HttpClient {} class AuthService {} class ActivatedRoute {} class Router {} class Location {}
  const services = new Map([[HttpClient, http], [AuthService, {}], [ActivatedRoute, route], [Router, router], [Location, loc]]);
  const effect = trackEffects
    ? (fn) => {
        const run = () => {
          const prev = active;
          active = run;
          try { fn(); } finally { active = prev; }
        };
        run();
      }
    : () => {};
  const untracked = (fn) => {
    const prev = active;
    active = null;
    try { return fn(); } finally { active = prev; }
  };
  const core = { Component: () => (target) => target, inject: (token) => services.get(token), signal,
    computed: (fn) => fn, effect, untracked };
  const modules = {
    '@angular/core': core, '@angular/common/http': { HttpClient }, '@angular/common': { Location },
    '@angular/router': { ActivatedRoute, Router }, '../core/auth.service': { AuthService, API: '/api' },
    '@angular/core/rxjs-interop': { takeUntilDestroyed: () => ({}) },
    rxjs: { firstValueFrom: () => Promise.resolve(rows ?? []) },
    './stock-state': require('./stock-state'), '../shared/consulta': require('../shared/consulta'),
  };
  const exports = {};
  vm.runInNewContext(code, { exports, require: (name) => modules[name] ?? {}, URLSearchParams });
  return { page: new exports.StockPage(), onParams, router, location: loc };
}

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
      computed: (fn) => fn, effect: () => {}, untracked: (fn) => fn() };
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

  it('keeps a rejected order and an empty filter off the load-error title', () => {
    const { page, onParams } = stockPageVm();
    page.bodega.set(1);
    const row = { cod_material: 'A', id_bodega: 1, stock: 20, stock_minimo: 10, tarifa: 1 };
    page.datos.set([row]);
    page.filtro.set('crit');
    page.alternar(row);
    page.crearPedido();
    expect(page.error()).toBe('Los materiales elegidos ya tienen stock suficiente: no hay nada que pedir');
    expect(page.errorConsulta()).toBe('');
    expect(page.tituloVacio()).toBe('Nada en este estado');
    expect(page.resumen().total).toBe(1);
    page.errorConsulta.set('No se pudo cargar el stock');
    page.datos.set([]);
    expect(page.tituloVacio()).toBe('Sin resultados');
    onParams({ get: (key) => key === 'stockDetalle' ? 'MISSING|9' : null });
    expect(page.detalle()).toBeNull();
  });

  it('clears a deep-linked detail without popping history', () => {
    const location = { getState: () => ({}), back: jest.fn() };
    const { page, onParams, router } = stockPageVm({ location });
    onParams({ get: (key) => key === 'stockDetalle' ? 'A|1' : null });
    page.cerrarDetalle();
    expect(location.back).not.toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith([], { queryParams: { stockDetalle: null }, queryParamsHandling: 'merge', replaceUrl: true });
  });

  it('does not present zero filter-chip counts when the stock query failed', () => {
    const template = source('stock.page.ts').match(/template:\s*`([\s\S]*?)`/)?.[1] ?? '';
    const chips = template.match(/<div class="sa-chips vistas"[\s\S]*?<\/div>/)?.[0] ?? '';
    expect(chips).toMatch(/elegirFiltro\('urgente'\)/);
    expect(chips).toMatch(/elegirFiltro\('pronto'\)/);
    expect(chips).toMatch(/elegirFiltro\('warn'\)/);
    expect(chips).toMatch(/elegirFiltro\('crit'\)/);
    expect(chips).toMatch(/elegirFiltro\('todos'\)/);
    const { page } = stockPageVm();
    page.errorConsulta.set('No se pudo cargar el stock');
    page.datos.set([]);
    expect(page.resumen().urgente).toBe(0);
    expect(page.resumen().pronto).toBe(0);
    expect(page.resumen().bajo).toBe(0);
    expect(page.resumen().sin).toBe(0);
    expect(page.resumen().total).toBe(0);
    for (const key of ['urgente', 'pronto', 'bajo', 'sin', 'total']) {
      const at = chips.indexOf(`resumen().${key}`);
      expect(at).toBeGreaterThan(-1);
      expect(chips.slice(Math.max(0, at - 80), at)).toMatch(/!errorConsulta\(\)/);
    }
  });

  it('clears a missing deep-linked detail after the first load and keeps one that is present', async () => {
    const missing = stockPageVm({ rows: [], trackEffects: true });
    missing.onParams({ get: (key) => key === 'stockDetalle' ? 'MISSING|9' : null });
    missing.page.bodega.set(1);
    await new Promise((resolve) => setImmediate(resolve));
    expect(missing.location.back).not.toHaveBeenCalled();
    expect(missing.router.navigate).toHaveBeenCalledWith([], { queryParams: { stockDetalle: null }, queryParamsHandling: 'merge', replaceUrl: true });
    expect(missing.page.detalle()).toBeNull();

    const row = { cod_material: 'A', id_bodega: 1, stock: 20, stock_minimo: 10, tarifa: 1 };
    const present = stockPageVm({ rows: [row], trackEffects: true });
    // A real deep link carries its query (Pendientes links use ?bajo=1) together with the detail key.
    present.onParams({ get: (key) => ({ stockDetalle: 'A|1', bajo: '1' })[key] ?? null });
    await new Promise((resolve) => setImmediate(resolve));
    expect(present.router.navigate).not.toHaveBeenCalled();
    expect(present.page.detalle()).toBe(row);
  });

  it('clears a cold deep-linked detail when there is no query to load it from', async () => {
    const cold = stockPageVm({ rows: [], trackEffects: true });
    cold.onParams({ get: (key) => key === 'stockDetalle' ? 'A|1' : null });
    await new Promise((resolve) => setImmediate(resolve));
    expect(cold.page.hayConsulta()).toBe(false);
    expect(cold.location.back).not.toHaveBeenCalled();
    expect(cold.router.navigate).toHaveBeenCalledWith([], { queryParams: { stockDetalle: null }, queryParamsHandling: 'merge', replaceUrl: true });
    expect(cold.page.detalle()).toBeNull();
  });

  it('stock.page delegates the stock state to the tested stockState helper', () => {
    expect(source('stock.page.ts')).toMatch(/from '\.\/stock-state'/);
  });

  it('bodega pages contain no long dashes in templates', () => {
    pageFiles.forEach((f) => expect(source(f)).not.toMatch(/[\u2013\u2014]/));
  });
});
