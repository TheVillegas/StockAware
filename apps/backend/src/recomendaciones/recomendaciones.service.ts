/**
 * Recomendaciones de reposicion (BE-01).
 *
 * `base` reproduce la regla actual del frontend (S7). `adaptativo` pide el puntaje a FastAPI y, si el
 * salto falla (sin respuesta, error o formato invalido), degrada a la regla base con `degradado: true`
 * y 200 (S4), igual que consulta.service.ts con los precios desactualizados. Cada item devuelto se
 * guarda en recomendaciones.recomendacion; su id (`rec_<n>`) es el que despues recibe la decision.
 */
import { HttpException, Injectable, Logger, NotFoundException } from '@nestjs/common';

import { IntelligenceService } from '../inteligencia/inteligencia.service';
import { EntradaRanking } from '../inteligencia/recomendaciones.dto';
import { cantidadSugerida, estadoStock, ordenaPorRiesgo } from './regla-base';
import { Decision, Modo } from './recomendaciones.dto';
import {
  FilaRecomendacion, MaterialBodega, PrecioExterno, RecomendacionesRepositorio,
} from './recomendaciones.repositorio';

export interface ItemRecomendacion {
  id: string;
  codMaterial: string;
  puntaje: number | null;
  posicion: number;
  posicionBase: number;
  cantidadSugerida: number;
  razones: Array<{ factor: string; valor: number; peso: number; texto: string }>;
  factoresFaltantes: string[];
}

export interface RespuestaRecomendaciones {
  modo: Modo;
  generadoEn: string;
  degradado: boolean;
  items: ItemRecomendacion[];
}

const ID_RECOMENDACION = /^rec_([1-9]\d*)$/;
/** recomendacion.id es integer. */
const ID_MAXIMO = 2_147_483_647;

const TEXTO_ESTADO = { crit: 'Sin stock', warn: 'Stock bajo el mínimo', ok: 'Stock sobre el mínimo' };

@Injectable()
export class RecomendacionesService {
  private readonly log = new Logger(RecomendacionesService.name);

  /** Reloj inyectable para las pruebas. */
  ahora = () => new Date();

  constructor(
    private readonly repo: RecomendacionesRepositorio,
    private readonly inteligencia: IntelligenceService,
  ) {}

  async listar(q: { bodega: number; modo?: Modo }, idUsuario: number): Promise<RespuestaRecomendaciones> {
    const modo: Modo = q.modo ?? 'adaptativo';
    const generadoEn = this.ahora();
    const materiales = await this.repo.materiales(q.bodega);
    if (!materiales.length) return { modo, generadoEn: generadoEn.toISOString(), degradado: false, items: [] };

    const orden = ordenaPorRiesgo(materiales);
    let degradado = false;
    let filas: FilaRecomendacion[] | null = null;
    if (modo === 'adaptativo') {
      try {
        filas = await this.adaptativo(materiales, orden, generadoEn);
      } catch (e) {
        if (!(e instanceof HttpException)) throw e;
        degradado = true;
        this.log.warn(`Salto a FastAPI fallo, se usa la regla base: ${(e.getResponse() as { error?: string }).error ?? 'intelligence_error'}`);
      }
    }
    filas ??= orden.map((m, i) => this.filaBase(m, i + 1));

    const guardadas = await this.repo.guardaLote({ idBodega: q.bodega, modo, degradado, generadoEn, idUsuario }, filas);
    const idDe = new Map(guardadas.map((g) => [g.posicion, g.id]));
    return {
      modo,
      generadoEn: generadoEn.toISOString(),
      degradado,
      items: filas.map((f) => ({
        id: `rec_${idDe.get(f.posicion)}`,
        codMaterial: f.codMaterial,
        puntaje: f.puntaje,
        posicion: f.posicion,
        posicionBase: f.posicionBase,
        cantidadSugerida: f.cantidadSugerida,
        razones: f.razones,
        factoresFaltantes: f.factoresFaltantes,
      })),
    };
  }

  /** Decision de la persona sobre una recomendacion; guarda su id de usuario y copia material, puntaje y modo. */
  async decidir(
    id: string,
    dto: { decision: Decision; cantidad?: number | null; motivo?: string | null },
    idUsuario: number,
  ): Promise<{ id: string }> {
    const n = ID_RECOMENDACION.exec(id)?.[1];
    const recomendacionId = n === undefined ? NaN : Number(n);
    if (!Number.isSafeInteger(recomendacionId) || recomendacionId > ID_MAXIMO) throw this.noExiste();
    const rec = await this.repo.recomendacion(recomendacionId);
    if (!rec) throw this.noExiste();
    const { id: decisionId } = await this.repo.guardaDecision({
      recomendacionId,
      idUsuario,
      codMaterial: rec.cod_material,
      decision: dto.decision,
      cantidad: dto.cantidad ?? null,
      motivo: dto.motivo ?? null,
      puntaje: rec.puntaje,
      modo: rec.modo,
    });
    return { id: `dec_${decisionId}` };
  }

  private noExiste() {
    return new NotFoundException({ error: 'recommendation_not_found' });
  }

  /** Orden de FastAPI; posicionBase es el lugar del material en el orden de la regla base. */
  private async adaptativo(materiales: MaterialBodega[], orden: MaterialBodega[], referencia: Date): Promise<FilaRecomendacion[]> {
    const externos = new Map<string, PrecioExterno>(
      (await this.repo.mejoresPreciosExternos(materiales.map((m) => m.cod_material))).map((p) => [p.cod_material, p]),
    );
    const items: EntradaRanking[] = materiales.map((m) => {
      const externo = externos.get(m.cod_material);
      return {
        cod_material: m.cod_material,
        stock: m.stock,
        stock_minimo: m.stock_minimo,
        consumo_diario: m.consumo_diario,
        consumo_reciente: m.consumo_reciente,
        ultimo_precio: m.ultimo_precio,
        precio_externo: externo?.precio ?? null,
        precio_externo_obtenido_en: externo?.verificado_en.toISOString() ?? null,
      };
    });
    const ranking = await this.inteligencia.ranking(referencia, items);
    const posicionBase = new Map(orden.map((m, i) => [m.cod_material, i + 1]));
    return ranking.map((r, i) => ({
      codMaterial: r.cod_material,
      puntaje: r.puntaje,
      posicion: i + 1,
      posicionBase: posicionBase.get(r.cod_material) as number,
      cantidadSugerida: r.cantidad_sugerida,
      razones: r.razones.map(({ factor, valor, peso, texto }) => ({ factor, valor, peso, texto })),
      factoresFaltantes: r.factores_faltantes,
    }));
  }

  private filaBase(m: MaterialBodega, posicion: number): FilaRecomendacion {
    return {
      codMaterial: m.cod_material,
      puntaje: null,
      posicion,
      posicionBase: posicion,
      cantidadSugerida: cantidadSugerida(m.stock, m.stock_minimo, m.consumo_diario),
      razones: [{ factor: 'estado_stock', valor: m.stock ?? 0, peso: 1, texto: TEXTO_ESTADO[estadoStock(m.stock, m.stock_minimo)] }],
      factoresFaltantes: [],
    };
  }
}
