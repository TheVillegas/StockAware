/**
 * Cliente HTTP real del hop Nest → FastAPI.
 *
 * No hay stub: si intelligence-service no responde, el ERP falla de forma
 * controlada (502) en vez de inventar un eco. El timeout corto evita que un
 * FastAPI colgado deje colgada la replica.
 */
import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { idCorrelacion } from '../comun/correlacion';
import { Fuente } from '../precios/fuentes/fuentes';
import {
  ErrorFormato, PreparacionDto, ResultadoFuente, validaPreparacion, validaProcesamiento,
} from './precios.dto';
import { EntradaRanking, ItemRankingDto, validaRanking } from './recomendaciones.dto';

const TIMEOUT_MS = 3_000;
const TIMEOUT_PROCESAR_MS = 5_000;
/** BE-04: respuestas transitorias que vale la pena repetir. */
const REINTENTABLES = new Set([502, 503, 504]);
const BACKOFF_MS = [200, 600];
/** Un intento con menos tiempo que esto no alcanza a responder: se degrada como antes. */
const MIN_INTENTO_MS = 250;
const TIMEOUT_RANKING_MS = 5_000;

@Injectable()
export class IntelligenceService {
  private readonly log = new Logger(IntelligenceService.name);
  /** Inyectables para las pruebas (reloj, pausa y jitter). */
  ahora = () => Date.now();
  espera = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
  azar = () => Math.random();

  constructor(private readonly config: ConfigService) {}

  salud() {
    return this.pedir('/health', { method: 'GET' });
  }

  eco(mensaje: string) {
    return this.pedir('/v1/echo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mensaje }),
    });
  }

  normalizar(descripcion: string) {
    return this.pedir('/v1/materiales/normalizar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ descripcion }),
    });
  }

  /** Termino de busqueda y si el material se puede cotizar (3 s). */
  async preparar(codMaterial: string, nombre: string): Promise<PreparacionDto> {
    const json = await this.pedir('/v1/precios/preparar', this.post({ cod_material: codMaterial, nombre }), TIMEOUT_MS, true);
    return this.formato(() => validaPreparacion(json));
  }

  /** Procesa el contenido crudo de las fuentes (5 s). La respuesta se valida antes de usarla. */
  async procesar(
    material: { cod_material: string; nombre: string; termino_busqueda: string },
    fuentes: Array<{ fuente: Fuente; tipo: 'json' | 'html'; contenido: string[] }>,
    referencia: Date,
  ): Promise<ResultadoFuente[]> {
    const cuerpo = { material, referencia: referencia.toISOString(), fuentes };
    const json = await this.pedir('/v1/precios/procesar', this.post(cuerpo), TIMEOUT_PROCESAR_MS, true);
    const resultados = this.formato(() => validaProcesamiento(json, fuentes.map((f) => f.fuente)));
    for (const r of resultados.filter((x) => x.invalidos)) {
      this.log.warn(`${r.fuente}: ${r.invalidos} registros descartados por no cumplir las reglas`);
    }
    return resultados;
  }

  /** Ordena los materiales de una bodega por prioridad de reposicion (5 s). Devuelve los items en el orden de FastAPI, ya validados. */
  async ranking(referencia: Date, items: EntradaRanking[]): Promise<ItemRankingDto[]> {
    const cuerpo = { referencia: referencia.toISOString(), items };
    const json = await this.pedir('/v1/recomendaciones/ranking', this.post(cuerpo), TIMEOUT_RANKING_MS, true);
    return this.formato(() => validaRanking(json, items.map((i) => i.cod_material)));
  }

  private post(cuerpo: unknown): RequestInit {
    return { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) };
  }

  private formato<T>(valida: () => T): T {
    try {
      return valida();
    } catch (e) {
      if (!(e instanceof ErrorFormato)) throw e;
      throw new HttpException({ error: 'intelligence_error' }, HttpStatus.BAD_GATEWAY);
    }
  }

  private base(): string {
    const valor = (this.config.get<string>('INTELLIGENCE_SERVICE_URL') ?? '').replace(/\/$/, '');
    if (!valor || valor.includes('://')) return valor;
    return `http://${valor}`;
  }

  /**
   * `internoEs502`: un 422 del hop no es culpa del usuario del ERP, asi que sale como intelligence_error.
   *
   * BE-04: hasta 2 reintentos (200 ms y 600 ms, +-20 % de jitter) solo ante error de red o 502/503/504.
   * Todas las rutas de FastAPI son funciones puras (normalizan, procesan o puntuan sin guardar
   * estado), asi que repetirlas es idempotente. `timeoutMs` es el presupuesto TOTAL: cada intento
   * recibe solo lo que queda y no se reintenta si no alcanza; un timeout nunca se reintenta.
   */
  private async pedir(ruta: string, init: RequestInit, timeoutMs = TIMEOUT_MS, internoEs502 = false) {
    const correlacion = idCorrelacion();
    // BE-03: FastAPI rejects every route except /health without this shared secret.
    const token = this.config.get<string>('INTELLIGENCE_SERVICE_TOKEN');
    const headers: Record<string, string> = { ...(init.headers as Record<string, string> | undefined) };
    if (token) headers['X-Service-Token'] = token;
    if (correlacion !== 'sin-correlacion') headers['x-request-id'] = correlacion;

    const limite = this.ahora() + timeoutMs;
    let respuesta: Response | undefined;
    for (let intento = 0; ; intento++) {
      let motivo: string;
      try {
        respuesta = await fetch(`${this.base()}${ruta}`, {
          ...init,
          headers,
          signal: AbortSignal.timeout(Math.max(1, limite - this.ahora())),
        });
        if (!REINTENTABLES.has(respuesta.status)) break;
        motivo = `HTTP ${respuesta.status}`;
      } catch (e) {
        respuesta = undefined;
        // Se agoto el presupuesto: no hay tiempo para otro intento.
        if ((e as Error)?.name === 'TimeoutError' || (e as Error)?.name === 'AbortError') break;
        motivo = 'error de red';
      }
      const pausa = BACKOFF_MS[intento];
      if (pausa === undefined) break;
      const espera = Math.round(pausa * (0.8 + 0.4 * this.azar()));
      if (limite - this.ahora() - espera < MIN_INTENTO_MS) break;
      this.log.warn(`Reintento ${intento + 1} hacia FastAPI ${ruta} (${motivo}) en ${espera} ms, x-request-id=${correlacion}`);
      await this.espera(espera);
    }

    if (!respuesta) {
      throw new HttpException(
        { error: 'intelligence_unreachable' },
        HttpStatus.BAD_GATEWAY,
      );
    }
    if (respuesta.status === 422 && !internoEs502) {
      throw new HttpException(
        { error: 'invalid_request' },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    if (!respuesta.ok) {
      throw new HttpException(
        { error: 'intelligence_error' },
        HttpStatus.BAD_GATEWAY,
      );
    }

    try {
      return await respuesta.json();
    } catch {
      throw new HttpException(
        { error: 'intelligence_error' },
        HttpStatus.BAD_GATEWAY,
      );
    }
  }
}
