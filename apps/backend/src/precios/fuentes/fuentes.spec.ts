// @ts-nocheck — file is JS-shaped so Jest's default babel-jest can parse it.
const path = require('path');
const { Logger } = require('@nestjs/common');
const { cargaTs } = require('./carga-ts');

const { urlDeFuente, urlEsListado, urlInicial, urlPagina, USER_AGENT } = cargaTs(path.join(__dirname, 'fuentes.ts'));
const { CacheRobots, parseaRobots, permiteRuta } = cargaTs(path.join(__dirname, 'robots.ts'));
const { RecuperadorFuentes } = cargaTs(path.join(__dirname, 'recuperador.ts'));

Logger.overrideLogger(false);

const ROBOTS = 'User-agent: *\nDisallow: /busca/*\nDisallow: /sodimac-cl/buscar/\nAllow: /busca/ok\n';

/** fetch falso: `rutas` mapea URL → respuesta; robots.txt responde ROBOTS salvo que se indique. */
function fetchFalso(rutas, robots = { status: 200, texto: ROBOTS }) {
  return jest.fn(async (url, init) => {
    const u = new URL(url);
    let r = u.pathname === '/robots.txt' ? robots : rutas[url];
    if (typeof r === 'function') r = await r(init);
    if (!r) return { ok: false, status: 404, headers: new Headers(), text: async () => '' };
    const status = r.status ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: new Headers(r.headers ?? {}),
      text: async () => r.texto ?? '',
    };
  });
}
const datos = (fetch) => fetch.mock.calls.filter(([u]) => !u.endsWith('/robots.txt'));

describe('URL de las fuentes', () => {
  it('arma la consulta de cada fuente de busqueda con el termino codificado', () => {
    expect(urlInicial('dartel', 'amarra plastica')).toBe(
      'https://www.dartel.cl/api/catalog_system/pub/products/search/amarra%20plastica?_from=0&_to=49',
    );
    expect(urlInicial('dimeiggs', 'lapiz')).toContain('https://www.dimeiggs.cl/api/catalog_system/pub/products/search/lapiz?_from=0&_to=49');
    expect(urlInicial('solotodo', 'mouse')).toBe(
      'https://publicapi.solotodo.com/entities/?search=mouse&is_available=true&is_visible=true&ordering=-last_pricing_update&page_size=50',
    );
  });

  it('Rhona y Sodimac solo usan la URL asociada y de su dominio', () => {
    expect(urlInicial('rhona', 'cable')).toBeNull();
    expect(urlInicial('sodimac', 'cable', 'https://www.rhona.cl/x')).toBeNull();
    expect(urlInicial('sodimac', 'cable', 'http://www.sodimac.cl/x')).toBeNull();
    expect(urlInicial('sodimac', 'cable', 'https://www.sodimac.cl/sodimac-cl/category/scat1/x')).toBe('https://www.sodimac.cl/sodimac-cl/category/scat1/x');
  });

  it('solo acepta listados de categoria, no productos ni buscadores', () => {
    expect(urlEsListado('rhona', 'https://rhona.cl/catalogo/4/x/35/herramientas.html')).toBe(true);
    expect(urlEsListado('rhona', 'https://rhona.cl/producto/10408/dobla-conduit-20mm.html')).toBe(false);
    expect(urlEsListado('sodimac', 'https://www.sodimac.cl/sodimac-cl/category/scat1/x')).toBe(true);
    expect(urlEsListado('sodimac', 'https://www.sodimac.cl/sodimac-cl/lista/C1/x')).toBe(true);
    expect(urlEsListado('sodimac', 'https://www.sodimac.cl/sodimac-cl/articulo/1/x')).toBe(false);
    expect(urlEsListado('dartel', 'https://www.dartel.cl/x')).toBe(false);
  });

  it('valida el dominio de la url: subdominio si, parecido no, SoloTodo cualquier https', () => {
    expect(urlDeFuente('dartel', 'https://www.dartel.cl/p')).toBe(true);
    expect(urlDeFuente('dartel', 'https://dartel.cl.malo.com/p')).toBe(false);
    expect(urlDeFuente('dartel', 'https://www.otro.cl/p')).toBe(false);
    expect(urlDeFuente('dartel', 'http://www.dartel.cl/p')).toBe(false);
    expect(urlDeFuente('solotodo', 'https://kdtec.cl/p')).toBe(true);
    expect(urlDeFuente('solotodo', 'http://kdtec.cl/p')).toBe(false);
  });

  it('pagina con ?page=N', () => {
    expect(urlPagina('https://www.sodimac.cl/sodimac-cl/lista/C/x', 1)).toBe('https://www.sodimac.cl/sodimac-cl/lista/C/x');
    expect(urlPagina('https://www.sodimac.cl/sodimac-cl/lista/C/x', 3)).toBe('https://www.sodimac.cl/sodimac-cl/lista/C/x?page=3');
  });
});

describe('robots.txt', () => {
  afterEach(() => jest.restoreAllMocks());

  it('aplica el grupo propio antes que *, la regla mas larga y los comodines', () => {
    const reglas = parseaRobots('User-agent: *\nDisallow: /\n\nUser-agent: StockAware\nDisallow: /privado/*/x$\nAllow: /privado/a/x');
    expect(permiteRuta(reglas, '/publico')).toBe(true);
    expect(permiteRuta(reglas, '/privado/b/x')).toBe(false);
    expect(permiteRuta(reglas, '/privado/b/x?q=1')).toBe(true);
    expect(permiteRuta(reglas, '/privado/a/x')).toBe(false); // gana la regla mas larga
    expect(permiteRuta(reglas, '/privado/a/x/y/zzzzzz')).toBe(true);
    const todo = parseaRobots(ROBOTS);
    expect(permiteRuta(todo, '/busca/leche')).toBe(false);
    expect(permiteRuta(todo, '/busca/ok')).toBe(true);
  });

  it('descarga una vez por origen, la guarda 24 h y la renueva despues', async () => {
    let ahora = 1_000;
    const fetch = fetchFalso({});
    global.fetch = fetch;
    const cache = new CacheRobots(() => ahora);
    expect(await cache.permite('https://a.cl/ok')).toBe(true);
    expect(await cache.permite('https://a.cl/busca/x')).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][1].headers['User-Agent']).toBe(USER_AGENT);
    ahora += 24 * 3600 * 1000 + 1;
    await cache.permite('https://a.cl/ok');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('sin robots.txt (404) permite; con 5xx o sin red prohibe', async () => {
    global.fetch = fetchFalso({}, { status: 404 });
    expect(await new CacheRobots().permite('https://a.cl/x')).toBe(true);
    global.fetch = fetchFalso({}, { status: 503 });
    expect(await new CacheRobots().permite('https://a.cl/x')).toBe(false);
    global.fetch = jest.fn().mockRejectedValue(new Error('red'));
    expect(await new CacheRobots().permite('https://a.cl/x')).toBe(false);
  });
});

describe('RecuperadorFuentes', () => {
  const original = global.fetch;
  let rec;
  beforeEach(() => {
    rec = new RecuperadorFuentes();
    rec.dormir = jest.fn(async () => {});
  });
  afterEach(() => {
    global.fetch = original;
  });

  it('lee una fuente JSON: revisa robots, se identifica y entrega el cuerpo tal cual', async () => {
    const url = urlInicial('dartel', 'amarra');
    global.fetch = fetchFalso({ [url]: { texto: '[{"a":1}]' } });
    const r = await rec.lee('dartel', 'amarra');
    expect(r).toMatchObject({ estado: 'ok', tipo: 'json', contenido: ['[{"a":1}]'], parcial: false, url, http: 200 });
    expect(global.fetch.mock.calls[0][0]).toBe('https://www.dartel.cl/robots.txt');
    expect(datos(global.fetch)).toHaveLength(1);
    expect(datos(global.fetch)[0][1].headers['User-Agent']).toBe(USER_AGENT);
    expect(rec.dormir).not.toHaveBeenCalled();
  });

  it('no consulta si robots.txt lo prohibe y nunca el buscador de Sodimac', async () => {
    global.fetch = fetchFalso({});
    const r = await rec.lee('sodimac', 'cable', 'https://www.sodimac.cl/sodimac-cl/buscar/?Ntt=cable');
    expect(r).toMatchObject({ estado: 'falla', causa: 'http_error' });
    expect(datos(global.fetch)).toHaveLength(0);
  });

  it('un HTTP de error es http_error y no se reintenta', async () => {
    const url = urlInicial('dimeiggs', 'lapiz');
    global.fetch = fetchFalso({ [url]: { status: 503 } });
    expect(await rec.lee('dimeiggs', 'lapiz')).toMatchObject({ estado: 'falla', causa: 'http_error', http: 503 });
    expect(datos(global.fetch)).toHaveLength(1);
  });

  it('agotar los 10 s de la fuente es timeout', async () => {
    const url = urlInicial('solotodo', 'mouse');
    global.fetch = fetchFalso({
      [url]: (init) => new Promise((_, rechaza) => init.signal.addEventListener('abort', () => rechaza(init.signal.reason))),
    });
    rec.presupuestoMs = 20;
    expect(await rec.lee('solotodo', 'mouse')).toMatchObject({ estado: 'falla', causa: 'timeout' });
  });

  it('Rhona sin URL asociada no se consulta; con URL lee una pagina HTML', async () => {
    const url = 'https://rhona.cl/catalogo/4/x/35/herramientas.html';
    global.fetch = fetchFalso({ [url]: { texto: '<html/>' } });
    expect(await rec.lee('rhona', 'cable')).toMatchObject({ estado: 'falla' });
    expect(await rec.lee('rhona', 'cable', url)).toMatchObject({ estado: 'ok', tipo: 'html', contenido: ['<html/>'], parcial: false });
  });

  it('Sodimac sigue la redireccion, lee 3 paginas con 2 s de pausa y pagina sobre la URL final', async () => {
    const cat = 'https://www.sodimac.cl/sodimac-cl/category/scat1/x';
    const lista = 'https://www.sodimac.cl/sodimac-cl/lista/C1/x';
    global.fetch = fetchFalso({
      [cat]: { status: 301, headers: { location: lista } },
      [lista]: { texto: 'p1' },
      [`${lista}?page=2`]: { texto: 'p2' },
      [`${lista}?page=3`]: { texto: 'p3' },
    });
    const r = await rec.lee('sodimac', 'cable', cat);
    expect(r).toMatchObject({ estado: 'ok', contenido: ['p1', 'p2', 'p3'], parcial: false });
    expect(rec.dormir.mock.calls).toEqual([[2000], [2000]]);
    expect(datos(global.fetch).map(([u]) => u)).toEqual([cat, lista, `${lista}?page=2`, `${lista}?page=3`]);
  });

  it('si una pagina posterior falla entrega lo leido como parcial', async () => {
    const cat = 'https://www.sodimac.cl/sodimac-cl/lista/C1/x';
    global.fetch = fetchFalso({ [cat]: { texto: 'p1' }, [`${cat}?page=2`]: { status: 500 } });
    const r = await rec.lee('sodimac', 'cable', cat);
    expect(r).toMatchObject({ estado: 'ok', contenido: ['p1'], parcial: true });
    expect(datos(global.fetch)).toHaveLength(2);
  });

  it('sin presupuesto para la segunda pagina tambien es parcial', async () => {
    const cat = 'https://www.sodimac.cl/sodimac-cl/lista/C1/x';
    global.fetch = fetchFalso({ [cat]: { texto: 'p1' } });
    rec.presupuestoMs = 10;
    rec.dormir = (ms) => new Promise((r) => setTimeout(r, 30));
    const r = await rec.lee('sodimac', 'cable', cat);
    expect(r).toMatchObject({ estado: 'ok', contenido: ['p1'], parcial: true });
  });

  it('dos consultas a la misma fuente no se solapan', async () => {
    const url = urlInicial('dartel', 'amarra');
    let activas = 0;
    let maximo = 0;
    global.fetch = fetchFalso({
      [url]: async () => {
        maximo = Math.max(maximo, ++activas);
        await new Promise((r) => setTimeout(r, 10));
        activas--;
        return { texto: '[]' };
      },
    });
    const r = await Promise.all([rec.lee('dartel', 'amarra'), rec.lee('dartel', 'amarra')]);
    expect(r.map((x) => x.estado)).toEqual(['ok', 'ok']);
    expect(maximo).toBe(1);
  });

  it('una redireccion fuera de la fuente se rechaza', async () => {
    const url = urlInicial('dartel', 'amarra');
    global.fetch = fetchFalso({ [url]: { status: 302, headers: { location: 'https://otro.com/x' } } });
    expect(await rec.lee('dartel', 'amarra')).toMatchObject({ estado: 'falla', causa: 'http_error' });
    expect(datos(global.fetch)).toHaveLength(1);
  });
});
