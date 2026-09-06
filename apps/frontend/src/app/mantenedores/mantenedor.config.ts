/**
 * Configuración de los mantenedores.
 *
 * El ERP resuelve sus ~30 mantenedores con un switch por tipo dentro de
 * Mant_Tablas.php, que decide tabla, vista, columnas y orden. Aquí es lo mismo,
 * pero declarado: una pantalla genérica lee estas definiciones. Agregar un
 * mantenedor nuevo es agregar una entrada, no una pantalla.
 */
import { UNIDADES } from '../core/modelos';

export type TipoCampo = 'texto' | 'numero' | 'select';

export interface CampoMantenedor {
  clave: string;
  etiqueta: string;
  tipo: TipoCampo;
  requerido?: boolean;
  /** Solo se pide al crear; en la edición no se puede cambiar. */
  soloAlCrear?: boolean;
  opciones?: readonly string[];
  ayuda?: string;
}

export interface ColumnaMantenedor {
  clave: string;
  etiqueta: string;
  /** Ruta con puntos para valores anidados, p. ej. 'ccosto.ccosto'. */
  formato?: 'texto' | 'moneda' | 'numero';
  ancho?: string;
}

export interface ConfigMantenedor {
  ruta: string;
  recurso: string;
  titulo: string;
  permiso: string;
  columnas: ColumnaMantenedor[];
  campos: CampoMantenedor[];
}

export const MANTENEDORES: ConfigMantenedor[] = [
  {
    ruta: 'materiales',
    recurso: 'mantenedores/materiales',
    titulo: 'Materiales',
    permiso: 'Materiales',
    columnas: [
      { clave: 'codMaterial', etiqueta: 'Código', ancho: '110px' },
      { clave: 'nombre', etiqueta: 'Nombre' },
      { clave: 'unidad', etiqueta: 'Unidad', ancho: '90px' },
      { clave: 'categoria', etiqueta: 'Categoría', ancho: '150px' },
      { clave: 'tarifa', etiqueta: 'Tarifa', formato: 'moneda', ancho: '110px' },
      { clave: 'stockMinimo', etiqueta: 'Mínimo', formato: 'numero', ancho: '90px' },
    ],
    campos: [
      {
        clave: 'codMaterial',
        etiqueta: 'Código',
        tipo: 'texto',
        requerido: true,
        soloAlCrear: true,
        ayuda: 'Formato MC_nnn. No se puede cambiar después.',
      },
      { clave: 'nombre', etiqueta: 'Nombre', tipo: 'texto', requerido: true },
      {
        clave: 'unidad',
        etiqueta: 'Unidad',
        tipo: 'select',
        requerido: true,
        opciones: UNIDADES,
      },
      { clave: 'categoriaId', etiqueta: 'Id de categoría', tipo: 'numero' },
      { clave: 'tarifa', etiqueta: 'Tarifa', tipo: 'numero' },
      {
        clave: 'stockMinimo',
        etiqueta: 'Stock mínimo',
        tipo: 'numero',
        ayuda: 'Bajo este valor el material aparece marcado en la consulta de stock.',
      },
    ],
  },
  {
    ruta: 'bodegas',
    recurso: 'mantenedores/bodegas',
    titulo: 'Bodegas',
    permiso: 'Bodegas',
    columnas: [
      { clave: 'codigo', etiqueta: 'Código', ancho: '100px' },
      { clave: 'descripcion', etiqueta: 'Descripción' },
      { clave: 'estado', etiqueta: 'Estado', ancho: '120px' },
      { clave: 'ccosto.ccosto', etiqueta: 'Centro de costo', ancho: '160px' },
      { clave: 'responsable.nombre', etiqueta: 'Responsable', ancho: '180px' },
    ],
    campos: [
      { clave: 'codigo', etiqueta: 'Código', tipo: 'numero', requerido: true, soloAlCrear: true },
      { clave: 'descripcion', etiqueta: 'Descripción', tipo: 'texto', requerido: true },
      { clave: 'ccostoId', etiqueta: 'Id centro de costo', tipo: 'numero' },
      { clave: 'responsableId', etiqueta: 'Id responsable', tipo: 'numero' },
      {
        clave: 'estado',
        etiqueta: 'Estado',
        tipo: 'select',
        opciones: ['VIGENTE', 'NO_VIGENTE'],
      },
    ],
  },
  {
    ruta: 'proveedores',
    recurso: 'mantenedores/proveedores',
    titulo: 'Proveedores',
    permiso: 'Proveedores',
    columnas: [
      { clave: 'rut', etiqueta: 'RUT', ancho: '130px' },
      { clave: 'nombre', etiqueta: 'Nombre' },
      { clave: 'apellido', etiqueta: 'Razón social', ancho: '130px' },
      { clave: 'email', etiqueta: 'Correo', ancho: '210px' },
      { clave: 'diasPlazoPago', etiqueta: 'Plazo', formato: 'numero', ancho: '80px' },
    ],
    campos: [
      { clave: 'rut', etiqueta: 'RUT', tipo: 'texto', requerido: true, soloAlCrear: true },
      { clave: 'nombre', etiqueta: 'Nombre', tipo: 'texto', requerido: true },
      { clave: 'apellido', etiqueta: 'Razón social', tipo: 'texto' },
      { clave: 'direccion', etiqueta: 'Dirección', tipo: 'texto' },
      { clave: 'comuna', etiqueta: 'Comuna', tipo: 'texto' },
      { clave: 'ciudad', etiqueta: 'Ciudad', tipo: 'texto' },
      { clave: 'fono', etiqueta: 'Teléfono', tipo: 'texto' },
      { clave: 'email', etiqueta: 'Correo', tipo: 'texto' },
      { clave: 'contacto', etiqueta: 'Contacto', tipo: 'texto' },
      { clave: 'diasPlazoPago', etiqueta: 'Días de plazo de pago', tipo: 'numero' },
    ],
  },
  {
    ruta: 'categorias',
    recurso: 'mantenedores/categorias',
    titulo: 'Categorías',
    permiso: 'Categorías',
    columnas: [
      { clave: 'tipo', etiqueta: 'Nivel', ancho: '90px' },
      { clave: 'codigo', etiqueta: 'Código', ancho: '130px' },
      { clave: 'glosa', etiqueta: 'Glosa' },
      { clave: 'padre.glosa', etiqueta: 'Depende de', ancho: '200px' },
    ],
    campos: [
      {
        clave: 'tipo',
        etiqueta: 'Nivel',
        tipo: 'select',
        requerido: true,
        soloAlCrear: true,
        opciones: ['CAT', 'SUB', 'IND'],
        ayuda: 'CAT es raíz, SUB cuelga de CAT, IND cuelga de SUB.',
      },
      { clave: 'codigo', etiqueta: 'Código', tipo: 'texto', requerido: true, soloAlCrear: true },
      { clave: 'glosa', etiqueta: 'Glosa', tipo: 'texto', requerido: true },
      { clave: 'padreId', etiqueta: 'Id de la categoría padre', tipo: 'numero' },
    ],
  },
  {
    ruta: 'centros-costo',
    recurso: 'mantenedores/centros-costo',
    titulo: 'Centros de costo',
    permiso: 'Centros de costo',
    columnas: [
      { clave: 'ccosto', etiqueta: 'Código', ancho: '150px' },
      { clave: 'proyecto', etiqueta: 'Proyecto' },
      { clave: 'estado', etiqueta: 'Estado', ancho: '120px' },
      { clave: 'presupuesto', etiqueta: 'Presupuesto', formato: 'moneda', ancho: '140px' },
      { clave: 'responsable.nombre', etiqueta: 'Responsable', ancho: '170px' },
    ],
    campos: [
      { clave: 'ccosto', etiqueta: 'Código', tipo: 'texto', requerido: true, soloAlCrear: true },
      { clave: 'proyecto', etiqueta: 'Proyecto', tipo: 'texto' },
      { clave: 'presupuesto', etiqueta: 'Presupuesto', tipo: 'numero' },
      { clave: 'presupuestoNeto', etiqueta: 'Presupuesto neto', tipo: 'numero' },
      { clave: 'responsableId', etiqueta: 'Id responsable', tipo: 'numero' },
      {
        clave: 'estado',
        etiqueta: 'Estado',
        tipo: 'select',
        opciones: ['VIGENTE', 'NO_VIGENTE', 'ABIERTO', 'CERRADO'],
      },
    ],
  },
];

export const buscarConfig = (ruta: string): ConfigMantenedor | undefined =>
  MANTENEDORES.find((m) => m.ruta === ruta);
