/**
 * Contrato del salto Nest -> FastAPI en POST /v1/recomendaciones/ranking.
 *
 * La entrada la arma NestJS (un item por material de la bodega). La respuesta se valida antes de
 * usarla: si el formato no cumple, o si FastAPI devuelve otros materiales que los pedidos, se
 * lanza ErrorFormato y el servicio responde intelligence_error (que la recomendacion degrada).
 */
import { plainToInstance, Type } from 'class-transformer';
import { IsArray, IsInt, IsNumber, IsString, Max, Min, ValidateNested, validateSync } from 'class-validator';

import { ErrorFormato } from './precios.dto';

export interface EntradaRanking {
  cod_material: string;
  stock: number | null;
  stock_minimo: number | null;
  consumo_diario: number | null;
  consumo_reciente: number | null;
  ultimo_precio: number | null;
  precio_externo: number | null;
  precio_externo_obtenido_en: string | null;
}

export class RazonRankingDto {
  @IsString() factor: string;
  @IsNumber() valor: number;
  @IsNumber() peso: number;
  @IsString() texto: string;
}

export class ItemRankingDto {
  @IsString() cod_material: string;
  @IsNumber() @Min(0) @Max(1) puntaje: number;
  @IsInt() @Min(0) cantidad_sugerida: number;
  @IsArray() @ValidateNested({ each: true }) @Type(() => RazonRankingDto) razones: RazonRankingDto[];
  @IsArray() @IsString({ each: true }) factores_faltantes: string[];
}

class RankingDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => ItemRankingDto) items: ItemRankingDto[];
}

/** Items en el orden de FastAPI; deben ser exactamente los materiales pedidos, una vez cada uno. */
export function validaRanking(json: unknown, pedidos: string[]): ItemRankingDto[] {
  if (!json || typeof json !== 'object') throw new ErrorFormato('ranking');
  const dto = plainToInstance(RankingDto, json);
  if (!Array.isArray(dto.items) || dto.items.some((i) => !i || typeof i !== 'object') || validateSync(dto).length) {
    throw new ErrorFormato('ranking');
  }
  const devueltos = new Set(dto.items.map((i) => i.cod_material));
  if (devueltos.size !== dto.items.length || dto.items.length !== pedidos.length || pedidos.some((c) => !devueltos.has(c))) {
    throw new ErrorFormato('ranking');
  }
  return dto.items;
}
