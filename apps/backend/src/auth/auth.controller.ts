import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { AuthService } from './auth.service.js';
import { LoginDto, LoginRespuestaDto, UsuarioAutenticadoDto } from './dto.js';
import { JwtAuthGuard } from '../common/permisos.js';
import type { UsuarioRequest } from './jwt.strategy.js';

@ApiTags('Autenticación')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Inicia sesión y devuelve un token JWT' })
  @ApiOkResponse({ type: LoginRespuestaDto })
  @ApiUnauthorizedResponse({ description: 'Credenciales inválidas' })
  login(@Body() dto: LoginDto): Promise<LoginRespuestaDto> {
    return this.auth.login(dto.username, dto.password);
  }

  @Get('perfil')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Datos y permisos del usuario autenticado' })
  @ApiOkResponse({ type: UsuarioAutenticadoDto })
  async perfil(
    @Req() req: { user: UsuarioRequest },
  ): Promise<UsuarioAutenticadoDto> {
    const usuario = await this.auth.porId(req.user.id);
    return this.auth.aDto(usuario!, req.user.permisos);
  }
}
