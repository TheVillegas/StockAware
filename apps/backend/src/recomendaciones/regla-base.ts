/**
 * Regla base de reposicion (S7): copia fiel de apps/frontend/src/app/shared/consulta.js
 * (sortByStockRisk, suggestedOrderQty, restockQuantity) y de bodega/stock-state.js.
 * El modo `base` y la degradacion devuelven exactamente esto.
 */
export type EstadoStock = 'crit' | 'warn' | 'ok';

/** Dias de consumo que cubre un pedido de reposicion (DIAS_PEDIDO del frontend). */
export const DIAS_PEDIDO = 30;

const RIESGO: Record<EstadoStock, number> = { crit: 0, warn: 1, ok: 2 };

/** crit = stock cero o negativo, warn = bajo el minimo, ok = el resto (stock nulo cuenta como ok). */
export function estadoStock(stock: number | null | undefined, minimo: number | null | undefined): EstadoStock {
  if (stock === null || stock === undefined || !Number.isFinite(Number(stock))) return 'ok';
  const s = Number(stock);
  if (s <= 0) return 'crit';
  if (minimo !== null && minimo !== undefined && Number.isFinite(Number(minimo)) && s < Number(minimo)) return 'warn';
  return 'ok';
}

/** Unidades para volver al minimo. */
function reponerMinimo(stock: number | null, minimo: number | null): number {
  if (minimo === null || minimo === undefined || !Number.isFinite(Number(minimo))) return 0;
  return Math.max(0, Number(minimo) - Number(stock || 0));
}

/** Unidades enteras a pedir: lo mayor entre llegar al minimo y cubrir DIAS_PEDIDO de consumo. */
export function cantidadSugerida(stock: number | null, minimo: number | null, consumoDiario: number | null | undefined): number {
  const uso = Number(consumoDiario);
  const paraUso = Number.isFinite(uso) && uso > 0 ? uso * DIAS_PEDIDO - Number(stock || 0) : 0;
  return Math.max(0, Math.ceil(Math.max(reponerMinimo(stock, minimo), paraUso)));
}

/** Ordena por riesgo (crit, warn, ok); estable respecto del orden de entrada y sin mutar la lista. */
export function ordenaPorRiesgo<T extends { stock: number | null; stock_minimo: number | null }>(filas: T[]): T[] {
  return filas
    .map((fila, indice) => ({ fila, indice, riesgo: RIESGO[estadoStock(fila.stock, fila.stock_minimo)] }))
    .sort((a, b) => a.riesgo - b.riesgo || a.indice - b.indice)
    .map(({ fila }) => fila);
}
