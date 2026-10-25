/**
 * Recupera el contenido crudo de una fuente. No lo interpreta: solo respeta robots.txt,
 * se identifica con su User-Agent y lleva el ritmo acordado (una peticion a la vez por
 * fuente, 2 s entre paginas, 10 s en total por fuente, sin reintento).
 */
import { Injectable } from '@nestjs/common';

import { registrarFallaFuente } from '../../comun/registro';
import { CacheRobots } from './robots';
import {
  CONFIG_FUENTES, Fuente, MAX_PAGINAS_SODIMAC, PAUSA_PAGINAS_MS, PRESUPUESTO_FUENTE_MS,
  TipoContenido, USER_AGENT, urlDeFuente, urlInicial, urlPagina,
} from './fuentes';

const MAX_REDIRECCIONES = 3;
const MAX_BYTES = 10_000_000;

export type LecturaFuente =
  | { estado: 'ok'; fuente: Fuente; tipo: TipoContenido; contenido: string[]; parcial: boolean; url: string; http: number }
  | { estado: 'falla'; fuente: Fuente; causa: 'timeout' | 'http_error'; url: string; http?: number };

type Pagina = { estado: 'ok'; texto: string; url: string; http: number } | { estado: 'falla'; causa: 'timeout' | 'http_error'; http?: number };

@Injectable()
export class RecuperadorFuentes {
  // Campos y no parametros del constructor para que Nest lo cree sin configuracion y las pruebas los reemplacen.
  robots = new CacheRobots();
  dormir = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
  presupuestoMs = PRESUPUESTO_FUENTE_MS;

  private readonly colas = new Map<Fuente, Promise<unknown>>();

  /**
   * Lee la fuente; `urlCategoria` solo aplica a Rhona y Sodimac. Nunca lanza: informa la causa.
   * Una peticion a la vez por fuente, tambien entre consultas simultaneas: las demas esperan turno.
   */
  lee(fuente: Fuente, termino: string, urlCategoria?: string | null): Promise<LecturaFuente> {
    const turno = (this.colas.get(fuente) ?? Promise.resolve()).then(() => this.leeFuente(fuente, termino, urlCategoria));
    this.colas.set(fuente, turno.catch(() => undefined));
    return turno;
  }

  private async leeFuente(fuente: Fuente, termino: string, urlCategoria?: string | null): Promise<LecturaFuente> {
    const inicial = urlInicial(fuente, termino, urlCategoria);
    if (!inicial) return { estado: 'falla', fuente, causa: 'http_error', url: '' };
    const senal = AbortSignal.timeout(this.presupuestoMs);
    const maxPaginas = fuente === 'sodimac' ? MAX_PAGINAS_SODIMAC : 1;
    const contenido: string[] = [];
    let base = inicial;
    let http = 200;
    for (let n = 1; n <= maxPaginas; n++) {
      if (n > 1) {
        // Sin presupuesto para la pausa y otra pagina: se entrega lo leido como parcial.
        if (senal.aborted) break;
        await this.dormir(PAUSA_PAGINAS_MS);
      }
      const pagina = await this.pide(fuente, n === 1 ? inicial : urlPagina(base, n), senal);
      if (pagina.estado === 'falla') {
        if (n === 1) return { estado: 'falla', fuente, causa: pagina.causa, url: inicial, http: pagina.http };
        break;
      }
      contenido.push(pagina.texto);
      base = pagina.url;
      http = pagina.http;
    }
    return { estado: 'ok', fuente, tipo: CONFIG_FUENTES[fuente].tipo, contenido, parcial: contenido.length < maxPaginas, url: inicial, http };
  }

  /** Una peticion con robots.txt en cada salto de redireccion; el destino debe seguir en la fuente. */
  private async pide(fuente: Fuente, inicial: string, senal: AbortSignal): Promise<Pagina> {
    let url = inicial;
    try {
      for (let salto = 0; salto <= MAX_REDIRECCIONES; salto++) {
        if (!(await this.robots.permite(url, senal))) {
          if (senal.aborted) return { estado: 'falla', causa: 'timeout' };
          registrarFallaFuente({ fuente, causa: 'http_error', url });
          return { estado: 'falla', causa: 'http_error' };
        }
        const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, redirect: 'manual', signal: senal });
        const destino = res.headers.get('location');
        if (res.status >= 300 && res.status < 400 && destino) {
          url = new URL(destino, url).toString();
          if (!this.mismoSitio(fuente, inicial, url)) return { estado: 'falla', causa: 'http_error', http: res.status };
          continue;
        }
        if (!res.ok) {
          registrarFallaFuente({ fuente, causa: 'http_error', url, http: res.status });
          return { estado: 'falla', causa: 'http_error', http: res.status };
        }
        if (Number(res.headers.get('content-length') ?? 0) > MAX_BYTES) return { estado: 'falla', causa: 'http_error', http: res.status };
        return { estado: 'ok', texto: await res.text(), url, http: res.status };
      }
      return { estado: 'falla', causa: 'http_error' };
    } catch {
      const causa = senal.aborted ? 'timeout' : 'http_error';
      registrarFallaFuente({ fuente, causa, url: inicial });
      return { estado: 'falla', causa };
    }
  }

  private mismoSitio(fuente: Fuente, origen: string, destino: string): boolean {
    return CONFIG_FUENTES[fuente].dominios
      ? urlDeFuente(fuente, destino)
      : new URL(destino).protocol === 'https:' && new URL(destino).hostname === new URL(origen).hostname;
  }
}
