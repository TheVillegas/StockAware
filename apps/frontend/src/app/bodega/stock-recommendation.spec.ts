// @ts-nocheck
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');

function setup(response) {
  const code = ts.transpileModule(readFileSync(join(__dirname, 'stock.page.ts'), 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true,
  } }).outputText;
  let revision = 0;
  const signal = (initial) => { let value = initial; const get = () => value; get.set = (v) => { if (value !== v) { value = v; revision++; } }; return get; };
  const computed = (fn) => { let seen = -1; let value; return () => { if (seen !== revision) { value = fn(); seen = revision; } return value; }; };
  class HttpClient {} class AuthService {} class ActivatedRoute {} class Router {} class Location {} class DestroyRef {}
  const destroy = { onDestroy: jest.fn() };
  const http = { get: jest.fn((url) => ({ url })) };
  const router = { navigate: jest.fn() };
  const services = new Map([[HttpClient, http], [AuthService, { sesion: () => ({ permisos: ['EMITE_OC', 'MATERIAL_X_BODEGA'] }), menu: () => [] }],
    [ActivatedRoute, { queryParamMap: { pipe: () => ({ subscribe: (fn) => fn({ get: () => null }) }) } }], [Router, router], [Location, {}], [DestroyRef, destroy]]);
  const modules = {
    '@angular/core': { Component: () => (x) => x, inject: (x) => services.get(x), signal, computed, DestroyRef, effect: () => {}, untracked: (fn) => fn() },
    '@angular/common/http': { HttpClient }, '@angular/common': { Location }, '@angular/router': { ActivatedRoute, Router },
    '../core/auth.service': { AuthService, API: '/api' }, '@angular/core/rxjs-interop': { takeUntilDestroyed: () => ({}) },
    rxjs: { firstValueFrom: (request) => Promise.resolve(request.url.includes('/precios/') ? response : []) },
    './stock-state': require('./stock-state'), '../shared/consulta': require('../shared/consulta'),
  };
  const exports = {};
  const schedule = (fn, delay) => { const timer = setTimeout(fn, delay); timer?.unref?.(); return timer; };
  vm.runInNewContext(code, { exports, require: (name) => modules[name] ?? {}, URLSearchParams, setTimeout: schedule, clearTimeout, Date });
  return { page: new exports.StockPage(), router, http, destroy };
}
const row = { cod_material: 'A', nombre: 'Material', id_bodega: 1, bodega: 'Central', stock: 0, stock_minimo: 10, consumo_diario: 1, unidad: 'UNI', tarifa: 50 };
const offer = { publicacion_id: 1, vinculo_id: 2, nombre: 'Oferta', url: 'https://example.org/item', precio_normal: 100, precio_oferta: 80, disponible: true, vinculo: 'propuesto', obtenido_en: new Date().toISOString(), verificado_en: new Date().toISOString() };
const response = { cod_material: 'A', cotizable: true, fuentes: [{ fuente: 'dartel', estado: 'ok', publicaciones: [offer] }] };

describe('Stock advisory recommendation', () => {
  it('expires the live verified panel at the boundary and guards suspended-timer actions', async () => {
    jest.useFakeTimers();
    try {
      const now = Date.now();
      const publication = { ...offer, verificado_en: new Date(now - 7 * 86400000 + 1000).toISOString() };
      const { page } = setup({ ...response, fuentes: [{ ...response.fuentes[0], publicaciones: [publication] }] });
      await page.consultarRecomendacion(row);
      page.abrirOferta(publication); page.confirmarOferta(publication);
      page.aceptarRecomendacion();
      expect(page.pasoRecomendado()).toBe('cotizar ahora');
      jest.advanceTimersByTime(999);
      expect(page.pasoRecomendado()).toBe('cotizar ahora');
      jest.advanceTimersByTime(1);
      expect(page.pasoRecomendado()).toBe('validar fuentes');
      expect(page.decisionRecomendacion()).toBe('validar fuentes');
      const later = { ...publication, verificado_en: new Date(Date.now()).toISOString() };
      page.recomendacion.set({ ...response, fuentes: [{ ...response.fuentes[0], publicaciones: [later] }] });
      page.abrirOferta(later); page.confirmarOferta(later);
      expect(page.pasoRecomendado()).toBe('cotizar ahora');
      jest.setSystemTime(Date.now() + 7 * 86400000);
      page.modificarRecomendacion('cotizar ahora');
      expect(page.decisionRecomendacion()).toBe('validar fuentes');
    } finally { jest.useRealTimers(); }
  });
  it('does not let an earlier panel timer invalidate a replacement selection', async () => {
    jest.useFakeTimers();
    try {
      const first = { ...offer, verificado_en: new Date(Date.now() - 7 * 86400000 + 1000).toISOString() };
      const { page } = setup({ ...response, fuentes: [{ ...response.fuentes[0], publicaciones: [first] }] });
      await page.consultarRecomendacion(row); page.abrirOferta(first); page.confirmarOferta(first);
      page.rechazarRecomendacion();
      await page.consultarRecomendacion(row);
      const second = { ...first, verificado_en: new Date(Date.now()).toISOString() };
      page.recomendacion.set({ ...response, fuentes: [{ ...response.fuentes[0], publicaciones: [second] }] });
      page.abrirOferta(second); page.confirmarOferta(second);
      jest.advanceTimersByTime(1000);
      expect(page.pasoRecomendado()).toBe('cotizar ahora');
    } finally { jest.useRealTimers(); }
  });
  it('cancels the verified offer timer on replacement and destruction', async () => {
    jest.useFakeTimers();
    try {
      const { page } = setup(response);
      await page.consultarRecomendacion(row); page.abrirOferta(offer); page.confirmarOferta(offer);
      expect(jest.getTimerCount()).toBe(1);
      await page.consultarRecomendacion(row);
      expect(jest.getTimerCount()).toBe(0);
      page.abrirOferta(offer); page.confirmarOferta(offer);
      expect(jest.getTimerCount()).toBe(1);
      page.ngOnDestroy();
      expect(jest.getTimerCount()).toBe(0);
    } finally { jest.useRealTimers(); }
  });
  it('uses the read-only observations route', async () => {
    const { page, http } = setup(response);
    await page.consultarRecomendacion(row);
    expect(http.get).toHaveBeenCalledWith('/api/precios/A/observaciones');
  });
  it.each([
    { ...response, desactualizado: true },
    { ...response, fuentes: [{ ...response.fuentes[0], estado: 'desactualizada', motivo: 'timeout' }] },
    { ...response, fuentes: [{ ...response.fuentes[0], desactualizado: true }] },
    ...[null, 'invalid', new Date(Date.now() - 8 * 86400000).toISOString()].map((date) => ({ ...response, fuentes: [{ ...response.fuentes[0], publicaciones: [{ ...offer, verificado_en: date }] }] })),
  ])('fails closed on stale or invalid evidence', async (data) => {
    const { page } = setup(data);
    const publication = data.fuentes[0].publicaciones[0];
    await page.consultarRecomendacion(row);
    page.abrirOferta(publication); page.confirmarOferta(publication);
    expect(page.pasoRecomendado()).toBe('validar fuentes');
  });
  it.each([offer, { ...offer, precio_oferta: null }])('requires opening and manually confirming the exact loaded offer before recommending a quote (discount $precio_oferta)', async (publication) => {
    const { page, router } = setup({ ...response, fuentes: [{ ...response.fuentes[0], publicaciones: [publication] }] });
    page.datos.set([row]);
    await page.consultarRecomendacion(row);
    expect(page.pasoRecomendado()).toBe('validar fuentes');
    page.confirmarOferta(publication);
    expect(page.pasoRecomendado()).toBe('validar fuentes');
    page.abrirOferta(publication);
    page.confirmarOferta(publication);
    expect(page.pasoRecomendado()).toBe('cotizar ahora');
    page.rechazarRecomendacion();
    expect(page.recomendacion()).toBeNull();
    expect(router.navigate).not.toHaveBeenCalled();
  });
  it('does not carry verification across an observation or material and leaves urgency unchanged', async () => {
    const { page } = setup(response);
    page.datos.set([row]);
    await page.consultarRecomendacion(row);
    page.abrirOferta(offer); page.confirmarOferta(offer);
    expect(page.pasoRecomendado()).toBe('cotizar ahora');
    page.recomendacion.set({ ...response, fuentes: [{ ...response.fuentes[0], publicaciones: [{ ...offer, verificado_en: '2026-02-01' }] }] });
    expect(page.pasoRecomendado()).toBe('validar fuentes');
    expect(page.resumen().urgente).toBe(1);
    await page.consultarRecomendacion({ ...row, cod_material: 'B' });
    expect(page.pasoRecomendado()).toBe('validar fuentes');
  });
  it('accepts or modifies only the local advisory choice without creating an order', async () => {
    const { page, router } = setup(response);
    await page.consultarRecomendacion(row);
    page.aceptarRecomendacion();
    expect(page.decisionRecomendacion()).toBe('validar fuentes');
    page.modificarRecomendacion('cotizar ahora');
    expect(page.decisionRecomendacion()).toBe('validar fuentes');
    page.abrirOferta(offer); page.confirmarOferta(offer);
    page.modificarRecomendacion('cotizar ahora');
    expect(page.decisionRecomendacion()).toBe('cotizar ahora');
    page.modificarRecomendacion('validar fuentes');
    expect(page.decisionRecomendacion()).toBe('validar fuentes');
    expect(router.navigate).not.toHaveBeenCalled();
    expect(page.seleccion().size).toBe(0);
  });
});
