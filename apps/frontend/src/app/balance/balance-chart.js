/**
 * Pure helpers behind the Balance charts and the invoice allocation bar.
 */

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const pad = (n) => String(n).padStart(2, '0');

/**
 * Local calendar date as YYYY-MM-DD (toISOString would shift to UTC).
 * @param {Date} date
 * @returns {string}
 */
function isoLocal(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Same calendar day some years away; 29 February falls back to the 28th.
 * @param {string} iso
 * @param {number} years
 * @returns {string}
 */
function shiftYear(iso, years) {
  const [y, m, d] = String(iso ?? '').slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return '';
  const year = y + years;
  const last = new Date(year, m, 0).getDate();
  return `${year}-${pad(m)}-${pad(Math.min(d, last))}`;
}

/**
 * Date range for a period chip: year to date, or the last twelve calendar months.
 * @param {'ytd'|'12m'} kind
 * @param {Date} [today]
 * @returns {{desde: string, hasta: string}}
 */
function periodPreset(kind, today = new Date()) {
  const hasta = isoLocal(today);
  if (kind === '12m') {
    return { desde: isoLocal(new Date(today.getFullYear(), today.getMonth() - 11, 1)), hasta };
  }
  return { desde: `${today.getFullYear()}-01-01`, hasta };
}

/**
 * Percent change from the previous value, one decimal; null when there is no base.
 * @param {number|string} current
 * @param {number|string|null} previous
 * @returns {number|null}
 */
function percentChange(current, previous) {
  const p = Number(previous);
  if (previous == null || !Number.isFinite(p) || p === 0) return null;
  return Math.round((Number(current || 0) - p) / Math.abs(p) * 1000) / 10;
}

/**
 * Months ending at the period end, with zeros where the backend has no rows.
 * @param {Array<{mes: string, total: number|string}>} rows
 * @param {string} desde
 * @param {string} hasta
 * @param {number} [count]
 * @returns {Array<{mes: string, total: number, enRango: boolean}>}
 */
function monthlySeries(rows, desde, hasta, count = 12) {
  const totals = new Map((rows ?? []).map((r) => [String(r.mes), Number(r.total || 0)]));
  const [y, m] = String(hasta).slice(0, 7).split('-').map(Number);
  const inicio = String(desde).slice(0, 7);
  const out = [];
  for (let i = count - 1; i >= 0; i--) {
    const fecha = new Date(y, m - 1 - i, 1);
    const mes = `${fecha.getFullYear()}-${pad(fecha.getMonth() + 1)}`;
    out.push({ mes, total: totals.get(mes) ?? 0, enRango: mes >= inicio });
  }
  return out;
}

/**
 * Short Spanish month name for YYYY-MM.
 * @param {string} mes
 * @returns {string}
 */
function monthLabel(mes) {
  return MESES[Number(String(mes).slice(5, 7)) - 1] ?? '';
}

/**
 * Bar heights as a percent of the largest positive value.
 * @param {number[]} values
 * @returns {number[]}
 */
function barPercents(values) {
  const max = Math.max(0, ...values.map(Number));
  return values.map((v) => (max > 0 && Number(v) > 0 ? Math.round(Number(v) / max * 1000) / 10 : 0));
}

/**
 * How many months at the end of the series have no spending.
 * @param {Array<{total: number}>} series
 * @returns {number}
 */
function trailingEmptyMonths(series) {
  let n = 0;
  for (let i = series.length - 1; i >= 0 && !Number(series[i].total); i--) n++;
  return n;
}

/**
 * Bar value label in millions of pesos.
 * @param {number} value
 * @returns {string}
 */
function valueLabel(value) {
  const v = Number(value || 0);
  if (Math.abs(v) >= 1e6) return Math.round(v / 1e6).toLocaleString('es-CL');
  return v > 0 ? '<1' : '0';
}

/**
 * Positive origins as stacked-bar segments, largest first, with their share.
 * @param {Array<{origen: string, total: number|string, excluido?: boolean}>} origenes
 * @returns {Array<{origen: string, total: number, share: number}>}
 */
function originSegments(origenes) {
  const pos = (origenes ?? [])
    .filter((o) => !o.excluido && Number(o.total) > 0)
    .map((o) => ({ origen: o.origen, total: Number(o.total) }))
    .sort((a, b) => b.total - a.total);
  const sum = pos.reduce((s, o) => s + o.total, 0);
  return pos.map((o) => ({ ...o, share: Math.round(o.total / sum * 1000) / 10 }));
}

/**
 * Allocation of an invoice net across lines: assigned, remaining and segment widths.
 * @param {number|string} neto
 * @param {Array<number|string|null>} amounts
 * @returns {{asignado: number, falta: number, excede: boolean, completo: boolean, segmentos: number[]}}
 */
function allocation(neto, amounts) {
  const total = Number(neto || 0);
  const vals = amounts.map((a) => Math.max(0, Number(a ?? 0) || 0));
  const asignado = vals.reduce((s, v) => s + v, 0);
  const base = Math.max(total, asignado);
  return {
    asignado,
    falta: total - asignado,
    excede: asignado > total,
    completo: total > 0 && asignado === total,
    segmentos: vals.map((v) => (base > 0 ? Math.round(v / base * 1000) / 10 : 0)),
  };
}

const celda = (v) => {
  const s = v == null ? '' : String(v);
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * CSV that Excel opens in Spanish locales: BOM, semicolons, CRLF.
 * @param {string[]} columns
 * @param {Array<Array<unknown>>} rows
 * @returns {string}
 */
function buildCsv(columns, rows) {
  return '﻿' + [columns, ...rows].map((r) => r.map(celda).join(';') + '\r\n').join('');
}

module.exports = {
  allocation, barPercents, buildCsv, isoLocal, monthlySeries, monthLabel, originSegments,
  percentChange, periodPreset, shiftYear, trailingEmptyMonths, valueLabel,
};
