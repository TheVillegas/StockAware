/**
 * Validacion de lo que devuelve FastAPI en /v1/precios/* (ADR 0002, "Contrato").
 *
 * - Respuesta completa invalida: lanza ErrorFormato y el servicio responde intelligence_error.
 * - Registro invalido: se descarta y se cuenta; si todos los de una fuente lo son, la fuente
 *   queda en invalid_content.
 * La procedencia (URL consultada, hora, estado HTTP) la pone NestJS: no se lee de aqui.
 */
import { plainToInstance } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, Min, MinLength, validateSync } from 'class-validator';

import { FUENTES, Fuente, urlDeFuente } from '../precios/fuentes/fuentes';

export class ErrorFormato extends Error {}

export class PreparacionDto {
  @IsString() termino_busqueda: string;
  @IsBoolean() cotizable: boolean;
  @IsOptional() @IsIn(['personalizado', 'sin_termino']) motivo?: string | null;
}

export class CandidatoDto {
  @IsString() @MinLength(1) id_externo: string;
  @IsString() @MinLength(1) nombre: string;
  @IsOptional() @IsString() marca?: string | null;
  @IsOptional() @IsString() ean?: string | null;
  @IsOptional() @IsString() categoria_fuente?: string | null;
  @IsInt() @Min(1) precio_normal: number;
  @IsOptional() @IsInt() @Min(1) precio_oferta?: number | null;
  @IsBoolean() disponible: boolean;
  @IsString() url: string;
  @IsOptional() @IsNumber() @Min(0) @Max(1) puntaje?: number;
}

class ResultadoDto {
  @IsIn(FUENTES) fuente: Fuente;
  @IsIn(['ok', 'sin_resultados', 'invalid_content']) estado: string;
  @IsArray() candidatos: unknown[];
  @IsInt() @Min(0) descartados: number;
}

export type Candidato = Omit<CandidatoDto, 'ean' | 'puntaje'> & { ean: string | null; puntaje: number };
export interface ResultadoFuente {
  fuente: Fuente;
  estado: 'ok' | 'sin_resultados' | 'invalid_content';
  candidatos: Candidato[];
  /** Registros que NestJS descarto por no cumplir las reglas del ADR. */
  invalidos: number;
}

export function validaPreparacion(json: unknown): PreparacionDto {
  const dto = plainToInstance(PreparacionDto, json);
  if (!json || typeof json !== 'object' || validateSync(dto).length || (dto.cotizable && !dto.termino_busqueda)) {
    throw new ErrorFormato('preparar');
  }
  return dto;
}

/** Una entrada por fuente pedida; las que FastAPI no devolvio quedan invalid_content. */
export function validaProcesamiento(json: unknown, pedidas: Fuente[]): ResultadoFuente[] {
  const lista = (json as { resultados?: unknown })?.resultados;
  if (!Array.isArray(lista)) throw new ErrorFormato('procesar');
  const resultados = lista.map((r) => {
    const dto = plainToInstance(ResultadoDto, r);
    if (!r || typeof r !== 'object' || validateSync(dto).length) throw new ErrorFormato('procesar');
    return dto;
  });
  return pedidas.map((fuente) => {
    const r = resultados.find((x) => x.fuente === fuente);
    if (!r || r.estado !== 'ok') {
      return { fuente, estado: r?.estado === 'sin_resultados' ? 'sin_resultados' : 'invalid_content', candidatos: [], invalidos: 0 };
    }
    const candidatos = r.candidatos.map((c) => validaCandidato(fuente, c)).filter((c): c is Candidato => c !== null);
    const invalidos = r.candidatos.length - candidatos.length;
    const estado = candidatos.length ? 'ok' : invalidos ? 'invalid_content' : 'sin_resultados';
    return { fuente, estado, candidatos, invalidos };
  });
}

/** Reglas por registro del ADR; null si no las cumple. Un EAN que no tiene 8 o 13 digitos pasa a null. */
export function validaCandidato(fuente: Fuente, crudo: unknown): Candidato | null {
  const c = plainToInstance(CandidatoDto, crudo);
  if (!crudo || typeof crudo !== 'object' || validateSync(c).length) return null;
  if (!c.nombre.trim() || !urlDeFuente(fuente, c.url)) return null;
  if (c.precio_oferta != null && c.precio_oferta > c.precio_normal) return null;
  return {
    ...c,
    marca: c.marca ?? null,
    categoria_fuente: c.categoria_fuente ?? null,
    precio_oferta: c.precio_oferta ?? null,
    ean: c.ean && /^(\d{8}|\d{13})$/.test(c.ean) ? c.ean : null,
    puntaje: c.puntaje ?? 0,
  };
}
