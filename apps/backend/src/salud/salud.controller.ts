import { ApiTags } from '@nestjs/swagger';
import { Controller, Get, HttpException, Inject } from '@nestjs/common';

import { SondaPostgres } from './sonda';

@ApiTags('health')
@Controller('health')
export class SaludController {
  constructor(@Inject(SondaPostgres) private readonly sonda: SondaPostgres) {}

  @Get()
  async salud() {
    let postgres = false;
    try {
      postgres = await this.sonda.comprobar();
    } catch {
      postgres = false;
    }
    const cuerpo = {
      estado: postgres ? 'ok' : 'error',
      servicio: 'erp-backend',
      postgres: postgres ? 'ok' : 'error',
      version: process.env.RENDER_GIT_COMMIT || 'local',
    };
    if (!postgres) throw new HttpException(cuerpo, 503);
    return cuerpo;
  }
}
