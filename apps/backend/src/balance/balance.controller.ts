import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { BalanceService } from './balance.service';
import { JwtAuthGuard, PermisosGuard, Requiere } from '../comun/permisos.guard';

@Controller('balance')
@UseGuards(JwtAuthGuard, PermisosGuard)
export class BalanceController {
  constructor(private readonly svc: BalanceService) {}

  @Get('ccostos')
  @Requiere('BALANCE_CCOSTO')
  ccostos(@Query('todos') todos?: string) {
    return this.svc.centrosCosto(todos !== 'true');
  }

  @Get('resumen')
  @Requiere('BALANCE_CCOSTO')
  resumen(
    @Query('fini') fini: string,
    @Query('ffin') ffin: string,
    @Query('ccosto') ccosto?: string,
  ) {
    return this.svc.resumen({ fini, ffin, ccosto: ccosto || undefined });
  }

  @Get('origenes')
  @Requiere('BALANCE_CCOSTO')
  origenes(
    @Query('fini') fini: string,
    @Query('ffin') ffin: string,
    @Query('ccosto') ccosto?: string,
  ) {
    return this.svc.porOrigen({ fini, ffin, ccosto: ccosto || undefined });
  }

  @Get('categorias')
  @Requiere('BALANCE_CCOSTO')
  categorias(
    @Query('fini') fini: string,
    @Query('ffin') ffin: string,
    @Query('ccosto') ccosto?: string,
  ) {
    return this.svc.porCategoria({ fini, ffin, ccosto: ccosto || undefined });
  }

  @Get('detalle')
  @Requiere('BALANCE_CCOSTO')
  detalle(
    @Query('fini') fini: string,
    @Query('ffin') ffin: string,
    @Query('ccosto') ccosto?: string,
    @Query('pagina') pagina?: string,
    @Query('limite') limite?: string,
  ) {
    return this.svc.detalle({
      fini, ffin, ccosto: ccosto || undefined,
      pagina: pagina ? Number(pagina) : undefined,
      limite: limite ? Number(limite) : undefined,
    });
  }
}
