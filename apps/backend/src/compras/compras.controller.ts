import {
  Body, Controller, Delete, Get, Ip, Param, ParseIntPipe, Post, Put, Query, Req, UseGuards,
} from '@nestjs/common';
import { ComprasService, CrearOcDto, EmitirHesDto } from './compras.service';
import { JwtAuthGuard, PermisosGuard, Requiere } from '../comun/permisos.guard';

@Controller('compras')
@UseGuards(JwtAuthGuard, PermisosGuard)
export class ComprasController {
  constructor(private readonly svc: ComprasService) {}

  @Get('oc')
  @Requiere('CON_DOC_EMI')
  listar(
    @Query('pagina') pagina?: string,
    @Query('limite') limite?: string,
    @Query('estado') estado?: string,
    @Query('buscar') buscar?: string,
  ) {
    return this.svc.listarOc({
      pagina: pagina ? Number(pagina) : undefined,
      limite: limite ? Number(limite) : undefined,
      estado, buscar,
    });
  }

  @Get('oc/:id')
  @Requiere('CON_DOC_EMI')
  obtener(@Param('id', ParseIntPipe) id: number) {
    return this.svc.obtenerOc(id);
  }

  @Get('oc/:numdoc/hes')
  @Requiere('CON_DOC_EMI')
  hes(@Param('numdoc', ParseIntPipe) numdoc: number) {
    return this.svc.hesDeOc(numdoc);
  }

  @Post('oc')
  @Requiere('EMITE_OC')
  crear(@Body() dto: CrearOcDto, @Req() req: any, @Ip() ip: string) {
    return this.svc.crearOc(dto, { usuario: req.user.login, ip });
  }

  @Post('oc/:numdoc/aprobar')
  @Requiere('APRUEBA_ORDEN_COMPRA')
  aprobar(@Param('numdoc', ParseIntPipe) numdoc: number, @Req() req: any, @Ip() ip: string) {
    return this.svc.aprobarOc(numdoc, { usuario: req.user.login, ip });
  }

  @Post('oc/:numdoc/anular')
  @Requiere('ANULAR_ORDEN_COMPRA')
  anular(
    @Param('numdoc', ParseIntPipe) numdoc: number,
    @Body('cliente', ParseIntPipe) cliente: number,
    @Req() req: any, @Ip() ip: string,
  ) {
    return this.svc.anularOc(numdoc, cliente, { usuario: req.user.login, ip });
  }

  @Post('hes')
  @Requiere('EMITE_HES')
  emitirHes(@Body() dto: EmitirHesDto, @Req() req: any, @Ip() ip: string) {
    return this.svc.emitirHes(dto, { usuario: req.user.login, ip });
  }

  @Delete('hes/:numdoc')
  @Requiere('ELIMINA_HES')
  eliminarHes(@Param('numdoc', ParseIntPipe) numdoc: number, @Req() req: any, @Ip() ip: string) {
    return this.svc.eliminarHes(numdoc, { usuario: req.user.login, ip });
  }
}
