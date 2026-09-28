import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../comun/permisos.guard';
import { IntelligenceService } from './inteligencia.service';

export class EcoDto {
  @IsString()
  @IsNotEmpty({ message: 'El mensaje es obligatorio' })
  @MaxLength(500, { message: 'El mensaje no puede superar 500 caracteres' })
  mensaje: string;
}

export class NormalizarDto {
  @IsString()
  @IsNotEmpty({ message: 'La descripcion es obligatoria' })
  @MaxLength(500, { message: 'La descripcion no puede superar 500 caracteres' })
  descripcion: string;
}

@Controller('inteligencia')
@UseGuards(JwtAuthGuard)
export class InteligenciaController {
  constructor(private readonly intelligence: IntelligenceService) {}

  @Get('salud')
  salud() {
    return this.intelligence.salud();
  }

  @Post('eco')
  eco(@Body() dto: EcoDto) {
    return this.intelligence.eco(dto.mensaje);
  }

  @Post('normalizar')
  normalizar(@Body() dto: NormalizarDto) {
    return this.intelligence.normalizar(dto.descripcion);
  }
}
