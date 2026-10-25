import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { MenuService } from './menu.service';
import { JwtAuthGuard } from '../comun/permisos.guard';

@ApiTags('menu')
@ApiBearerAuth('bearer')
@Controller('menu')
@UseGuards(JwtAuthGuard)
export class MenuController {
  constructor(private readonly menu: MenuService) {}

  @Get()
  armar(@Req() req: any) {
    return this.menu.armar(req.user.permisos ?? []);
  }
}
