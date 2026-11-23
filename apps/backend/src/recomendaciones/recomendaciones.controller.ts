import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiParam, ApiResponse, ApiTags,
} from '@nestjs/swagger';

import { JwtAuthGuard, PermisosGuard, Requiere } from '../comun/permisos.guard';
import { DecisionCreadaDoc, RespuestaRecomendacionesDoc } from '../documentacion/esquemas';
import { ConsultaRecomendacionesDto, DecisionDto } from './recomendaciones.dto';
import { RecomendacionesService } from './recomendaciones.service';

@ApiTags('recomendaciones')
@ApiBearerAuth('bearer')
@Controller('recomendaciones')
@UseGuards(JwtAuthGuard, PermisosGuard)
export class RecomendacionesController {
  constructor(private readonly svc: RecomendacionesService) {}

  @Get()
  @Requiere('RECOMENDACIONES')
  @ApiOperation({ summary: 'Materiales de una bodega ordenados por prioridad de reposicion, con sus razones' })
  @ApiOkResponse({
    type: RespuestaRecomendacionesDoc,
    description: 'Con degradado: true el motor no respondio y el orden es el de la regla base',
  })
  @ApiResponse({ status: 400, description: 'bodega ausente o no es un entero positivo, o modo distinto de adaptativo|base' })
  @ApiResponse({ status: 403, description: 'El perfil no tiene la funcion RECOMENDACIONES' })
  listar(@Query() q: ConsultaRecomendacionesDto, @Req() req: any) {
    return this.svc.listar(q, req.user.id_usuario);
  }

  @Post(':id/decision')
  @Requiere('RECOMENDACIONES')
  @ApiOperation({ summary: 'Registra lo que la persona decidio sobre una recomendacion' })
  @ApiParam({ name: 'id', example: 'rec_123' })
  @ApiCreatedResponse({ type: DecisionCreadaDoc })
  @ApiResponse({ status: 400, description: 'decision invalida, cantidad faltante con ajustada o negativa, o motivo de mas de 500 caracteres' })
  @ApiResponse({ status: 403, description: 'El perfil no tiene la funcion RECOMENDACIONES' })
  @ApiResponse({ status: 404, description: 'recommendation_not_found' })
  decidir(@Param('id') id: string, @Body() dto: DecisionDto, @Req() req: any) {
    return this.svc.decidir(id, dto, req.user.id_usuario);
  }
}
