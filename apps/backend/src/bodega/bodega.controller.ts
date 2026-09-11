import {
  Body, Controller, Delete, Get, Ip, Param, ParseIntPipe, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import { AjusteDto, BodegaService, CargarHesDto, GrDto } from './bodega.service';
import { JwtAuthGuard, PermisosGuard, Requiere } from '../comun/permisos.guard';

@Controller('bodega')
@UseGuards(JwtAuthGuard, PermisosGuard)
export class BodegaController {
  constructor(private readonly svc: BodegaService) {}

  @Get('stock')
  @Requiere('MATERIAL_X_BODEGA')
  stock(
    @Query('bodega') bodega?: string,
    @Query('buscar') buscar?: string,
    @Query('bajoMinimo') bajoMinimo?: string,
  ) {
    return this.svc.stock({
      bodega: bodega ? Number(bodega) : undefined,
      buscar, bajoMinimo: bajoMinimo === 'true',
    });
  }

  @Get('movimientos')
  @Requiere('BODEGA_MOVIMIENTOS')
  movimientos(
    @Query('bodega') bodega?: string,
    @Query('tipo_vhe') tipo_vhe?: string,
    @Query('id_vhe') id_vhe?: string,
    @Query('pagina') pagina?: string,
    @Query('limite') limite?: string,
  ) {
    return this.svc.movimientos({
      bodega: bodega ? Number(bodega) : undefined,
      tipo_vhe, id_vhe,
      pagina: pagina ? Number(pagina) : undefined,
      limite: limite ? Number(limite) : undefined,
    });
  }

  @Get('bodegas')
  @Requiere('MATERIAL_X_BODEGA')
  bodegas() { return this.svc.bodegas(); }

  @Get('tipos-vhe')
  @Requiere('BODEGA_MOVIMIENTOS')
  tipos() { return this.svc.tiposVhe(); }

  @Get('items')
  @Requiere('MATERIAL_X_BODEGA')
  items(
    @Query('tipo_vhe') tipo_vhe: string,
    @Query('q') q?: string,
    @Query('bodega') bodega?: string,
  ) {
    return this.svc.buscarItems(tipo_vhe, q ?? '', bodega ? Number(bodega) : undefined);
  }

  /** Las lineas de una HES con su codigo de material ya resuelto. */
  @Get('hes/:numdoc')
  @Requiere('ING_MATERIAL')
  lineasHes(@Param('numdoc', ParseIntPipe) numdoc: number) {
    return this.svc.lineasDeHes(numdoc);
  }

  @Post('cargar-hes')
  @Requiere('ING_MATERIAL')
  cargar(@Body() dto: CargarHesDto, @Req() req: any, @Ip() ip: string) {
    return this.svc.cargarDesdeHes(dto, this.ctx(req, ip));
  }

  @Post('gr')
  @Requiere('ENTREGA_MAT')
  gr(@Body() dto: GrDto, @Req() req: any, @Ip() ip: string) {
    return this.svc.emitirGr(dto, this.ctx(req, ip));
  }

  @Post('ajuste')
  // AJUSTE_STK_MAT no existe en acceso_funciones: es un caso del despachador
  // que se abre desde la pantalla de stock, asi que hereda su permiso.
  @Requiere('MATERIAL_X_BODEGA')
  ajustar(@Body() dto: AjusteDto, @Req() req: any, @Ip() ip: string) {
    return this.svc.ajustar(dto, this.ctx(req, ip));
  }

  @Delete('movimientos/:id')
  @Requiere('ELIMINA_MOV_BODEGA')
  eliminar(@Param('id', ParseIntPipe) id: number, @Req() req: any, @Ip() ip: string) {
    return this.svc.eliminarMovimiento(id, this.ctx(req, ip));
  }

  private ctx(req: any, ip: string) {
    return { usuario: req.user.login, ip, idUsuario: req.user.id_usuario };
  }
}
