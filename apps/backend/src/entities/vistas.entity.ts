/**
 * Vistas del mantenedor.
 *
 * Se mapean con @ViewEntity contra las vistas que ya existen en la base
 * (`expression` se omite a propósito: la definición vive en
 * database/init/01_schema.sql y no debe duplicarse aquí, o las dos se
 * desalinean sin avisar).
 *
 * Son la razón principal de haber elegido TypeORM sobre Prisma: sostienen todo
 * el patrón de mantenedor del ERP y aquí son entidades de primera clase.
 */
import { ViewColumn, ViewEntity } from 'typeorm';
import {
  EstadoMaterial,
  TipoDocMovimiento,
  TipoDocumento,
  TipoMovimiento,
  UnidadMedida,
  numericTransformer,
} from './tipos.js';

@ViewEntity({ name: 'v_material', synchronize: false })
export class VMaterial {
  @ViewColumn()
  id: number;

  @ViewColumn({ name: 'cod_material' })
  codMaterial: string;

  @ViewColumn()
  nombre: string;

  @ViewColumn()
  estado: EstadoMaterial;

  @ViewColumn()
  unidad: UnidadMedida;

  @ViewColumn({ transformer: numericTransformer })
  tarifa: number;

  @ViewColumn({ name: 'stock_minimo', transformer: numericTransformer })
  stockMinimo: number;

  @ViewColumn({ name: 'categoria_codigo' })
  categoriaCodigo: string | null;

  @ViewColumn()
  categoria: string | null;
}

/**
 * `bajoMinimo` es la señal de reposición. El ERP la calcula en PHP en cada
 * pantalla; aquí la resuelve la vista.
 */
@ViewEntity({ name: 'v_material_bodega', synchronize: false })
export class VMaterialBodega {
  @ViewColumn({ name: 'material_id' })
  materialId: number;

  @ViewColumn({ name: 'cod_material' })
  codMaterial: string;

  @ViewColumn()
  nombre: string;

  @ViewColumn()
  estado: EstadoMaterial;

  @ViewColumn()
  unidad: UnidadMedida;

  @ViewColumn({ name: 'bodega_id' })
  bodegaId: number;

  @ViewColumn({ name: 'bodega_codigo' })
  bodegaCodigo: number;

  @ViewColumn()
  bodega: string;

  @ViewColumn({ transformer: numericTransformer })
  stock: number;

  @ViewColumn({ name: 'stock_minimo', transformer: numericTransformer })
  stockMinimo: number;

  @ViewColumn({ transformer: numericTransformer })
  tarifa: number;

  @ViewColumn({ name: 'bajo_minimo' })
  bajoMinimo: boolean;
}

/**
 * A diferencia de `v_mov_bodega` del ERP —cuyo CASE resuelve vehículos y
 * herramientas pero NO materiales, dejando la columna vacía justo para este
 * módulo— aquí el nombre del material sí se resuelve.
 */
@ViewEntity({ name: 'v_movimiento_bodega', synchronize: false })
export class VMovimientoBodega {
  @ViewColumn()
  id: number;

  @ViewColumn()
  numdoc: number;

  @ViewColumn({ name: 'tipo_doc' })
  tipoDoc: TipoDocMovimiento;

  @ViewColumn({ name: 'tipo_mov' })
  tipoMov: TipoMovimiento;

  @ViewColumn()
  fecha: Date;

  @ViewColumn({ name: 'fecha_fin' })
  fechaFin: string | null;

  @ViewColumn({ transformer: numericTransformer })
  cantidad: number;

  @ViewColumn()
  unidad: UnidadMedida;

  @ViewColumn({ transformer: numericTransformer })
  tarifa: number;

  @ViewColumn()
  observacion: string;

  @ViewColumn({ name: 'cod_material' })
  codMaterial: string;

  @ViewColumn()
  material: string;

  @ViewColumn({ name: 'bodega_codigo' })
  bodegaCodigo: number;

  @ViewColumn()
  bodega: string;

  @ViewColumn()
  ccosto: string | null;

  @ViewColumn()
  responsable: string | null;

  @ViewColumn({ name: 'origen_tipo' })
  origenTipo: TipoDocumento | null;

  @ViewColumn({ name: 'origen_numdoc' })
  origenNumdoc: number | null;
}
