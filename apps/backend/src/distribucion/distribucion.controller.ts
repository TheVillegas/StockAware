import {
  Body, Controller, Delete, Get, Ip, Param, ParseIntPipe, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import { DistribucionService, DistribuirDto } from './distribucion.service';
import { JwtAuthGuard, PermisosGuard, Requiere } from '../comun/permisos.guard';

@Controller('distribucion')
@UseGuards(JwtAuthGuard, PermisosGuard)
export class DistribucionController {
  constructor(private readonly svc: DistribucionService) {}

  @Get()
  @Requiere('DOC_DISTRIBUIR')
  listar(
    @Query('pagina') pagina?: string,
    @Query('limite') limite?: string,
    @Query('estado') estado?: string,
    @Query('buscar') buscar?: string,
  ) {
    return this.svc.listar({
      pagina: pagina ? Number(pagina) : undefined,
      limite: limite ? Number(limite) : undefined,
      estado, buscar,
    });
  }

  @Get(':id')
  @Requiere('DOC_DISTRIBUIR')
  obtener(@Param('id', ParseIntPipe) id: number) {
    return this.svc.obtener(id);
  }

  @Post(':id')
  @Requiere('DOC_DISTRIBUIR')
  distribuir(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DistribuirDto,
    @Req() req: any, @Ip() ip: string,
  ) {
    return this.svc.distribuir(id, dto, { usuario: req.user.login, ip });
  }

  @Delete(':id')
  @Requiere('DOC_DISTRIBUIR')
  deshacer(@Param('id', ParseIntPipe) id: number, @Req() req: any, @Ip() ip: string) {
    return this.svc.deshacer(id, { usuario: req.user.login, ip });
  }
}
