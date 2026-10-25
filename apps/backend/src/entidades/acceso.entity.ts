/**
 * Tablas de acceso del ERP, calcadas columna por columna.
 *
 * No se agregan campos ni se renombra nada: los nombres son los de la base
 * original, incluido el prefijo per_ que en acceso_perfiles significa "perfil"
 * y en acceso_permisos significa "permiso". Es confuso, pero es lo que hay.
 */
import { Column, Entity, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';

@Entity('usuarios')
export class Usuario {
  @PrimaryGeneratedColumn({ name: 'usr_id' }) usr_id: number;
  @Column({ name: 'usr_rut' }) usr_rut: string;
  @Column({ name: 'usr_nombre' }) usr_nombre: string;
  @Column({ name: 'usr_direccion' }) usr_direccion: string;
  @Column({ name: 'usr_comuna' }) usr_comuna: number;
  @Column({ name: 'usr_ciudad' }) usr_ciudad: string;
  @Column({ name: 'usr_fono' }) usr_fono: string;
  @Column({ name: 'usr_mail' }) usr_mail: string;
  @Column({ name: 'usr_estado' }) usr_estado: string;
  @Column({ name: 'usr_area' }) usr_area: number;
  @Column({ name: 'usr_user' }) usr_user: string;
  /** Legado: md5 de la clave. Se vacia al migrar al hash moderno. */
  @Column({ name: 'usr_clave' }) usr_clave: string;
  /** bcrypt sobre el HMAC-SHA256 de la clave. */
  @Column({ name: 'usr_passwd' }) usr_passwd: string;
  @Column({ name: 'usr_fini', type: 'date', nullable: true }) usr_fini: string;
  @Column({ name: 'usr_ffin', type: 'date', nullable: true }) usr_ffin: string;
  @Column({ name: 'usr_tipo' }) usr_tipo: string;
  @Column({ name: 'usr_perfil' }) usr_perfil: number;
}

@Entity('acceso_perfiles')
export class AccesoPerfil {
  @PrimaryGeneratedColumn({ name: 'per_id' }) per_id: number;
  @Column({ name: 'per_glosa' }) per_glosa: string;
  @Column({ name: 'url_inicio' }) url_inicio: string;
  @Column({ name: 'per_fini', type: 'date', nullable: true }) per_fini: string;
  @Column({ name: 'per_ffin', type: 'date', nullable: true }) per_ffin: string;
  @Column({ name: 'per_estado' }) per_estado: string;
}

@Entity('acceso_funciones')
export class AccesoFuncion {
  @PrimaryGeneratedColumn({ name: 'acc_id' }) acc_id: number;
  /** MENU | OPCION | FUNCION | OTRO */
  @Column({ name: 'acc_tipo' }) acc_tipo: string;
  /** El codigo que despacha main.php, p.ej. EMITE_OC. */
  @Column({ name: 'acc_glosa' }) acc_glosa: string;
  @Column({ name: 'acc_padre' }) acc_padre: number;
  @Column({ name: 'acc_fini', type: 'date', nullable: true }) acc_fini: string;
  @Column({ name: 'acc_ffin', type: 'date', nullable: true }) acc_ffin: string;
  @Column({ name: 'acc_estado' }) acc_estado: string;
  @Column({ name: 'acc_descripcion' }) acc_descripcion: string;
}

@Entity('acceso_permisos')
export class AccesoPermiso {
  @PrimaryGeneratedColumn({ name: 'per_id' }) per_id: number;
  @Column({ name: 'per_perfil' }) per_perfil: number;
  @Column({ name: 'per_func' }) per_func: number;
  @Column({ name: 'per_estado' }) per_estado: string;
  @Column({ name: 'per_fecha', type: 'date', nullable: true }) per_fecha: string;
}

@Entity('registro')
export class Registro {
  @PrimaryGeneratedColumn({ name: 'id' }) id: number;
  @Column({ name: 'fecha', type: 'timestamp' }) fecha: Date;
  @Column({ name: 'usuario' }) usuario: string;
  @Column({ name: 'tipo_accion' }) tipo_accion: string;
  @Column({ name: 'tabla_accion' }) tabla_accion: string;
  @Column({ name: 'id_registro' }) id_registro: number;
  @Column({ name: 'inf_1' }) inf_1: string;
  @Column({ name: 'inf_2' }) inf_2: string;
  @Column({ name: 'qstring' }) qstring: string;
  @Column({ name: 'IP' }) IP: string;
}

@Entity('parametros')
export class Parametro {
  @PrimaryColumn({ name: 'id' }) id: number;
  @Column({ name: 'nombre' }) nombre: string;
  @Column({ name: 'valor' }) valor: string;
  @Column({ name: 'descripcion' }) descripcion: string;
}
