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

  it('mantiene el tablero de escritorio y oculta solo su presentación en Inicio móvil', () => {
    const page = source();
    expect(page).toContain('Flujo de abastecimiento');
    expect(page).toContain('class="escritorio-inicio"');
    expect(page).toMatch(/@media \(max-width: 767\.98px\)[\s\S]*?\.escritorio-inicio/);
    expect(page).toContain('Órdenes por aprobar');
  });
});
