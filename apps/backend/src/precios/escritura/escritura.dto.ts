import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class CambiaVinculoDto {
  @ApiProperty({ enum: ['confirmado', 'rechazado'] })
  @IsIn(['confirmado', 'rechazado']) estado: 'confirmado' | 'rechazado';
}

export class FuenteUrlDto {
  @ApiProperty({ enum: ['rhona', 'sodimac'] })
  @IsIn(['rhona', 'sodimac']) fuente: 'rhona' | 'sodimac';

  @ApiProperty({ example: 'https://www.sodimac.cl/sodimac-cl/category/scat955562/interruptores', description: 'URL de listado de categoria, https y del dominio de la fuente' })
  @IsString() @MaxLength(500) url: string;
}

export class CotizableDto {
  @ApiProperty({ example: false }) @IsBoolean() cotizable: boolean;

  @ApiPropertyOptional({ example: 'servicio', description: 'Hasta 100 caracteres; por defecto definido_por_usuario' })
  @IsOptional() @IsString() @MaxLength(100) motivo?: string;
}
