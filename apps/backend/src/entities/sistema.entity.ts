/**
 * Auditoría y parámetros.
 *
 * `registro` recibe toda transacción de usuario —creación, modificación o
 * eliminación—. Es requisito contable heredado del ERP, no una conveniencia
 * de depuración.
 */
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Usuario } from './acceso.entity.js';
import { TipoAccion, numericTransformer } from './tipos.js';

@Entity('registro')
export class Registro {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  fecha: Date;

  @Column({ name: 'usuario_id', type: 'int', nullable: true })
  usuarioId: number | null;

  @ManyToOne(() => Usuario, { nullable: true })
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario | null;

  @Column({ name: 'tipo_accion', type: 'enum', enum: TipoAccion, enumName: 'tipo_accion' })
  tipoAccion: TipoAccion;

  @Column({ type: 'varchar', length: 40, nullable: true })
  tabla: string | null;

  @Column({ name: 'id_registro', type: 'int', nullable: true })
  idRegistro: number | null;

  @Column({ name: 'inf_1', type: 'varchar', length: 500, nullable: true })
  inf1: string | null;

  @Column({ name: 'inf_2', type: 'varchar', length: 200, nullable: true })
  inf2: string | null;

  @Column({ type: 'text', nullable: true })
  qstring: string | null;

  @Column({ type: 'inet', nullable: true })
  ip: string | null;
}

@Entity('parametro')
export class Parametro {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 60, unique: true })
  nombre: string;

  @Column({ type: 'numeric', precision: 16, scale: 6, transformer: numericTransformer })
  valor: number;

  @Column({ type: 'varchar', length: 250, default: '' })
  descripcion: string;
}
