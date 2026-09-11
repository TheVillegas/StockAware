/**
 * Motor de los mantenedores.
 *
 * Un solo servicio atiende los 17 tipos: la diferencia esta en el catalogo, no
 * en el codigo, igual que Mant_Tablas.php.
 *
 * Sobre inyeccion SQL: los nombres de tabla y columna salen del catalogo, que
 * es codigo nuestro, nunca del request. Lo unico que viene del usuario son los
 * VALORES, y esos van siempre como parametros ($1, $2...). El texto de busqueda
 * tambien.
 */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { Mantenedor, MANTENEDORES, buscaMantenedor } from './catalogo';
import { AuditoriaService } from '../comun/auditoria.service';

export interface PaginaMantenedor {
  codigo: string;
  titulo: string;
  columnas: string[];
  soloLectura: string[];
  pk: string;
  puedeEditar: boolean;
  datos: Record<string, unknown>[];
  total: number;
  pagina: number;
  paginas: number;
}

const cita = (ident: string) => '"' + ident.replace(/"/g, '') + '"';

@Injectable()
export class MantenedoresService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly auditoria: AuditoriaService,
  ) {}

  /** Los mantenedores que el perfil puede abrir. */
  disponibles(permisos: string[]): Array<Pick<Mantenedor, 'codigo' | 'titulo'>> {
    return MANTENEDORES.filter((m) => permisos.includes(m.codigo))
      .map((m) => ({ codigo: m.codigo, titulo: m.titulo }));
  }

  private config(codigo: string): Mantenedor {
    const m = buscaMantenedor(codigo);
    if (!m) throw new NotFoundException(`No existe el mantenedor ${codigo}`);
    return m;
  }

  async listar(
    codigo: string,
    permisos: string[],
    opciones: { pagina?: number; limite?: number; buscar?: string } = {},
  ): Promise<PaginaMantenedor> {
    const m = this.config(codigo);
    const limite = Math.min(Math.max(opciones.limite ?? 50, 1), 200);
    const pagina = Math.max(opciones.pagina ?? 1, 1);

    const condiciones: string[] = [];
    const params: unknown[] = [];
    if (m.filtro) condiciones.push(m.filtro);

    // La busqueda recorre las columnas visibles, comparando como texto.
    const texto = opciones.buscar?.trim();
    if (texto) {
      params.push(`%${texto.toLowerCase()}%`);
      const i = params.length;
      const ors = m.columnas.map((c) => `lower(coalesce(${cita(c)}::text,'')) LIKE $${i}`);
      condiciones.push(`(${ors.join(' OR ')})`);
    }
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

    const [{ n }] = await this.db.query(
      `SELECT COUNT(*)::int AS n FROM ${cita(m.lee)} ${where}`, params,
    );

    const cols = m.columnas.map(cita).join(', ');
    const datos = await this.db.query(
      `SELECT ${cols} FROM ${cita(m.lee)} ${where} ORDER BY ${m.orden} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limite, (pagina - 1) * limite],
    );

    return {
      codigo: m.codigo,
      titulo: m.titulo,
      columnas: m.columnas,
      soloLectura: m.soloLectura ?? [],
      pk: m.pk,
      puedeEditar: !m.permisoEscritura || permisos.includes(m.permisoEscritura),
      datos,
      total: n,
      pagina,
      paginas: Math.max(Math.ceil(n / limite), 1),
    };
  }

  /** Una fila completa desde la tabla base, que es lo que se edita. */
  async obtener(codigo: string, id: string): Promise<Record<string, unknown>> {
    const m = this.config(codigo);
    const filas = await this.db.query(
      `SELECT * FROM ${cita(m.escribe)} WHERE ${cita(m.pk)}::text = $1`, [id],
    );
    if (!filas.length) throw new NotFoundException(`No existe el registro ${id}`);
    return filas[0];
  }

  async actualizar(
    codigo: string,
    id: string,
    cambios: Record<string, unknown>,
    ctx: { usuario: string; ip: string },
  ): Promise<Record<string, unknown>> {
    const m = this.config(codigo);

    // Solo columnas que existen en la tabla base y no son derivadas ni la pk.
    const reales: string[] = (
      await this.db.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema='public' AND table_name=$1`, [m.escribe],
      )
    ).map((r: { column_name: string }) => r.column_name);

    const derivadas = new Set(m.soloLectura ?? []);
    const campos = Object.keys(cambios).filter(
      (c) => reales.includes(c) && !derivadas.has(c) && c !== m.pk,
    );
    if (!campos.length) {
      throw new BadRequestException('No hay ningún campo modificable en la solicitud');
    }

    const sets = campos.map((c, i) => `${cita(c)} = $${i + 1}`);
    const valores = campos.map((c) => cambios[c]);
    await this.db.query(
      `UPDATE ${cita(m.escribe)} SET ${sets.join(', ')} WHERE ${cita(m.pk)}::text = $${campos.length + 1}`,
      [...valores, id],
    );

    await this.auditoria.anotar({
      usuario: ctx.usuario,
      tipo_accion: 'MOD_REG',   // valor del enum registro.tipo_accion, igual que DLL.php
      tabla_accion: m.escribe,
      id_registro: Number.isFinite(Number(id)) ? Number(id) : 0,
      inf_1: m.codigo,
      inf_2: campos.join(','),
      IP: ctx.ip,
    });

    return this.obtener(codigo, id);
  }
}
