/**
 * robots.txt por origen, en memoria por 24 h y consultado antes de cada URL
 * (decisiones de implementacion, seccion 5). Sigue RFC 9309 en lo que importa aqui:
 * grupo propio o `*`, regla mas larga gana, `Allow` gana el empate, `*` y `$`.
 */
import { ORIGENES_ROBOTS, USER_AGENT } from './fuentes';

const VIGENCIA_MS = 24 * 60 * 60 * 1000;
const TIMEOUT_ROBOTS_MS = 3_000;
const PRODUCTO = 'stockaware';

interface Regla {
  permite: boolean;
  patron: RegExp;
  largo: number;
}

/** Reglas aplicables a StockAware: su grupo propio o, si no hay, el de `*`. */
export function parseaRobots(texto: string): Regla[] {
  const grupos: Array<{ agentes: string[]; reglas: Regla[] }> = [];
  let actual: (typeof grupos)[number] | null = null;
  let leyendoAgentes = false;
  for (const bruta of texto.split(/\r?\n/)) {
    const linea = bruta.replace(/#.*/, '').trim();
    const i = linea.indexOf(':');
    if (i < 0) continue;
    const clave = linea.slice(0, i).trim().toLowerCase();
    const valor = linea.slice(i + 1).trim();
    if (clave === 'user-agent') {
      if (!leyendoAgentes || !actual) {
        actual = { agentes: [], reglas: [] };
        grupos.push(actual);
      }
      actual.agentes.push(valor.toLowerCase());
      leyendoAgentes = true;
    } else if ((clave === 'allow' || clave === 'disallow') && actual) {
      leyendoAgentes = false;
      if (valor) actual.reglas.push({ permite: clave === 'allow', patron: aPatron(valor), largo: valor.length });
    } else {
      leyendoAgentes = false;
    }
  }
  const propio = grupos.filter((g) => g.agentes.includes(PRODUCTO));
  const elegidos = propio.length ? propio : grupos.filter((g) => g.agentes.includes('*'));
  return elegidos.flatMap((g) => g.reglas);
}

function aPatron(valor: string): RegExp {
  const ancla = valor.endsWith('$');
  const cuerpo = (ancla ? valor.slice(0, -1) : valor).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${cuerpo}${ancla ? '$' : ''}`);
}

export function permiteRuta(reglas: Regla[], rutaYConsulta: string): boolean {
  let mejor: Regla | null = null;
  for (const r of reglas) {
    if (!r.patron.test(rutaYConsulta)) continue;
    if (!mejor || r.largo > mejor.largo || (r.largo === mejor.largo && r.permite)) mejor = r;
  }
  return mejor ? mejor.permite : true;
}

export class CacheRobots {
  private readonly cache = new Map<string, { reglas: Regla[] | null; hasta: number }>();

  constructor(private readonly ahora: () => number = Date.now) {}

  /**
   * true si robots.txt del origen permite la URL. Sin robots.txt legible por red o 5xx, no.
   * Un origen fuera de ORIGENES_ROBOTS no se consulta y se trata como prohibido.
   */
  async permite(url: string, signal?: AbortSignal): Promise<boolean> {
    let u: URL;
    try {
      u = new URL(url);
    } catch {
      return false;
    }
    // Se usa la constante de la lista, no el texto de la URL: el host pedido nunca
    // sale de lo que envia el usuario.
    const origen = u.username || u.password ? undefined : ORIGENES_ROBOTS.find((o) => o === u.origin);
    if (!origen) return false;
    const reglas = await this.reglasDe(origen, signal);
    return reglas !== null && permiteRuta(reglas, u.pathname + u.search);
  }

  private async reglasDe(origen: string, signal?: AbortSignal): Promise<Regla[] | null> {
    const guardado = this.cache.get(origen);
    if (guardado && guardado.hasta > this.ahora()) return guardado.reglas;
    const reglas = await this.descarga(origen, signal);
    // Una descarga cortada por el presupuesto de la fuente no dice nada del sitio: no se guarda.
    if (!signal?.aborted) this.cache.set(origen, { reglas, hasta: this.ahora() + VIGENCIA_MS });
    return reglas;
  }

  private async descarga(origen: string, signal?: AbortSignal): Promise<Regla[] | null> {
    const limite = AbortSignal.timeout(TIMEOUT_ROBOTS_MS);
    try {
      const res = await fetch(`${origen}/robots.txt`, {
        headers: { 'User-Agent': USER_AGENT },
        signal: signal ? AbortSignal.any([signal, limite]) : limite,
      });
      if (res.status >= 400 && res.status < 500) return []; // sin robots.txt: sin restricciones
      if (!res.ok) return null;
      return parseaRobots(await res.text());
    } catch {
      return null;
    }
  }
}
