import { Body, Controller, Get, Ip, Param, ParseIntPipe, Patch, Put, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard, PermisosGuard, Requiere } from '../comun/permisos.guard';
import { CotizableRespuestaDoc, FuenteUrlRespuestaDoc, RespuestaPreciosDoc, VinculoRespuestaDoc } from '../documentacion/esquemas';
import { ConsultaPreciosService } from './consulta/consulta.service';
import { CambiaVinculoDto, CotizableDto, FuenteUrlDto } from './escritura/escritura.dto';
import { EscrituraPreciosService } from './escritura/escritura.service';

@ApiTags('precios')
@ApiBearerAuth('bearer')
@Controller('precios')
@UseGuards(JwtAuthGuard, PermisosGuard)
export class PreciosController {
  constructor(
    private readonly consulta: ConsultaPreciosService,
    private readonly escritura: EscrituraPreciosService,
  ) {}

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

  @Patch('vinculos/:id')
  @Requiere('MOD_MATERIALES')
  @ApiOperation({ summary: 'Confirma o rechaza un vinculo propuesto (idempotente)' })
  @ApiParam({ name: 'id', example: 12 })
  @ApiOkResponse({ type: VinculoRespuestaDoc })
  @ApiResponse({ status: 400, description: 'estado distinto de confirmado o rechazado' })
  @ApiResponse({ status: 404, description: 'vinculo_not_found' })
  vinculo(@Param('id', ParseIntPipe) id: number, @Body() dto: CambiaVinculoDto, @Req() req: any, @Ip() ip: string) {
    return this.escritura.cambiaVinculo(id, dto, this.ctx(req, ip));
  }

  @Put(':codMaterial/fuente-url')
  @Requiere('MOD_MATERIALES')
  @ApiOperation({ summary: 'Asocia la URL de listado de Rhona o Sodimac a un material' })
  @ApiParam({ name: 'codMaterial', example: 'MC_001' })
  @ApiOkResponse({ type: FuenteUrlRespuestaDoc })
  @ApiResponse({ status: 404, description: 'material_not_found' })
  @ApiResponse({ status: 422, description: 'url_invalid, url_domain_mismatch, url_not_listing o url_blocked_by_robots' })
  fuenteUrl(@Param('codMaterial') codMaterial: string, @Body() dto: FuenteUrlDto, @Req() req: any, @Ip() ip: string) {
    return this.escritura.asociaUrl(codMaterial, dto, this.ctx(req, ip));
  }

  @Put(':codMaterial/cotizable')
  @Requiere('MOD_MATERIALES')
  @ApiOperation({ summary: 'Corrige la marca cotizable; queda definido_por: usuario' })
  @ApiParam({ name: 'codMaterial', example: 'MC_001' })
  @ApiOkResponse({ type: CotizableRespuestaDoc })
  @ApiResponse({ status: 404, description: 'material_not_found' })
  cotizable(@Param('codMaterial') codMaterial: string, @Body() dto: CotizableDto, @Req() req: any, @Ip() ip: string) {
    return this.escritura.defineCotizable(codMaterial, dto, this.ctx(req, ip));
  }

  private ctx(req: any, ip: string) {
    // registro.IP es varchar(15): se quita el prefijo IPv4-mapeado ::ffff:.
    return { usuario: req.user.login, ip: ip.replace(/^::ffff:/, '') };
  }
}
