import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

const almacen = new AsyncLocalStorage<string>();

export function idCorrelacion(): string {
  return almacen.getStore() ?? 'sin-correlacion';
}

export function entrarCorrelacion<T>(id: string, fn: () => T): T {
  return almacen.run(id, fn);
}

/** Acepta un id de cliente solo si es opaco. Cualquier otro valor se reemplaza. */
export function idEntrante(valor: string | undefined): string {
  const limpio = (valor ?? '').trim();
  if (/^[A-Za-z0-9._-]{8,64}$/.test(limpio)) return limpio;
  return randomUUID();
}
