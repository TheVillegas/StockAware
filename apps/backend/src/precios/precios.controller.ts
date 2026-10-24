import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard, PermisosGuard, Requiere } from '../comun/permisos.guard';
import { RespuestaPreciosDoc } from '../documentacion/esquemas';
import { ConsultaPreciosService } from './consulta/consulta.service';

@ApiTags('precios')
@ApiBearerAuth('bearer')
@Controller('precios')
@UseGuards(JwtAuthGuard, PermisosGuard)
export class PreciosController {
  constructor(private readonly consulta: ConsultaPreciosService) {}

  @Get(':codMaterial')
  @Requiere('MATERIAL_X_BODEGA')
  @ApiOperation({ summary: 'Precios de mercado de un material, por fuente' })
  @ApiParam({ name: 'codMaterial', example: 'MC_001' })
  @ApiOkResponse({ type: RespuestaPreciosDoc, description: 'Precios vigentes o desactualizados, o cotizable: false' })
  @ApiResponse({ status: 404, description: 'material_not_found' })
  @ApiResponse({ status: 502, description: 'sources_unavailable, intelligence_unreachable o intelligence_error: la actualizacion fallo y no hay nada guardado' })
  precios(@Param('codMaterial') codMaterial: string) {
    return this.consulta.consulta(codMaterial);
  }
}
