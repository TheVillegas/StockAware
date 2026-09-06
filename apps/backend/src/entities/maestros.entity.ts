/**
 * Tablas maestras del módulo: categoría, centro de costo, bodega, proveedor
 * y material.
 */
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Usuario } from './acceso.entity.js';
import {
  EstadoBodega,
  EstadoCcosto,
  EstadoGenerico,
  EstadoMaterial,
  TipoCategoria,
  UnidadMedida,
  numericTransformer,
} from './tipos.js';

/** Jerarquía de 3 niveles: CAT → SUB → IND, encadenada por `padreId`. */
@Entity('categoria')
@Index(['tipo', 'codigo'], { unique: true })
export class Categoria {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'enum', enum: TipoCategoria, enumName: 'tipo_categoria' })
  tipo: TipoCategoria;

  @Column({ name: 'padre_id', type: 'int', nullable: true })
  padreId: number | null;

  @ManyToOne(() => Categoria, { nullable: true })
  @JoinColumn({ name: 'padre_id' })
  padre: Categoria | null;

  @Column({ type: 'varchar', length: 15 })
  codigo: string;

  @Column({ type: 'varchar', length: 60 })
  glosa: string;

  @Column({ type: 'boolean', default: true })
  activa: boolean;
}

@Entity('centro_costo')
export class CentroCosto {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 50, unique: true })
  ccosto: string;

  @Column({ type: 'varchar', length: 50, default: '' })
  proyecto: string;

  @Column({ name: 'fecha_inicio', type: 'date', nullable: true })
  fechaInicio: string | null;

  @Column({ name: 'fecha_fin', type: 'date', nullable: true })
  fechaFin: string | null;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0, transformer: numericTransformer })
  presupuesto: number;

  @Column({ name: 'presupuesto_neto', type: 'numeric', precision: 14, scale: 2, default: 0, transformer: numericTransformer })
  presupuestoNeto: number;

  @Column({ type: 'enum', enum: EstadoCcosto, enumName: 'estado_ccosto', default: EstadoCcosto.VIGENTE })
  estado: EstadoCcosto;

  @Column({ name: 'responsable_id', type: 'int', nullable: true })
  responsableId: number | null;

  @ManyToOne(() => Usuario, { nullable: true })
  @JoinColumn({ name: 'responsable_id' })
  responsable: Usuario | null;
}

/**
 * `codigo` es integer, no varchar: en el ERP la columna es varchar(30) pero sus
 * 541 filas son todas numéricas y se unía por coerción contra un int.
 */
@Entity('bodega')
export class Bodega {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', unique: true })
  codigo: number;

  @Column({ type: 'varchar', length: 60 })
  descripcion: string;

  @Column({ type: 'enum', enum: EstadoBodega, enumName: 'estado_bodega', default: EstadoBodega.VIGENTE })
  estado: EstadoBodega;

  @Column({ name: 'ccosto_id', type: 'int', nullable: true })
  ccostoId: number | null;

  @ManyToOne(() => CentroCosto, { nullable: true })
  @JoinColumn({ name: 'ccosto_id' })
  ccosto: CentroCosto | null;

  @Column({ name: 'fecha_ingreso', type: 'date', default: () => 'CURRENT_DATE' })
  fechaIngreso: string;

  @Column({ name: 'responsable_id', type: 'int', nullable: true })
  responsableId: number | null;

  @ManyToOne(() => Usuario, { nullable: true })
  @JoinColumn({ name: 'responsable_id' })
  responsable: Usuario | null;
}

/**
 * En el ERP proveedores y clientes comparten `data_clientes` con un
 * discriminador `tipo_reg`. StockAware no tiene clientes: la tabla es solo de
 * proveedores.
 */
@Entity('proveedor')
export class Proveedor {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 15, unique: true })
  rut: string;

  @Column({ type: 'varchar', length: 50 })
  nombre: string;

  @Column({ type: 'varchar', length: 50, default: '' })
  apellido: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  direccion: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  comuna: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  ciudad: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  fono: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  contacto: string | null;

  @Column({ name: 'categoria_id', type: 'int', nullable: true })
  categoriaId: number | null;

  @ManyToOne(() => Categoria, { nullable: true })
  @JoinColumn({ name: 'categoria_id' })
  categoria: Categoria | null;

  @Column({ name: 'dias_plazo_pago', type: 'smallint', default: 30 })
  diasPlazoPago: number;

  @Column({ type: 'enum', enum: EstadoGenerico, enumName: 'estado_generico', default: EstadoGenerico.ACTIVO })
  estado: EstadoGenerico;

  @Column({ name: 'fecha_ingreso', type: 'date', nullable: true })
  fechaIngreso: string | null;
}

/**
 * `tarifa` guarda el ÚLTIMO precio de compra, pisado en cada recepción: es el
 * comportamiento del ERP y se replica. No hay historial de precios en el
 * maestro; hay que reconstruirlo desde el detalle de las OC.
 */
@Entity('material')
export class Material {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'cod_material', type: 'varchar', length: 20, unique: true })
  codMaterial: string;

  @Column({ type: 'varchar', length: 120 })
  nombre: string;

  @Column({ type: 'enum', enum: EstadoMaterial, enumName: 'estado_material', default: EstadoMaterial.ALTA })
  estado: EstadoMaterial;

  @Column({ type: 'enum', enum: UnidadMedida, enumName: 'unidad_medida' })
  unidad: UnidadMedida;

  @Column({ name: 'categoria_id', type: 'int', nullable: true })
  categoriaId: number | null;

  @ManyToOne(() => Categoria, { nullable: true })
  @JoinColumn({ name: 'categoria_id' })
  categoria: Categoria | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0, transformer: numericTransformer })
  tarifa: number;

  @Column({ name: 'stock_minimo', type: 'numeric', precision: 12, scale: 2, default: 0, transformer: numericTransformer })
  stockMinimo: number;
}
