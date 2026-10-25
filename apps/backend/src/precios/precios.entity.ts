/**
 * Entidades del esquema precios_externos (ADR 0002, "Persistencia").
 *
 * El esquema lo crea la migracion 1767225600000-PreciosExternos, nunca
 * synchronize. Las relaciones se dejan como columnas planas (publicacion_id):
 * las consultas se arman en PreciosRepositorio.
 */
import { Column, Entity, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';

const ESQUEMA = 'precios_externos';

export type Fuente = 'dartel' | 'dimeiggs' | 'solotodo' | 'rhona' | 'sodimac';
export type CausaFalla = 'timeout' | 'http_error' | 'invalid_content';
export type EstadoVinculo = 'propuesto' | 'confirmado' | 'rechazado';
export type DefinidoPor = 'regla' | 'usuario';

@Entity({ name: 'publicacion', schema: ESQUEMA })
export class Publicacion {
  @PrimaryGeneratedColumn() id: number;
  @Column({ type: 'varchar' }) fuente: Fuente;
  @Column({ type: 'varchar' }) id_externo: string;
  @Column({ type: 'varchar' }) url: string;
  @Column({ type: 'varchar' }) nombre: string;
  @Column({ type: 'varchar', nullable: true }) marca: string | null;
  @Column({ type: 'varchar', nullable: true }) ean: string | null;
  @Column({ type: 'varchar', nullable: true }) categoria_fuente: string | null;
  @Column({ type: 'boolean', default: true }) activa: boolean;
}

@Entity({ name: 'observacion_precio', schema: ESQUEMA })
export class ObservacionPrecio {
  @PrimaryGeneratedColumn() id: number;
  @Column({ type: 'int' }) publicacion_id: number;
  @Column({ type: 'int' }) precio_normal: number;
  @Column({ type: 'int', nullable: true }) precio_oferta: number | null;
  @Column({ type: 'boolean' }) disponible: boolean;
  @Column({ type: 'boolean', nullable: true }) iva_incluido: boolean | null;
  @Column({ type: 'timestamptz' }) obtenido_en: Date;
  @Column({ type: 'timestamptz' }) verificado_en: Date;
  @Column({ type: 'boolean', default: false }) parcial: boolean;
}

@Entity({ name: 'vinculo_material', schema: ESQUEMA })
export class VinculoMaterial {
  @PrimaryGeneratedColumn() id: number;
  @Column({ type: 'varchar' }) cod_material: string;
  @Column({ type: 'int' }) publicacion_id: number;
  @Column({ type: 'numeric', precision: 4, scale: 3, transformer: { to: (v) => v, from: (v) => Number(v) } })
  puntaje: number;
  @Column({ type: 'varchar', default: 'propuesto' }) estado: EstadoVinculo;
  @Column({ type: 'varchar', default: 'regla' }) definido_por: DefinidoPor;
  @Column({ type: 'timestamptz', default: () => 'now()' }) definido_en: Date;
}

@Entity({ name: 'material_cotizable', schema: ESQUEMA })
export class MaterialCotizable {
  @PrimaryColumn({ type: 'varchar' }) cod_material: string;
  @Column({ type: 'boolean' }) cotizable: boolean;
  @Column({ type: 'varchar', nullable: true }) motivo: string | null;
  @Column({ type: 'varchar' }) definido_por: DefinidoPor;
  /** URL asociada a mano; Rhona y Sodimac solo se consultan si existe. */
  @Column({ type: 'varchar', nullable: true }) url_rhona: string | null;
  @Column({ type: 'varchar', nullable: true }) url_sodimac: string | null;
}

@Entity({ name: 'falla_consulta', schema: ESQUEMA })
export class FallaConsulta {
  @PrimaryGeneratedColumn() id: number;
  @Column({ type: 'varchar' }) fuente: Fuente;
  @Column({ type: 'varchar' }) url: string;
  @Column({ type: 'timestamptz', default: () => 'now()' }) ocurrida_en: Date;
  @Column({ type: 'varchar' }) causa: CausaFalla;
}
