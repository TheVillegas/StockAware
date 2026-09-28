/**
 * Classify a stock level against its minimum (spec 3.4).
 * Values may arrive as numeric strings from decimal API columns.
 * @param {number|string|null|undefined} stock
 * @param {number|string|null|undefined} minimum
 * @returns {'ok'|'warn'|'crit'} crit = zero or negative, warn = below minimum, ok otherwise.
 */
function stockState(stock, minimum) {
  const s = Number(stock);
  if (stock === null || stock === undefined || !Number.isFinite(s)) return 'ok';
  if (s <= 0) return 'crit';
  const m = Number(minimum);
  if (minimum !== null && minimum !== undefined && Number.isFinite(m) && s < m) return 'warn';
  return 'ok';
}

module.exports = { stockState };
