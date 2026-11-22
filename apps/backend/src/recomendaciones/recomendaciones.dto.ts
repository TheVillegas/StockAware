import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min, MaxLength, ValidateIf } from 'class-validator';

export const MODOS = ['adaptativo', 'base'] as const;
export type Modo = (typeof MODOS)[number];

export const DECISIONES = ['aceptada', 'ajustada', 'rechazada'] as const;
export type Decision = (typeof DECISIONES)[number];

export class ConsultaRecomendacionesDto {
  @ApiProperty({ example: 1, description: 'Id de la bodega (el mismo que el selector de stock)' })
  @Type(() => Number) @IsInt() @Min(1) bodega: number;

  @ApiPropertyOptional({ enum: MODOS, default: 'adaptativo' })
  @IsOptional() @IsIn(MODOS) modo?: Modo = 'adaptativo';
}

export class DecisionDto {
  @ApiProperty({ enum: DECISIONES })
  @IsIn(DECISIONES) decision: Decision;

  @ApiPropertyOptional({ example: 100, minimum: 0, description: 'Obligatoria con decision ajustada' })
  // Obligatoria al ajustar; en las otras decisiones es opcional, pero si viene debe ser valida.
  @ValidateIf((o: DecisionDto) => o.decision === 'ajustada' || (o.cantidad !== undefined && o.cantidad !== null))
  @IsInt() @Min(0) cantidad?: number;

  @ApiPropertyOptional({ example: 'Se compra por otro proveedor', maxLength: 500 })
  @IsOptional() @IsString() @MaxLength(500) motivo?: string;
}
