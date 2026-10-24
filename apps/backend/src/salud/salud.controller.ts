import { ApiTags } from '@nestjs/swagger';
import { Controller, Get } from '@nestjs/common';

@ApiTags('health')
@Controller('health')
export class SaludController {
  @Get()
  salud() {
    return { estado: 'ok', servicio: 'erp-backend' };
  }
}
