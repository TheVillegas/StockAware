/**
 * Consulta de precios de mercado de un material (ADR 0002).
 *
 * NestJS recupera y persiste; FastAPI procesa. Un precio guardado y vigente (1 semana por
 * fuente) se responde desde la base sin tocar red ni FastAPI. Si vencio, se consulta solo
 * esa fuente. Nunca se inventa un precio: ante una falla se devuelve lo guardado marcado
 * desactualizado, o 502 si no hay nada guardado.
 */
import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';

import { IntelligenceService } from '../../inteligencia/inteligencia.service';
import { CONFIG_FUENTES, FUENTES, Fuente } from '../fuentes/fuentes';
import { RecuperadorFuentes } from '../fuentes/recuperador';
import { PreciosRepositorio } from '../precios.repositorio';
import { ConsultaRepositorio } from './consulta.repositorio';

const VIGENCIA_MS: Record<Fuente, number> = Object.fromEntries(FUENTES.map((f) => [f, 7 * 24 * 3600 * 1000])) as Record<Fuente, number>;
const IVA_INCLUIDO: Partial<Record<Fuente, boolean>> = { dartel: true, dimeiggs: true };

export type MotivoFalla = 'timeout' | 'http_error' | 'invalid_content' | 'cooldown';

interface Fila {
  publicacion_id: number; fuente: Fuente; nombre: string; url: string; estado: string; puntaje: number;
  precio_normal: number; precio_oferta: number | null; disponible: boolean;
  obtenido_en: Date; verificado_en: Date; parcial?: boolean;
}

export interface FuenteRespuesta {
  fuente: Fuente;
  estado: 'ok' | 'sin_resultados' | 'desactualizada' | 'sin_datos';
  motivo?: MotivoFalla;
  parcial?: boolean;
  desactualizado?: boolean;
  obtenido_en?: Date;
  publicaciones: Array<Omit<Fila, 'fuente' | 'parcial' | 'estado'> & { vinculo: string }>;
}

export interface RespuestaPrecios {
  cod_material: string;
  nombre: string;
  cotizable: boolean;
  motivo?: string;
  desactualizado?: boolean;
  fuentes: FuenteRespuesta[];
}

interface Actualizacion {
  noCotizable?: string;
  fallas: Map<Fuente, MotivoFalla>;
  parciales: Set<Fuente>;
  /** intelligence_unreachable | intelligence_error cuando el salto a FastAPI fallo. */
  errorHop?: string;
}

@Injectable()
export class ConsultaPreciosService {
  private readonly log = new Logger(ConsultaPreciosService.name);
  /** Busquedas vigentes que no devolvieron nada: la base no guarda "sin resultados", asi no se repite la consulta. */
  private readonly vacias = new Map<string, number>();
  ahora = () => new Date();

  constructor(
    private readonly precios: PreciosRepositorio,
    private readonly erp: ConsultaRepositorio,
    private readonly inteligencia: IntelligenceService,
    private readonly recuperador: RecuperadorFuentes,
  ) {}

  async consulta(codMaterial: string): Promise<RespuestaPrecios> {
    const material = await this.erp.material(codMaterial);
    if (!material) throw new HttpException({ error: 'material_not_found' }, HttpStatus.NOT_FOUND);
    const marca = await this.erp.cotizable(codMaterial);
    const base = { cod_material: codMaterial, nombre: material.nombre };
    // Lo que fijo una persona manda sobre la regla de FastAPI.
    if (marca?.definido_por === 'usuario' && !marca.cotizable) {
      return { ...base, cotizable: false, motivo: marca.motivo ?? 'definido_por_usuario', fuentes: [] };
    }
    const urls: Partial<Record<Fuente, string>> = { rhona: marca?.url_rhona, sodimac: marca?.url_sodimac };
    const elegibles = FUENTES.filter((f) => !CONFIG_FUENTES[f].requiereUrl || urls[f]);
    const ahora = this.ahora();
    let filas = await this.filas(codMaterial);
    const vencidas = elegibles.filter((f) => !this.vigente(f, codMaterial, urls[f], filas, ahora));

    const act: Actualizacion = { fallas: new Map(), parciales: new Set() };
    if (vencidas.length) {
      await this.actualiza(codMaterial, material.nombre, vencidas, urls, marca?.definido_por === 'usuario', ahora, act);
      if (act.noCotizable) return { ...base, cotizable: false, motivo: act.noCotizable, fuentes: [] };
      filas = await this.filas(codMaterial);
    }

    const fuentes = FUENTES.map((f) => this.respuestaFuente(f, elegibles.includes(f), filas, act, codMaterial, urls[f], ahora));
    const conDatos = fuentes.some((f) => f.estado !== 'sin_datos');
    if (!conDatos && act.fallas.size) {
      throw new HttpException({ error: act.errorHop ?? 'sources_unavailable' }, HttpStatus.BAD_GATEWAY);
    }
    return { ...base, cotizable: true, desactualizado: fuentes.some((f) => f.desactualizado), fuentes };
  }

  private async filas(codMaterial: string): Promise<Fila[]> {
    return (await this.precios.ultimasObservaciones(codMaterial)) as unknown as Fila[];
  }

  private vigente(fuente: Fuente, cod: string, url: string | undefined, filas: Fila[], ahora: Date): boolean {
    const verificaciones = filas.filter((r) => r.fuente === fuente).map((r) => new Date(r.verificado_en).getTime());
    const desde = verificaciones.length ? Math.max(...verificaciones) : this.vacias.get(this.clave(fuente, cod, url));
    return desde !== undefined && ahora.getTime() - desde < VIGENCIA_MS[fuente];
  }

  private clave = (fuente: Fuente, cod: string, url?: string) => `${fuente}|${cod}|${url ?? ''}`;

  /** Consulta las fuentes vencidas, llama a FastAPI y persiste. No lanza por fallas de fuente. */
  private async actualiza(
    cod: string, nombre: string, vencidas: Fuente[], urls: Partial<Record<Fuente, string>>,
    ordenUsuario: boolean, ahora: Date, act: Actualizacion,
  ): Promise<void> {
    const aConsultar: Fuente[] = [];
    for (const f of vencidas) {
      if (await this.precios.enPausa(f, ahora)) act.fallas.set(f, 'cooldown');
      else aConsultar.push(f);
    }
    if (!aConsultar.length) return;

    let prep;
    try {
      prep = await this.inteligencia.preparar(cod, nombre);
    } catch (e) {
      return this.falloHop(e, aConsultar, act);
    }
    if (!prep.termino_busqueda) return void (act.noCotizable = 'sin_termino');
    if (!prep.cotizable && !ordenUsuario) return void (act.noCotizable = prep.motivo ?? 'sin_termino');

    const lecturas = await Promise.all(aConsultar.map((f) => this.recuperador.lee(f, prep.termino_busqueda, urls[f])));
    const leidas = [];
    for (const l of lecturas) {
      if (l.estado === 'falla') {
        act.fallas.set(l.fuente, l.causa);
        await this.precios.registraFalla(l.fuente, l.url, l.causa, ahora);
      } else {
        leidas.push(l);
      }
    }
    if (!leidas.length) return;

    let resultados;
    try {
      const contenido = leidas.map((l) => ({ fuente: l.fuente, tipo: l.tipo, contenido: l.contenido }));
      resultados = await this.inteligencia.procesar({ cod_material: cod, nombre, termino_busqueda: prep.termino_busqueda }, contenido, ahora);
    } catch (e) {
      return this.falloHop(e, leidas.map((l) => l.fuente), act);
    }
    for (const r of resultados) {
      const lectura = leidas.find((l) => l.fuente === r.fuente);
      if (r.estado === 'invalid_content') {
        act.fallas.set(r.fuente, 'invalid_content');
        await this.precios.registraFalla(r.fuente, lectura.url, 'invalid_content', ahora);
        continue;
      }
      for (const c of r.candidatos) {
        const { publicacionId } = await this.precios.guardaObservacion(
          { fuente: r.fuente, id_externo: c.id_externo, url: c.url, nombre: c.nombre, marca: c.marca, ean: c.ean, categoria_fuente: c.categoria_fuente },
          { precio_normal: c.precio_normal, precio_oferta: c.precio_oferta, disponible: c.disponible, iva_incluido: IVA_INCLUIDO[r.fuente] ?? null, parcial: lectura.parcial },
          ahora,
        );
        await this.precios.proponeVinculo(cod, publicacionId, c.puntaje);
      }
      if (lectura.parcial) act.parciales.add(r.fuente);
      else await this.erp.desactivaNoDevueltas(r.fuente, cod, r.candidatos.map((c) => c.id_externo));
      if (!r.candidatos.length) this.vacias.set(this.clave(r.fuente, cod, urls[r.fuente]), ahora.getTime());
      this.log.log(`${r.fuente}: ${r.estado}, ${r.candidatos.length} candidatos, ${r.invalidos} descartados`);
    }
  }

  /** FastAPI no respondio: no es culpa de la fuente, asi que no hay falla_consulta ni pausa. */
  private falloHop(e: unknown, fuentes: Fuente[], act: Actualizacion): void {
    if (!(e instanceof HttpException)) throw e;
    act.errorHop = (e.getResponse() as { error?: string }).error ?? 'intelligence_error';
    for (const f of fuentes) act.fallas.set(f, act.errorHop === 'intelligence_unreachable' ? 'timeout' : 'invalid_content');
    this.log.warn(`Salto a FastAPI fallo: ${act.errorHop}`);
  }

  private respuestaFuente(
    fuente: Fuente, elegible: boolean, filas: Fila[], act: Actualizacion, cod: string, url: string | undefined, ahora: Date,
  ): FuenteRespuesta {
    const propias = filas.filter((r) => r.fuente === fuente);
    const falla = act.fallas.get(fuente);
    if (!elegible) return { fuente, estado: 'sin_datos', publicaciones: [] };
    if (!propias.length) {
      if (falla) return { fuente, estado: 'sin_datos', motivo: falla, publicaciones: [] };
      return { fuente, estado: this.vigente(fuente, cod, url, filas, ahora) ? 'sin_resultados' : 'sin_datos', publicaciones: [] };
    }
    const publicaciones = propias
      .map(({ fuente: _f, parcial: _p, estado, ...resto }) => ({ ...resto, vinculo: estado }))
      .sort((a, b) => b.puntaje - a.puntaje);
    const obtenido_en = new Date(Math.max(...propias.map((r) => new Date(r.obtenido_en).getTime())));
    const parcial = act.parciales.has(fuente) || propias.some((r) => r.parcial) || undefined;
    if (falla) return { fuente, estado: 'desactualizada', motivo: falla, desactualizado: true, obtenido_en, parcial, publicaciones };
    return { fuente, estado: 'ok', parcial, obtenido_en, publicaciones };
  }
}
