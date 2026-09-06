/**
 * Paginación compartida por los mantenedores.
 *
 * El ERP pagina con $TAMANO_PAGINACION y un LIMIT calculado a mano en cada
 * pantalla. Aquí es un solo contrato, y la respuesta incluye el total para que
 * el frontend pueda dibujar el paginador sin una segunda consulta.
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min, MaxLength } from 'class-validator';

export class PaginacionDto {
  @ApiPropertyOptional({ default: 1, minimum: 1, description: 'Página, partiendo de 1' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina: number = 1;

  @ApiPropertyOptional({ default: 25, minimum: 1, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limite: number = 25;

  @ApiPropertyOptional({ description: 'Filtro de texto libre sobre los campos descriptivos' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  buscar?: string;
}

export class RespuestaPaginada<T> {
  @ApiProperty({ isArray: true })
  datos: T[];

  @ApiProperty({ description: 'Total de filas que cumplen el filtro' })
  total: number;

  @ApiProperty()
  pagina: number;

  @ApiProperty()
  limite: number;

  @ApiProperty({ description: 'Cantidad de páginas disponibles' })
  paginas: number;
}

export const paginar = <T>(
  datos: T[],
  total: number,
  { pagina, limite }: PaginacionDto,
): RespuestaPaginada<T> => ({
  datos,
  total,
  pagina,
  limite,
  paginas: Math.max(1, Math.ceil(total / limite)),
});
