/**
 * Client-side search over the bodega list for the searchable combobox.
 * The list has hundreds of entries, so only a few matches are rendered.
 */

/** @param {unknown} texto */
function normalizar(texto) {
  return String(texto ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Filters bodegas by name or code. Every word of the text must appear; names
 * that start with the text (or an exact code) come first, then names with a
 * word starting with it, then any other match. Ties keep the original order.
 * @param {Array<{bodega: number, descr: string}>|null|undefined} bodegas
 * @param {string} texto
 * @param {number} [limite=12] maximum matches returned.
 * @returns {{coincidencias: Array<{bodega: number, descr: string}>, total: number}} total counts every match.
 */
function filtrarBodegas(bodegas, texto, limite = 12) {
  const lista = Array.isArray(bodegas) ? bodegas : [];
  const q = normalizar(texto);
  if (!q) return { coincidencias: lista.slice(0, limite), total: lista.length };
  const palabras = q.split(' ');
  const encontradas = [];
  lista.forEach((b, i) => {
    const nombre = normalizar(b.descr);
    const codigo = String(b.bodega ?? '');
    const cabe = palabras.every((p) => nombre.includes(p) || codigo.includes(p));
    if (!cabe) return;
    const rango = nombre.startsWith(q) || codigo === q ? 0
      : (` ${nombre}`).includes(` ${q}`) ? 1 : 2;
    encontradas.push({ b, i, rango });
  });
  encontradas.sort((x, y) => x.rango - y.rango || x.i - y.i);
  return { coincidencias: encontradas.slice(0, limite).map((e) => e.b), total: encontradas.length };
}

/**
 * Text shown for the selected bodega; 0 means every bodega.
 * @param {Array<{bodega: number, descr: string}>|null|undefined} bodegas
 * @param {number} id
 * @returns {string}
 */
function etiquetaBodega(bodegas, id) {
  if (!id) return 'Todas las bodegas';
  const b = (Array.isArray(bodegas) ? bodegas : []).find((x) => x.bodega === id);
  return b ? b.descr : `Bodega ${id}`;
}

module.exports = { filtrarBodegas, etiquetaBodega };
