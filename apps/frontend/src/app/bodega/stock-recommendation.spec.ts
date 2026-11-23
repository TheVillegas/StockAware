// @ts-nocheck
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');

function setup(response) {
  const code = ts.transpileModule(readFileSync(join(__dirname, 'stock.page.ts'), 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true,
  } }).outputText;
  const signal = (initial) => { let value = initial; const get = () => value; get.set = (v) => { value = v; }; return get; };
  class HttpClient {} class AuthService {} class ActivatedRoute {} class Router {} class Location {}
  const http = { get: jest.fn((url) => ({ url })) };
  const router = { navigate: jest.fn() };
  const services = new Map([[HttpClient, http], [AuthService, { sesion: () => ({ permisos: ['EMITE_OC', 'MATERIAL_X_BODEGA'] }), menu: () => [] }],
    [ActivatedRoute, { queryParamMap: { pipe: () => ({ subscribe: (fn) => fn({ get: () => null }) }) } }], [Router, router], [Location, {}]]);
  const modules = {
    '@angular/core': { Component: () => (x) => x, inject: (x) => services.get(x), signal, computed: (fn) => fn, effect: () => {}, untracked: (fn) => fn() },
    '@angular/common/http': { HttpClient }, '@angular/common': { Location }, '@angular/router': { ActivatedRoute, Router },
    '../core/auth.service': { AuthService, API: '/api' }, '@angular/core/rxjs-interop': { takeUntilDestroyed: () => ({}) },
    rxjs: { firstValueFrom: (request) => Promise.resolve(request.url.includes('/precios/') ? response : []) },
    './stock-state': require('./stock-state'), '../shared/consulta': require('../shared/consulta'),
  };
  const exports = {};
  vm.runInNewContext(code, { exports, require: (name) => modules[name] ?? {}, URLSearchParams });
  return { page: new exports.StockPage(), router, http };
}
const row = { cod_material: 'A', nombre: 'Material', id_bodega: 1, bodega: 'Central', stock: 0, stock_minimo: 10, consumo_diario: 1, unidad: 'UNI', tarifa: 50 };
const offer = { publicacion_id: 1, vinculo_id: 2, nombre: 'Oferta', url: 'https://example.org/item', precio_normal: 100, precio_oferta: 80, disponible: true, vinculo: 'propuesto', obtenido_en: '2026-01-01', verificado_en: '2026-01-01' };
const response = { cod_material: 'A', cotizable: true, fuentes: [{ fuente: 'dartel', estado: 'ok', publicaciones: [offer] }] };

describe('Stock advisory recommendation', () => {
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
