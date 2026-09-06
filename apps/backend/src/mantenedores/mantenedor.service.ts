/**
 * Base compartida por los mantenedores.
 *
 * El ERP resuelve todos sus mantenedores con un switch por tipo dentro de
 * Mant_Tablas.php, que decide tabla, vista, orden y filtro. Aquí ese switch se
 * reemplaza por una clase base que cada mantenedor parametriza: mismo patrón,
 * pero tipado y documentable en Swagger.
 *
 * Toda escritura queda anotada en `registro`.
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  DeepPartial,
  ObjectLiteral,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';

import { AuditoriaService, type ContextoAuditoria } from '../common/auditoria.js';
import { TipoAccion } from '../entities/tipos.js';
import {
  paginar,
  type PaginacionDto,
  type RespuestaPaginada,
} from '../common/paginacion.js';

@Injectable()
export abstract class MantenedorService<T extends ObjectLiteral> {
  /** Nombre con que la tabla aparece en la bitácora. */
  protected abstract readonly tabla: string;

  /** Columnas sobre las que actúa el filtro de texto libre. */
  protected abstract readonly camposBusqueda: string[];

  /** Orden por defecto del listado. */
  protected abstract readonly ordenPorDefecto: string;

  constructor(
    protected readonly repo: Repository<T>,
    protected readonly auditoria: AuditoriaService,
  ) {}

  /** Punto de extensión para que un mantenedor agregue joins o filtros. */
  protected prepararConsulta(qb: SelectQueryBuilder<T>): SelectQueryBuilder<T> {
    return qb;
  }

  /** Texto que identifica la fila en la bitácora. */
  protected abstract etiqueta(fila: T): string;

  async listar(q: PaginacionDto): Promise<RespuestaPaginada<T>> {
    const qb = this.prepararConsulta(this.repo.createQueryBuilder('e'));

    if (q.buscar && this.camposBusqueda.length > 0) {
      const condicion = this.camposBusqueda
        .map((c) => `CAST(${c} AS TEXT) ILIKE :buscar`)
        .join(' OR ');
      qb.andWhere(`(${condicion})`, { buscar: `%${q.buscar}%` });
    }

    const [datos, total] = await qb
      .orderBy(this.ordenPorDefecto, 'ASC')
      .skip((q.pagina - 1) * q.limite)
      .take(q.limite)
      .getManyAndCount();

    return paginar(datos, total, q);
  }

  async obtener(id: number): Promise<T> {
    const fila = await this.repo
      .createQueryBuilder('e')
      .where('e.id = :id', { id })
      .getOne();

    if (!fila) {
      throw new NotFoundException(`No existe ${this.tabla} con id ${id}`);
    }
    return fila;
  }

  async crear(datos: DeepPartial<T>, ctx: ContextoAuditoria): Promise<T> {
    const fila = await this.repo.save(this.repo.create(datos));
    await this.auditoria.anotar(
      TipoAccion.INS_REG,
      this.tabla,
      fila.id as number,
      ctx,
      this.etiqueta(fila),
    );
    return fila;
  }

  /**
   * Los DTO de actualización declaran sus campos como opcionales, y
   * class-transformer construye la instancia con TODAS las propiedades
   * declaradas: las que el cliente no envió quedan presentes con valor
   * `undefined`. Si eso se mezcla con la fila existente, pisa los campos que no
   * se querían tocar.
   *
   * TypeORM ignora `undefined` al generar el UPDATE, así que la base nunca
   * corrió peligro, pero el objeto en memoria quedaba incompleto y con él la
   * respuesta HTTP y la etiqueta de la bitácora.
   */
  private soloDefinidos(datos: DeepPartial<T>): DeepPartial<T> {
    return Object.fromEntries(
      Object.entries(datos as Record<string, unknown>).filter(
        ([, v]) => v !== undefined,
      ),
    ) as DeepPartial<T>;
  }

  async actualizar(
    id: number,
    datos: DeepPartial<T>,
    ctx: ContextoAuditoria,
  ): Promise<T> {
    const previo = await this.obtener(id);
    const cambios = this.soloDefinidos(datos);

    await this.repo.save({ ...previo, ...cambios } as DeepPartial<T>);

    // Se relee en vez de confiar en lo que devuelve save(): así la respuesta
    // trae los valores tal como quedaron en la base, con defaults y todo.
    const fila = await this.obtener(id);

    await this.auditoria.anotar(
      TipoAccion.MOD_REG,
      this.tabla,
      id,
      ctx,
      this.etiqueta(fila),
      `antes: ${this.etiqueta(previo)}`,
    );
    return fila;
  }
}
