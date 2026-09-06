/**
 * Documentos de compra: OC y HES en una sola tabla con discriminador `tipo`,
 * como en el ERP. La HES referencia a su OC dentro de la misma tabla.
 */
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Usuario } from './acceso.entity.js';
import { Bodega, Categoria, CentroCosto, Proveedor } from './maestros.entity.js';
import {
  EstadoDocumento,
  TipoDocumento,
  TipoMoneda,
  numericTransformer,
} from './tipos.js';

@Entity('documento')
@Index(['tipo', 'numdoc'], { unique: true })
export class Documento {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'enum', enum: TipoDocumento, enumName: 'tipo_documento' })
  tipo: TipoDocumento;

  /** Correlativo propio por tipo: OC desde 12000, HES desde 8000. */
  @Column({ type: 'int' })
  numdoc: number;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  fecha: Date;

  @Column({ name: 'proveedor_id', type: 'int' })
  proveedorId: number;

  @ManyToOne(() => Proveedor)
  @JoinColumn({ name: 'proveedor_id' })
  proveedor: Proveedor;

  @Column({ type: 'enum', enum: EstadoDocumento, enumName: 'estado_documento', default: EstadoDocumento.PENDIENTE })
  estado: EstadoDocumento;

  /** Solo la HES lo lleva; hay un CHECK en la base que lo exige. */
  @Column({ name: 'oc_id', type: 'int', nullable: true })
  ocId: number | null;

  @ManyToOne(() => Documento, { nullable: true })
  @JoinColumn({ name: 'oc_id' })
  oc: Documento | null;

  /**
   * REPLICADO A PROPÓSITO: es un PORCENTAJE acumulado (0..100), no una cantidad
   * recibida. Lo pendiente de una línea es cantidad * (100 - ocAvance) / 100,
   * con el error de redondeo que eso arrastra en recepciones parciales.
   */
  @Column({ name: 'oc_avance', type: 'numeric', precision: 8, scale: 4, default: 0, transformer: numericTransformer })
  ocAvance: number;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0, transformer: numericTransformer })
  neto: number;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0, transformer: numericTransformer })
  iva: number;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0, transformer: numericTransformer })
  total: number;

  @Column({ name: 'tipo_moneda', type: 'enum', enum: TipoMoneda, enumName: 'tipo_moneda', default: TipoMoneda.CLP })
  tipoMoneda: TipoMoneda;

  @Column({ name: 'tipo_cambio', type: 'numeric', precision: 10, scale: 4, default: 1, transformer: numericTransformer })
  tipoCambio: number;

  @Column({ name: 'fecha_moneda', type: 'timestamptz', default: () => 'now()' })
  fechaMoneda: Date;

  @Column({ name: 'ccosto_id', type: 'int', nullable: true })
  ccostoId: number | null;

  @ManyToOne(() => CentroCosto, { nullable: true })
  @JoinColumn({ name: 'ccosto_id' })
  ccosto: CentroCosto | null;

  @Column({ name: 'bodega_id', type: 'int', nullable: true })
  bodegaId: number | null;

  @ManyToOne(() => Bodega, { nullable: true })
  @JoinColumn({ name: 'bodega_id' })
  bodega: Bodega | null;

  /** Reemplaza el flag `HES='MF'` del ERP, que reusaba una columna de texto. */
  @Column({ name: 'cargada_a_bodega', type: 'boolean', default: false })
  cargadaABodega: boolean;

  @Column({ name: 'fecha_carga', type: 'date', nullable: true })
  fechaCarga: string | null;

  @Column({ type: 'varchar', length: 1024, nullable: true })
  observacion: string | null;

  @Column({ name: 'usuario_id', type: 'int', nullable: true })
  usuarioId: number | null;

  @ManyToOne(() => Usuario, { nullable: true })
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario | null;

  @OneToMany(() => DocumentoDetalle, (d) => d.documento, { cascade: ['insert'] })
  detalle: DocumentoDetalle[];
}

@Entity('documento_detalle')
export class DocumentoDetalle {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'documento_id', type: 'int' })
  documentoId: number;

  @ManyToOne(() => Documento, (d) => d.detalle, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'documento_id' })
  documento: Documento;

  @Column({ type: 'varchar', length: 20, nullable: true })
  producto: string | null;

  /**
   * REPLICADO A PROPÓSITO: transporta el código del material embebido, con el
   * formato "DESCRIPCION/MC_412". La carga a bodega lo extrae partiendo la
   * cadena, igual que Material_IN.php en el ERP.
   */
  @Column({ type: 'varchar', length: 120 })
  nombre: string;

  @Column({ type: 'varchar', length: 512, default: '' })
  descripcion: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  comentario: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, transformer: numericTransformer })
  cantidad: number;

  /** Texto libre con default 'KG', distinto del enumerado del maestro. */
  @Column({ type: 'varchar', length: 20, default: 'KG' })
  unidad: string;

  @Column({ name: 'precio_uni', type: 'numeric', precision: 15, scale: 2, transformer: numericTransformer })
  precioUni: number;

  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0, transformer: numericTransformer })
  descuento: number;

  @Column({ type: 'numeric', precision: 14, scale: 2, transformer: numericTransformer })
  total: number;

  @Column({ name: 'oc_avance', type: 'numeric', precision: 8, scale: 4, default: 0, transformer: numericTransformer })
  ocAvance: number;

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
}
