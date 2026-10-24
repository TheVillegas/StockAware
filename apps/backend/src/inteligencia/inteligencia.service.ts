/**
 * Cliente HTTP real del hop Nest → FastAPI.
 *
 * No hay stub: si intelligence-service no responde, el ERP falla de forma
 * controlada (502) en vez de inventar un eco. El timeout corto evita que un
 * FastAPI colgado deje colgada la replica.
 */
import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Fuente } from '../precios/fuentes/fuentes';
import {
  ErrorFormato, PreparacionDto, ResultadoFuente, validaPreparacion, validaProcesamiento,
} from './precios.dto';

const TIMEOUT_MS = 3_000;
const TIMEOUT_PROCESAR_MS = 5_000;

@Injectable()
export class IntelligenceService {
  private readonly log = new Logger(IntelligenceService.name);

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
    return (this.config.get<string>('INTELLIGENCE_SERVICE_URL') ?? '').replace(/\/$/, '');
  }

  /** `internoEs502`: un 422 del hop no es culpa del usuario del ERP, asi que sale como intelligence_error. */
  private async pedir(ruta: string, init: RequestInit, timeoutMs = TIMEOUT_MS, internoEs502 = false) {
    let respuesta: Response;
    try {
      respuesta = await fetch(`${this.base()}${ruta}`, {
        ...init,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
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
