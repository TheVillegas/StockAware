// @ts-nocheck
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const source = () => readFileSync(join(__dirname, 'inicio.page.ts'), 'utf8');

describe('Inicio móvil y Pendientes', () => {
  it('separa la vista por datos de ruta y enlaza Pendientes desde Inicio', () => {
    const page = source();
    expect(page).toContain("snapshot.data['pendientes'] === true");
    expect(page).toContain('routerLink="/pendientes"');
    expect(page).toContain('[class.vista-pendientes]="esPendientes"');
    expect(page).toContain('Por resolver');
  });

  it('ofrece rutas operativas solo desde la navegación y acciones autorizadas', () => {
    const page = source();
    expect(page).toContain("accionesCrear(this.auth.menu()).find((a) => a.key === 'ingreso')");
    expect(page).toContain("this.entradas().get('stock')");
    expect(page).toMatch(/@if \(registrar\(\); as r\)/);
    expect(page).toMatch(/@if \(ingreso\(\); as ingreso\)/);
    expect(page).toMatch(/@if \(stock\(\); as stock\)/);
  });

  it('conserva los paneles autorizados con carga, error, vacío y límites existentes', () => {
    const page = source();
    expect(page).toContain('pendientesPerfil(this.navegacion(), this.auth.sesion()?.permisos ?? [])');
    for (const state of ['cargaStock()', 'cargaOc()', 'cargaFacturas()']) {
      expect(page).toContain(`@switch (${state})`);
    }
    expect(page).toContain('stockTope()');
    expect(page).toContain('slice(0, FILAS)');
    expect(page).toContain('Los listados muestran hasta tres elementos');
    expect(page).toContain('No hay tareas pendientes disponibles para tu perfil.');
  });

  it('presenta jerarquía y acciones móviles con iconos y descripciones', () => {
    const page = source();
    expect(page).toContain('Operaciones');
    expect(page).toContain('Acción frecuente');
    expect(page).toContain('class="icono-tarea"');
    expect(page).toContain('Consultar disponibilidad');
    expect(page).toContain('class="atencion-real"');
    expect(page).toContain('@media (max-width: 350px)');
  });

  it('expone en Inicio móvil únicamente la aprobación autorizada y conserva Pendientes sin ese botón', () => {
    const page = source();
    expect(page).toContain(`[class.inicio-paneles--aprobacion]="!esPendientes && paneles().has('oc-aprobar') && ocsPendientes().length > 0"`);
    expect(page).toContain('.inicio-paneles.inicio-paneles--aprobacion { display: block; }');
    expect(page).toContain('.inicio-paneles--aprobacion .sa-panels > .sa-panel:not(.panel-oc-aprobar) { display: none; }');
    expect(page).toMatch(/<section class="sa-panel panel-oc-aprobar"[\s\S]*?@if \(!esPendientes\) \{[\s\S]*?\(click\)="aprobar\(o\)"/);
  });

  it('mantiene el tablero de escritorio y oculta solo su presentación en Inicio móvil', () => {
    const page = source();
    expect(page).toContain('Flujo de abastecimiento');
    expect(page).toContain('class="escritorio-inicio"');
    expect(page).toMatch(/@media \(max-width: 767\.98px\)[\s\S]*?\.escritorio-inicio/);
    expect(page).toContain('Órdenes por aprobar');
  });
});
