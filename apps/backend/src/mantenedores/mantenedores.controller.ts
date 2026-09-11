import {
  Body, Controller, Get, Ip, Param, Put, Query, Req, UseGuards,
} from '@nestjs/common';
import { MantenedoresService } from './mantenedores.service';
import { JwtAuthGuard, PermisosGuard } from '../comun/permisos.guard';

@Controller('mantenedores')
@UseGuards(JwtAuthGuard, PermisosGuard)
export class MantenedoresController {
  constructor(private readonly svc: MantenedoresService) {}

  @Get()
  disponibles(@Req() req: any) {
    return this.svc.disponibles(req.user.permisos ?? []);
  }

  @Get(':codigo')
  listar(
    @Param('codigo') codigo: string,
    @Req() req: any,
    @Query('pagina') pagina?: string,
    @Query('limite') limite?: string,
    @Query('buscar') buscar?: string,
  ) {
    return this.svc.listar(codigo, req.user.permisos ?? [], {
      pagina: pagina ? Number(pagina) : undefined,
      limite: limite ? Number(limite) : undefined,
      buscar,
    });
  }

  @Get(':codigo/:id')
  obtener(@Param('codigo') codigo: string, @Param('id') id: string) {
    return this.svc.obtener(codigo, id);
  }

  @Put(':codigo/:id')
  actualizar(
    @Param('codigo') codigo: string,
    @Param('id') id: string,
    @Body() cambios: Record<string, unknown>,
    @Req() req: any,
    @Ip() ip: string,
  ) {
    return this.svc.actualizar(codigo, id, cambios, { usuario: req.user.login, ip });
  }
}
