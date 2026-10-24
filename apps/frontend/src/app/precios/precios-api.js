/**
 * HTTP client and wording for the "Precios de mercado" panel.
 * Kept free of Angular so the requests and messages can be tested without a TestBed.
 */
// HttpClient emits one value and completes. Resolving on the first value avoids
// requiring rxjs from CommonJS, which blocks the bundler's ESM optimizations.
const firstValueFrom = (obs) => new Promise((resolve, reject) => {
  obs.subscribe({ next: resolve, error: reject });
});

const FUENTES = {
  dartel: 'Dartel', dimeiggs: 'Dimeiggs', solotodo: 'SoloTodo', rhona: 'Rhona', sodimac: 'Sodimac',
};
/** Sources that only answer once a person links the category listing of the material. */
const FUENTES_CON_URL = ['rhona', 'sodimac'];

const ERRORES = {
  material_not_found: 'El material ya no existe en el ERP.',
  vinculo_not_found: 'Ese candidato ya no existe. Actualiza el panel.',
  sources_unavailable: 'Ninguna fuente respondió y no hay precios guardados. Intenta más tarde.',
  intelligence_unreachable: 'El servicio que procesa los precios no responde. Intenta más tarde.',
  intelligence_error: 'El servicio que procesa los precios falló. Intenta más tarde.',
  url_invalid: 'La dirección no es válida. Debe empezar con https://',
  url_domain_mismatch: 'La dirección no pertenece a esa tienda.',
  url_not_listing: 'La dirección debe ser la de un listado de categoría, no la de un producto ni la portada.',
  url_blocked_by_robots: 'El sitio no permite consultar esa dirección de forma automática.',
};
const POR_ESTADO = {
  401: 'Tu sesión expiró. Ingresa de nuevo.',
  403: 'No tienes permiso para esta acción.',
};
const MOTIVOS = {
  timeout: 'La fuente tardó demasiado en responder.',
  http_error: 'La fuente respondió con un error.',
  invalid_content: 'La respuesta de la fuente no se pudo leer.',
  cooldown: 'Se pausó la consulta para no sobrecargar la fuente. Se reintentará más tarde.',
};

/**
 * @param {{get: Function, patch: Function, put: Function}} http HttpClient-like
 * @param {string} base API root, e.g. `/api`
 */
function crearPreciosApi(http, base) {
  const raiz = `${base}/precios`;
  const material = (cod) => `${raiz}/${encodeURIComponent(cod)}`;
  return {
    consultar: (cod) => firstValueFrom(http.get(material(cod))),
    cambiarVinculo: (id, estado) => firstValueFrom(http.patch(`${raiz}/vinculos/${id}`, { estado })),
    asociarUrl: (cod, fuente, url) => firstValueFrom(http.put(`${material(cod)}/fuente-url`, { fuente, url })),
    marcarCotizable: (cod, cotizable, motivo) => firstValueFrom(http.put(
      `${material(cod)}/cotizable`, motivo ? { cotizable, motivo } : { cotizable },
    )),
  };
}

/** Spanish message for a failed request; never the raw backend text. */
function mensajeError(e, porDefecto) {
  const codigo = e?.error?.error;
  if (ERRORES[codigo]) return ERRORES[codigo];
  if (e?.status === 0) return 'No hay conexión con el servidor.';
  return POR_ESTADO[e?.status] ?? porDefecto;
}

/**
 * What to tell the user about a source. Returns '' when its publications speak for themselves,
 * and never fills in a price: a source without data only gets an explanation.
 */
function textoFuente(f, fecha = (iso) => iso) {
  const desde = f.obtenido_en ? ` Dato del ${fecha(f.obtenido_en)}.` : '';
  if (f.estado === 'sin_resultados') return 'No se encontraron publicaciones para este material.';
  if (f.estado === 'desactualizada') {
    return `No se pudo actualizar; se muestra lo último guardado.${desde}`;
  }
  if (f.estado === 'sin_datos') {
    if (MOTIVOS[f.motivo]) return MOTIVOS[f.motivo];
    return FUENTES_CON_URL.includes(f.fuente)
      ? `${FUENTES[f.fuente]} necesita la dirección del listado del material.`
      : 'Esta fuente aún no tiene datos.';
  }
  return f.parcial ? 'Resultado parcial: la fuente no entregó todas las publicaciones.' : '';
}

const textoIva = (v) => (v === true ? 'IVA incluido' : v === false ? 'Sin IVA' : 'IVA no informado');

module.exports = { FUENTES, FUENTES_CON_URL, crearPreciosApi, mensajeError, textoFuente, textoIva };
