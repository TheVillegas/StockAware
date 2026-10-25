/**
 * Catalogo de las 5 fuentes de precios (ADR 0002) y las URL que NestJS consulta.
 *
 * Dartel, Dimeiggs y SoloTodo se buscan por termino. Rhona y Sodimac solo se leen con la
 * URL de categoria que una persona asocio al material; el buscador de Sodimac esta
 * prohibido por su robots.txt y nunca se consulta.
 */
export const FUENTES = ['dartel', 'dimeiggs', 'solotodo', 'rhona', 'sodimac'] as const;
export type Fuente = (typeof FUENTES)[number];
export type TipoContenido = 'json' | 'html';

export const USER_AGENT = 'StockAware/0.1 (+https://github.com/TheVillegas/StockAware)';
export const PRESUPUESTO_FUENTE_MS = 10_000;
export const PAUSA_PAGINAS_MS = 2_000;
export const MAX_PAGINAS_SODIMAC = 3;

interface ConfigFuente {
  tipo: TipoContenido;
  /** Dominios aceptados para la `url` de cada candidato; null acepta cualquier https. */
  dominios: string[] | null;
  /** Solo Rhona y Sodimac: requieren la URL de categoria asociada. */
  requiereUrl: boolean;
}

export const CONFIG_FUENTES: Record<Fuente, ConfigFuente> = {
  dartel: { tipo: 'json', dominios: ['dartel.cl'], requiereUrl: false },
  dimeiggs: { tipo: 'json', dominios: ['dimeiggs.cl'], requiereUrl: false },
  // SoloTodo agrega ofertas de comercios: su external_url apunta al comercio, no a solotodo.com.
  solotodo: { tipo: 'json', dominios: null, requiereUrl: false },
  rhona: { tipo: 'html', dominios: ['rhona.cl'], requiereUrl: true },
  sodimac: { tipo: 'html', dominios: ['sodimac.cl'], requiereUrl: true },
};

/**
 * Unicos origenes cuyo robots.txt se descarga. Lista cerrada a proposito: el origen
 * puede venir de una URL que envia el usuario, y una lista evita pedir robots.txt a
 * cualquier otro host (SSRF, #77). Una fuente nueva o un subdominio nuevo se agregan aqui.
 */
export const ORIGENES_ROBOTS = [
  'https://dartel.cl', 'https://www.dartel.cl',
  'https://dimeiggs.cl', 'https://www.dimeiggs.cl',
  'https://publicapi.solotodo.com',
  'https://rhona.cl', 'https://www.rhona.cl',
  'https://sodimac.cl', 'https://www.sodimac.cl',
] as const;

/** true si la URL es https y su host es el dominio de la fuente o un subdominio. */
export function urlDeFuente(fuente: Fuente, url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:') return false;
  const dominios = CONFIG_FUENTES[fuente].dominios;
  return !dominios || dominios.some((d) => u.hostname === d || u.hostname.endsWith(`.${d}`));
}

/** Primera URL de la lectura. Rhona y Sodimac usan `urlCategoria`, que debe pertenecer a la fuente. */
export function urlInicial(fuente: Fuente, termino: string, urlCategoria?: string | null): string | null {
  const t = encodeURIComponent(termino);
  switch (fuente) {
    case 'dartel':
      return `https://www.dartel.cl/api/catalog_system/pub/products/search/${t}?_from=0&_to=49`;
    case 'dimeiggs':
      return `https://www.dimeiggs.cl/api/catalog_system/pub/products/search/${t}?_from=0&_to=49`;
    case 'solotodo':
      return `https://publicapi.solotodo.com/entities/?search=${t}&is_available=true&is_visible=true&ordering=-last_pricing_update&page_size=50`;
    default:
      return urlCategoria && urlDeFuente(fuente, urlCategoria) ? urlCategoria : null;
  }
}

/** Sodimac pagina con `?page=N` (verificado el 2026-10-24; `currentpage` se ignora). */
export function urlPagina(url: string, pagina: number): string {
  if (pagina === 1) return url;
  const u = new URL(url);
  u.searchParams.set('page', String(pagina));
  return u.toString();
}

/**
 * EP2 solo lee listados de categoria (el parser de FastAPI no interpreta fichas de producto).
 * Se acepta por lista blanca de ruta: Rhona `/catalogo/...`, Sodimac `/sodimac-cl/category|lista/...`.
 */
const RUTA_LISTADO: Partial<Record<Fuente, RegExp>> = {
  rhona: /^\/catalogo\//,
  sodimac: /^\/sodimac-cl\/(category|lista)\//,
};

export function urlEsListado(fuente: Fuente, url: string): boolean {
  const ruta = RUTA_LISTADO[fuente];
  return !!ruta && ruta.test(new URL(url).pathname);
}
