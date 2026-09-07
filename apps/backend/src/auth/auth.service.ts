<<<<<<< Updated upstream
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';

import { Permiso, Usuario } from '../entities/acceso.entity.js';
import { EstadoGenerico } from '../entities/tipos.js';
import type { LoginRespuestaDto, UsuarioAutenticadoDto } from './dto.js';

export interface JwtPayload {
  sub: number;
  username: string;
  perfilId: number;
=======
/**
 * Autenticacion replicando el esquema del ERP (biblioteca/php/funciones.php).
 *
 * El ERP no guarda bcrypt de la clave: guarda bcrypt del HMAC-SHA256 de la
 * clave, con el PEPPER como llave del HMAC. Ese parametro NO existe en la
 * tabla parametros, asi que el HMAC corre con llave vacia. Se replica tal cual.
 *
 * Ademas conserva el camino de migracion: si bcrypt falla, compara md5(clave)
 * contra usr_clave y, si coincide, reescribe el hash moderno y vacia usr_clave.
 */
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash, createHmac } from 'node:crypto';
import * as bcrypt from 'bcryptjs';

import {
  AccesoFuncion, AccesoPerfil, AccesoPermiso, Usuario,
} from '../entidades/acceso.entity';
import { AuditoriaService } from '../comun/auditoria.service';

export interface SesionUsuario {
  id_usuario: number;
  login: string;
  nombre: string;
  mail: string;
  id_perfil: number;
  perfil: string;
  url_inicio: string;
  permisos: string[];
>>>>>>> Stashed changes
}

@Injectable()
export class AuthService {
  constructor(
<<<<<<< Updated upstream
    @InjectRepository(Usuario)
    private readonly usuarios: Repository<Usuario>,
    @InjectRepository(Permiso)
    private readonly permisos: Repository<Permiso>,
    private readonly jwt: JwtService,
  ) {}

  /**
   * Devuelve las glosas de las funciones sobre las que el perfil tiene permiso.
   * Es lo que consulta PermisosGuard, y el equivalente del $Q_PRIVILEGIOS del
   * ERP.
   */
  async permisosDe(perfilId: number): Promise<string[]> {
    const filas = await this.permisos
      .createQueryBuilder('p')
      .innerJoin('p.funcion', 'f')
      .select('f.glosa', 'glosa')
      .where('p.perfil_id = :perfilId', { perfilId })
      .andWhere('p.estado = :activo', { activo: EstadoGenerico.ACTIVO })
      .andWhere('f.estado = :activo', { activo: EstadoGenerico.ACTIVO })
      .getRawMany<{ glosa: string }>();

    return filas.map((f) => f.glosa);
  }

  async validar(username: string, password: string): Promise<Usuario> {
    // passwordHash tiene select:false en la entidad, hay que pedirlo explícito.
    const usuario = await this.usuarios
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .leftJoinAndSelect('u.perfil', 'perfil')
      .where('u.username = :username', { username })
      .getOne();

    // Mismo mensaje para usuario inexistente y contraseña incorrecta: distinguir
    // permite enumerar usuarios válidos.
    const generico = new UnauthorizedException('Credenciales inválidas');
    if (!usuario) throw generico;
    if (usuario.estado !== EstadoGenerico.ACTIVO) throw generico;

    const ahora = new Date();
    if (usuario.vigenteDesde && usuario.vigenteDesde > ahora) throw generico;
    if (usuario.vigenteHasta && usuario.vigenteHasta < ahora) throw generico;

    const coincide = await bcrypt.compare(password, usuario.passwordHash ?? '');
    if (!coincide) throw generico;

    return usuario;
  }

  async login(username: string, password: string): Promise<LoginRespuestaDto> {
    const usuario = await this.validar(username, password);
    const permisos = await this.permisosDe(usuario.perfilId);

    const payload: JwtPayload = {
      sub: usuario.id,
      username: usuario.username,
      perfilId: usuario.perfilId,
    };

    return {
      access_token: await this.jwt.signAsync(payload),
      usuario: this.aDto(usuario, permisos),
    };
  }

  async porId(id: number): Promise<Usuario | null> {
    return this.usuarios.findOne({
      where: { id, estado: EstadoGenerico.ACTIVO },
      relations: { perfil: true },
    });
  }

  aDto(usuario: Usuario, permisos: string[]): UsuarioAutenticadoDto {
    return {
      id: usuario.id,
      username: usuario.username,
      nombre: usuario.nombre,
      email: usuario.email,
      perfil: usuario.perfil?.glosa ?? '',
      permisos,
=======
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
    @InjectRepository(AccesoPerfil) private readonly perfiles: Repository<AccesoPerfil>,
    @InjectRepository(AccesoPermiso) private readonly permisos: Repository<AccesoPermiso>,
    @InjectRepository(AccesoFuncion) private readonly funciones: Repository<AccesoFuncion>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /** HMAC-SHA256(clave, PEPPER) en hexadecimal, igual que hash_hmac de PHP. */
  private conPepper(clave: string): string {
    const pepper = this.config.get<string>('PEPPER') ?? '';
    return createHmac('sha256', pepper).update(clave).digest('hex');
  }

  /**
   * Busca al usuario tal como Q_ACCESO_VALIDA: comparacion BINARIA del nombre
   * (distingue mayusculas) y solo estado ACTIVO.
   */
  private async buscar(login: string): Promise<Usuario | null> {
    return this.usuarios
      .createQueryBuilder('u')
      .where('u.usr_user = :login', { login })   // PostgreSQL ya es sensible a mayusculas
      .andWhere("u.usr_estado = 'ACTIVO'")
      .getOne();
  }

  async validar(login: string, clave: string): Promise<SesionUsuario> {
    const u = await this.buscar(login);
    if (!u) throw new UnauthorizedException('Usuario y/o Contraseña Incorrecto');

    let ok = false;
    if (u.usr_passwd) {
      try {
        ok = await bcrypt.compare(this.conPepper(clave), u.usr_passwd);
      } catch {
        ok = false;   // hash corrupto o de otro formato
      }
    }

    // Camino de migracion del ERP: md5 legado en usr_clave.
    if (!ok && u.usr_clave) {
      const md5 = createHash('md5').update(clave).digest('hex');
      if (md5 === u.usr_clave) {
        const nuevo = await bcrypt.hash(this.conPepper(clave), 10);
        await this.usuarios.update(u.usr_id, { usr_passwd: nuevo, usr_clave: '' });
        ok = true;
      }
    }

    if (!ok) throw new UnauthorizedException('Usuario y/o Contraseña Incorrecto');

    const perfil = await this.perfiles.findOne({ where: { per_id: u.usr_perfil } });
    if (!perfil || perfil.per_estado !== 'ACTIVO') {
      throw new UnauthorizedException('El perfil del usuario no está activo');
    }

    return {
      id_usuario: u.usr_id,
      login: u.usr_user,
      nombre: u.usr_nombre,
      mail: u.usr_mail,
      id_perfil: perfil.per_id,
      perfil: perfil.per_glosa,
      url_inicio: perfil.url_inicio || 'inicio',
      permisos: await this.permisosDe(perfil.per_id),
    };
  }

  /** Glosas de las funciones que el perfil tiene activas. */
  async permisosDe(idPerfil: number): Promise<string[]> {
    const filas = await this.permisos
      .createQueryBuilder('p')
      .innerJoin(AccesoFuncion, 'f', 'f.acc_id = p.per_func')
      .select('f.acc_glosa', 'glosa')
      .where('p.per_perfil = :idPerfil', { idPerfil })
      .andWhere("p.per_estado = 'ACTIVO'")
      .andWhere("f.acc_estado = 'ACTIVO'")
      .getRawMany<{ glosa: string }>();
    return filas.map((f) => f.glosa);
  }

  async entrar(login: string, clave: string, ip: string) {
    const sesion = await this.validar(login, clave);
    await this.auditoria.anotar({
      usuario: sesion.login, tipo_accion: 'LOGIN', IP: ip,
    });
    return {
      access_token: this.jwt.sign({ sub: sesion.id_usuario, ...sesion }),
      usuario: sesion,
>>>>>>> Stashed changes
    };
  }
}
