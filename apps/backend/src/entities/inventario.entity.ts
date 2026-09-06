/**
 * Inventario: saldo por material-bodega y libro de movimientos.
 *
 * REPLICADO A PROPÓSITO: el saldo de `material_bodega` es MUTABLE. Se escribe
 * con stock = stock ± cantidad al registrar cada movimiento y se revierte a
 * mano al eliminarlo. NO se deriva del libro, y no puede derivarse: una entrega
 * a persona escribe dos filas —OUT con el centro de costo de la bodega, IN con
 * el del funcionario, ambas sobre la misma bodega— de las que solo la primera
 * mueve stock. La segunda es imputación contable, y nada en la tabla las
 * distingue. Es el diseño del ERP y se conserva como línea base.
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
import { Bodega, Categoria, CentroCosto, Material } from './maestros.entity.js';
import { Documento } from './documentos.entity.js';
import {
  TipoDocMovimiento,
  TipoMovimiento,
  UnidadMedida,
  numericTransformer,
} from './tipos.js';

@Entity('material_bodega')
@Index(['materialId', 'bodegaId'], { unique: true })
export class MaterialBodega {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'material_id', type: 'int' })
  materialId: number;

  @ManyToOne(() => Material)
  @JoinColumn({ name: 'material_id' })
  material: Material;

  @Column({ name: 'bodega_id', type: 'int' })
  bodegaId: number;

  @ManyToOne(() => Bodega)
  @JoinColumn({ name: 'bodega_id' })
  bodega: Bodega;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0, transformer: numericTransformer })
  stock: number;
}

@Entity('movimiento_bodega')
export class MovimientoBodega {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  numdoc: number;

  @Column({ name: 'tipo_doc', type: 'enum', enum: TipoDocMovimiento, enumName: 'tipo_doc_movimiento', default: TipoDocMovimiento.GR })
  tipoDoc: TipoDocMovimiento;

  @Column({ name: 'tipo_mov', type: 'enum', enum: TipoMovimiento, enumName: 'tipo_movimiento' })
  tipoMov: TipoMovimiento;

  @Column({ name: 'bodega_id', type: 'int' })
  bodegaId: number;

  @ManyToOne(() => Bodega)
  @JoinColumn({ name: 'bodega_id' })
  bodega: Bodega;

  /**
   * En el ERP esto es polimórfico: `tipo_vhe` con 14 valores e `id_vhe` como
   * identificador sin tipo. Vehículos y herramientas quedan fuera del alcance,
   * así que aquí es una referencia declarada a material.
   */
  @Column({ name: 'material_id', type: 'int' })
  materialId: number;

  @ManyToOne(() => Material)
  @JoinColumn({ name: 'material_id' })
  material: Material;

  @Column({ type: 'numeric', precision: 12, scale: 2, transformer: numericTransformer })
  cantidad: number;

  @Column({ type: 'enum', enum: UnidadMedida, enumName: 'unidad_medida' })
  unidad: UnidadMedida;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0, transformer: numericTransformer })
  tarifa: number;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  fecha: Date;

  @Column({ name: 'fecha_fin', type: 'date', nullable: true })
  fechaFin: string | null;

  @Column({ name: 'ccosto_id', type: 'int', nullable: true })
  ccostoId: number | null;

  @ManyToOne(() => CentroCosto, { nullable: true })
  @JoinColumn({ name: 'ccosto_id' })
  ccosto: CentroCosto | null;

  @Column({ name: 'categoria_id', type: 'int', nullable: true })
  categoriaId: number | null;

  @ManyToOne(() => Categoria, { nullable: true })
  @JoinColumn({ name: 'categoria_id' })
  categoria: Categoria | null;

  @Column({ name: 'responsable_id', type: 'int', nullable: true })
  responsableId: number | null;

  @ManyToOne(() => Usuario, { nullable: true })
  @JoinColumn({ name: 'responsable_id' })
  responsable: Usuario | null;

  /** La HES que originó el movimiento, cuando lo hubo. */
  @Column({ name: 'documento_id', type: 'int', nullable: true })
  documentoId: number | null;

  @ManyToOne(() => Documento, { nullable: true })
  @JoinColumn({ name: 'documento_id' })
  documento: Documento | null;

  /** En el ERP se llama `estado varchar(300)`, pero guarda una observación. */
  @Column({ type: 'varchar', length: 300, default: '' })
  observacion: string;
}
