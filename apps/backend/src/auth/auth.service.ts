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
}

@Injectable()
export class AuthService {
  constructor(
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
    };
  }
}
