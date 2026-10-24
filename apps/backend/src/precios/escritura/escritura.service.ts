/**
 * Acciones de una persona sobre los precios de mercado (#47): confirmar o rechazar un
 * vinculo, asociar la URL de Rhona o Sodimac y corregir la marca `cotizable`.
 * Cada cambio deja una fila en `registro`, como las demas escrituras del ERP.
 */
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

import { AuditoriaService } from '../../comun/auditoria.service';
import { ConsultaRepositorio } from '../consulta/consulta.repositorio';
import { urlDeFuente, urlEsListado } from '../fuentes/fuentes';
import { CacheRobots } from '../fuentes/robots';
import { PreciosRepositorio } from '../precios.repositorio';
import { CambiaVinculoDto, CotizableDto, FuenteUrlDto } from './escritura.dto';

export interface Ctx { usuario: string; ip: string; }

const ID_MAXIMO = 2_147_483_647;

const rechaza = (error: string, estado: HttpStatus, detalle?: string) =>
  new HttpException(detalle ? { error, detalle } : { error }, estado);

@Injectable()
export class EscrituraPreciosService {
  // Campo y no parametro del constructor, como en RecuperadorFuentes: Nest lo crea sin
  // configuracion y las pruebas lo reemplazan. Comparte el patron de 24 h, no la instancia.
  robots = new CacheRobots();

  constructor(
    private readonly precios: PreciosRepositorio,
    private readonly erp: ConsultaRepositorio,
    private readonly auditoria: AuditoriaService,
  ) {}

  async cambiaVinculo(id: number, dto: CambiaVinculoDto, ctx: Ctx) {
    const vinculo = id > 0 && id <= ID_MAXIMO ? await this.precios.cambiaEstadoVinculo(id, dto.estado) : null;
    if (!vinculo) throw rechaza('vinculo_not_found', HttpStatus.NOT_FOUND);
    await this.anota(ctx, 'vinculo_material', id, 'PRECIOS_VINCULO', `${vinculo.cod_material}: ${vinculo.estado}`);
    return vinculo;
  }

  async asociaUrl(codMaterial: string, dto: FuenteUrlDto, ctx: Ctx) {
    await this.existe(codMaterial);
    const url = this.validaUrl(dto);
    if (!(await this.robots.permite(url))) {
      throw rechaza('url_blocked_by_robots', HttpStatus.UNPROCESSABLE_ENTITY, 'robots.txt de la fuente no permite la URL o no se pudo leer');
    }
    const { url_anterior } = await this.precios.guardaUrlFuente(codMaterial, dto.fuente, url);
    await this.anota(ctx, 'material_cotizable', 0, 'PRECIOS_URL', `${codMaterial} ${dto.fuente}: ${url}`);
    return { cod_material: codMaterial, fuente: dto.fuente, url, url_anterior };
  }

  async defineCotizable(codMaterial: string, dto: CotizableDto, ctx: Ctx) {
    await this.existe(codMaterial);
    const marca = await this.precios.defineCotizable(codMaterial, dto.cotizable, dto.motivo?.trim() || null);
    await this.anota(ctx, 'material_cotizable', 0, 'PRECIOS_COTIZABLE', `${codMaterial}: ${dto.cotizable}`);
    return marca;
  }

  private async existe(codMaterial: string): Promise<void> {
    if (!(await this.erp.material(codMaterial))) throw rechaza('material_not_found', HttpStatus.NOT_FOUND);
  }

  /** Orden: formato https, dominio de la fuente y que sea un listado. robots.txt va despues. */
  private validaUrl({ fuente, url }: FuenteUrlDto): string {
    const limpia = url.trim();
    let u: URL;
    try {
      u = new URL(limpia);
    } catch {
      throw rechaza('url_invalid', HttpStatus.UNPROCESSABLE_ENTITY);
    }
    if (u.protocol !== 'https:') throw rechaza('url_invalid', HttpStatus.UNPROCESSABLE_ENTITY, 'Debe ser https');
    if (!urlDeFuente(fuente, limpia)) throw rechaza('url_domain_mismatch', HttpStatus.UNPROCESSABLE_ENTITY);
    if (!urlEsListado(fuente, limpia)) {
      throw rechaza('url_not_listing', HttpStatus.UNPROCESSABLE_ENTITY, 'Solo se aceptan URL de listados de categoria, no de producto');
    }
    return limpia;
  }

  private anota(ctx: Ctx, tabla: string, id: number, accion: string, detalle: string) {
    return this.auditoria.anotar({
      usuario: ctx.usuario, tipo_accion: 'MOD_REG', tabla_accion: tabla, id_registro: id,
      inf_1: accion, inf_2: detalle.slice(0, 200), IP: ctx.ip,
    });
  }
}
