/**
 * Control de acceso: modelo perfil × función del ERP.
 *
 * Las funciones forman un árbol (MENU → OPCION → FUNCION) y un perfil recibe
 * permisos sobre ellas. Es más expresivo que un rol plano y permite crecer sin
 * rehacerlo.
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
import { EstadoGenerico, TipoFuncion } from './tipos.js';

@Entity('perfil')
export class Perfil {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 40, unique: true })
  glosa: string;

  @Column({ name: 'url_inicio', type: 'varchar', length: 120, nullable: true })
  urlInicio: string | null;

  @Column({ type: 'enum', enum: EstadoGenerico, enumName: 'estado_generico', default: EstadoGenerico.ACTIVO })
  estado: EstadoGenerico;

  @OneToMany(() => Permiso, (p) => p.perfil)
  permisos: Permiso[];
}

@Entity('funcion')
export class Funcion {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'enum', enum: TipoFuncion, enumName: 'tipo_funcion' })
  tipo: TipoFuncion;

  @Column({ type: 'varchar', length: 40 })
  glosa: string;

  @Column({ name: 'padre_id', type: 'int', nullable: true })
  padreId: number | null;

  @ManyToOne(() => Funcion, { nullable: true })
  @JoinColumn({ name: 'padre_id' })
  padre: Funcion | null;

  @Column({ type: 'text', nullable: true })
  descripcion: string | null;

  @Column({ type: 'enum', enum: EstadoGenerico, enumName: 'estado_generico', default: EstadoGenerico.ACTIVO })
  estado: EstadoGenerico;
}

@Entity('permiso')
@Index(['perfilId', 'funcionId'], { unique: true })
export class Permiso {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'perfil_id', type: 'int' })
  perfilId: number;

  @ManyToOne(() => Perfil, (p) => p.permisos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'perfil_id' })
  perfil: Perfil;

  @Column({ name: 'funcion_id', type: 'int' })
  funcionId: number;

  @ManyToOne(() => Funcion, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'funcion_id' })
  funcion: Funcion;

  @Column({ type: 'enum', enum: EstadoGenerico, enumName: 'estado_generico', default: EstadoGenerico.ACTIVO })
  estado: EstadoGenerico;

  @Column({ type: 'date', default: () => 'CURRENT_DATE' })
  fecha: string;
}

@Entity('usuario')
export class Usuario {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 12, nullable: true })
  rut: string | null;

  @Column({ type: 'varchar', length: 80 })
  nombre: string;

  @Column({ type: 'varchar', length: 120 })
  email: string;

  @Column({ type: 'varchar', length: 30, unique: true })
  username: string;

  /** Nunca se serializa hacia el cliente: se excluye en el servicio de auth. */
  @Column({ name: 'password_hash', type: 'varchar', length: 255, select: false })
  passwordHash: string;

  @Column({ type: 'enum', enum: EstadoGenerico, enumName: 'estado_generico', default: EstadoGenerico.ACTIVO })
  estado: EstadoGenerico;

  @Column({ name: 'perfil_id', type: 'int' })
  perfilId: number;

  @ManyToOne(() => Perfil)
  @JoinColumn({ name: 'perfil_id' })
  perfil: Perfil;

  @Column({ name: 'vigente_desde', type: 'timestamptz', nullable: true })
  vigenteDesde: Date | null;

  @Column({ name: 'vigente_hasta', type: 'timestamptz', nullable: true })
  vigenteHasta: Date | null;
}
