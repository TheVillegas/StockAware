import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class SaludController {
  @Get()
  salud() {
    return { estado: 'ok', servicio: 'erp-backend' };
  }
}
