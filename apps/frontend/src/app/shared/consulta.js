/**
 * Pure helpers that turn raw query rows into the facts a consultation screen shows.
 */
const { stockState } = require('../bodega/stock-state');

const PREFIXES = { cod: 'Código', id: '', num: 'N°', fec: 'Fecha', desc: 'Descripción' };
const WORDS = {
  codigo: 'código', descr: 'descripción', descripcion: 'descripción', com: 'comuna',
  fono: 'teléfono', direccion: 'dirección', razon: 'razón', categoria: 'categoría',
};

/**
 * Readable label for a database column name.
 * @param {string} column
 * @returns {string}
 */
function columnLabel(column) {
  const text = String(column ?? '').trim();
  if (!text || text === text.toUpperCase()) return text;
  const words = text.split(/[_\s]+/).filter(Boolean);
  const first = words[0].toLowerCase();
  if (words.length > 1 && first in PREFIXES) {
    words.shift();
    if (PREFIXES[first]) words.unshift(PREFIXES[first]);
  }
  const label = words.map((w) => WORDS[w.toLowerCase()] ?? w).join(' ').toLowerCase();
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/**
 * Whole calendar days between an ISO date and today.
 * @param {string} iso
 * @param {Date} [today]
 * @returns {number|null}
 */
function daysSince(iso, today = new Date()) {
  const [y, m, d] = String(iso ?? '').slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  const start = Date.UTC(y, m - 1, d);
  const end = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.max(0, Math.round((end - start) / 86400000));
}

/**
 * Net amount not yet received, from the order progress percent.
 * @param {number|string} net
 * @param {number|string|null} progressPercent
 * @returns {number}
 */
function outstandingAmount(net, progressPercent) {
  const pct = Math.min(100, Math.max(0, Number(progressPercent ?? 0) || 0));
  return Math.round(Number(net || 0) * (100 - pct) / 100);
}

/**
 * Quantity needed to bring stock back to its minimum.
 * @param {number|string} stock
 * @param {number|string|null} minimum
 * @returns {number}
 */
function restockQuantity(stock, minimum) {
  const m = Number(minimum);
  if (minimum === null || minimum === undefined || !Number.isFinite(m)) return 0;
  return Math.max(0, m - Number(stock || 0));
}

/**
 * Percentage of a total, rounded to one decimal.
 * @param {number|string} value
 * @param {number|string} total
 * @returns {number}
 */
function share(value, total) {
  const t = Number(total);
  if (!t) return 0;
  return Math.round(Number(value || 0) / t * 1000) / 10;
}

const RISK_ORDER = { crit: 0, warn: 1, ok: 2 };

/**
 * Stock rows ordered by risk: no stock, below minimum, then the rest. Stable and non-mutating.
 * @template {{stock: number|string, stock_minimo: number|string}} T
 * @param {T[]} rows
 * @returns {T[]}
 */
function sortByStockRisk(rows) {
  return rows
    .map((row, index) => ({ row, index, risk: RISK_ORDER[stockState(row.stock, row.stock_minimo)] }))
    .sort((a, b) => a.risk - b.risk || a.index - b.index)
    .map(({ row }) => row);
}

/**
 * Days the current stock lasts at the average daily consumption: whole days,
 * or the exact fraction when positive stock lasts less than one day.
 * @param {number|string} stock
 * @param {number|string|null|undefined} dailyUse
 * @returns {number|null} null when there is no consumption to project; 0 only when stock is gone.
 */
function coverageDays(stock, dailyUse) {
  const use = Number(dailyUse);
  if (dailyUse === null || dailyUse === undefined || !Number.isFinite(use) || use <= 0) return null;
  const days = Number(stock || 0) / use;
  if (days <= 0) return 0;
  return days < 1 ? Math.round(days * 100) / 100 : Math.floor(days);
}

/**
 * @param {number|null} days
 * @returns {string}
 */
function coverageLabel(days) {
  if (days === null || days === undefined) return 'Sin consumo reciente';
  if (days <= 0) return 'Agotado';
  if (days < 1) return 'Menos de 1 día';
  if (days > 365) return 'Más de 1 año';
  return days === 1 ? '1 día' : `${days} días`;
}

/** Days of consumption a restock order should cover. */
const DIAS_PEDIDO = 30;

/**
 * Whole units to order: enough for DIAS_PEDIDO days of use, or to reach the minimum, whichever is larger.
 * @param {number|string} stock
 * @param {number|string|null} minimum
 * @param {number|string|null|undefined} dailyUse
 * @returns {number}
 */
function suggestedOrderQty(stock, minimum, dailyUse) {
  const use = Number(dailyUse);
  const forUse = Number.isFinite(use) && use > 0 ? use * DIAS_PEDIDO - Number(stock || 0) : 0;
  return Math.max(0, Math.ceil(Math.max(restockQuantity(stock, minimum), forUse)));
}

/**
 * Prefill for a new purchase order from selected stock rows.
 * @param {Array<{cod_material: string, nombre: string, stock: number|string, stock_minimo: number|string,
 *   consumo_diario?: number|string|null, unidad: string, tarifa: number|string, id_bodega: number}>} filas
 * @param {Record<string, string>} ccostoPorBodega
 * @returns {{ccosto: string, lineas: Array<{nombre: string, cantidad: number, unidad: string, precio_uni: number}>}}
 */
function ordenDesdeStock(filas, ccostoPorBodega) {
  const lineas = filas
    .map((f) => ({
      nombre: `${f.cod_material} ${f.nombre}`.trim(),
      cantidad: suggestedOrderQty(f.stock, f.stock_minimo, f.consumo_diario),
      unidad: f.unidad || 'UNI',
      precio_uni: Number(f.tarifa || 0),
    }))
    .filter((l) => l.cantidad > 0);
  const centros = new Set(filas.map((f) => (ccostoPorBodega ?? {})[f.id_bodega] ?? ''));
  return { ccosto: centros.size === 1 ? [...centros][0] : '', lineas };
}

module.exports = {
  columnLabel, coverageDays, coverageLabel, daysSince, ordenDesdeStock, outstandingAmount, restockQuantity,
  share, sortByStockRisk, suggestedOrderQty,
};
