/**
 * Conteo de la metrica de calidad de datos (#49). Funciones puras: no tocan red ni base.
 *
 * Metrica principal: validos / devueltos por fuente. "Devueltos" son los candidatos que
 * FastAPI entrega en `candidatos` (maximo 5 por fuente y solo con puntaje > 0); "validos" son
 * los que pasan `validaCandidato`, la misma validacion que usa NestJS al guardar.
 * Los `descartados` de FastAPI se suman aparte como contexto: no entran en la tasa.
 */
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { CandidatoDto } from '../../inteligencia/precios.dto';
import { Fuente, urlDeFuente } from '../fuentes/fuentes';

export type Regla = 'esquema' | 'nombre_vacio' | 'url_fuera_de_fuente' | 'oferta_mayor_normal';
export const REGLAS: Regla[] = ['esquema', 'nombre_vacio', 'url_fuera_de_fuente', 'oferta_mayor_normal'];

/** Un elemento de `resultados` de FastAPI, antes de validar sus candidatos. */
export interface ResultadoCrudo { fuente: Fuente; estado: string; candidatos: unknown[]; descartados: number }

export interface ContadorFuente {
  materiales_consultados: number;
  /** Rhona y Sodimac sin URL de listado en el conjunto: no se consultan ni entran en la tasa. */
  sin_url: number;
  errores_lectura: { timeout: number; http_error: number };
  /** Lecturas que entregaron menos paginas de las previstas (Sodimac: timeout a mitad de la lectura). */
  lecturas_parciales: number;
  /** FastAPI inalcanzable, con error o con una respuesta que no cumple el contrato. */
  errores_procesamiento: number;
  invalid_content: number;
  sin_resultados: number;
  devueltos: number;
  validos: number;
  invalidos: Record<Regla, number>;
  descartados_fastapi: number;
  materiales_con_precio: number;
}

export function contadorVacio(): ContadorFuente {
  return {
    materiales_consultados: 0, sin_url: 0, errores_lectura: { timeout: 0, http_error: 0 }, lecturas_parciales: 0, errores_procesamiento: 0,
    invalid_content: 0, sin_resultados: 0, devueltos: 0, validos: 0,
    invalidos: { esquema: 0, nombre_vacio: 0, url_fuera_de_fuente: 0, oferta_mayor_normal: 0 },
    descartados_fastapi: 0, materiales_con_precio: 0,
  };
}

/** Regla del ADR que incumple un candidato; null si es valido. Debe coincidir con `validaCandidato`. */
export function reglaIncumplida(fuente: Fuente, crudo: unknown): Regla | null {
  const c = plainToInstance(CandidatoDto, crudo);
  if (!crudo || typeof crudo !== 'object' || validateSync(c).length) return 'esquema';
  if (!c.nombre.trim()) return 'nombre_vacio';
  if (!urlDeFuente(fuente, c.url)) return 'url_fuera_de_fuente';
  if (c.precio_oferta != null && c.precio_oferta > c.precio_normal) return 'oferta_mayor_normal';
  return null;
}

/** Suma al contador el resultado de una fuente para un material. Devuelve true si dejo al menos un precio valido. */
export function cuentaResultado(c: ContadorFuente, fuente: Fuente, crudo: ResultadoCrudo | undefined): boolean {
  c.descartados_fastapi += crudo?.descartados ?? 0;
  if (!crudo || crudo.estado === 'invalid_content') {
    c.invalid_content++;
    return false;
  }
  if (crudo.estado === 'sin_resultados') {
    c.sin_resultados++;
    return false;
  }
  let validos = 0;
  for (const cand of crudo.candidatos) {
    const regla = reglaIncumplida(fuente, cand);
    c.devueltos++;
    if (regla === null) validos++;
    else c.invalidos[regla]++;
  }
  c.validos += validos;
  if (validos) c.materiales_con_precio++;
  return validos > 0;
}

/** Contador con la tasa de validos; null si la fuente no devolvio ningun registro. */
export function conTasa(c: ContadorFuente) {
  return { ...c, tasa_validos: c.devueltos ? Number((c.validos / c.devueltos).toFixed(4)) : null };
}

/** Cobertura: porcentaje de materiales con al menos un precio valido en alguna fuente. */
export function cobertura(materiales: Array<{ rubro: string; conPrecio: boolean }>) {
  const pct = (con: number, n: number) => (n ? Number(((100 * con) / n).toFixed(1)) : null);
  const por_rubro: Record<string, { materiales: number; con_precio: number; porcentaje: number | null }> = {};
  for (const m of materiales) {
    const r = (por_rubro[m.rubro] ??= { materiales: 0, con_precio: 0, porcentaje: null });
    r.materiales++;
    if (m.conPrecio) r.con_precio++;
  }
  for (const r of Object.values(por_rubro)) r.porcentaje = pct(r.con_precio, r.materiales);
  const con = materiales.filter((m) => m.conPrecio).length;
  return { materiales_evaluados: materiales.length, con_precio: con, porcentaje: pct(con, materiales.length), por_rubro };
}
