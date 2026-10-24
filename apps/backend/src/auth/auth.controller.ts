import { Body, Controller, Get, Ip, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../comun/permisos.guard';
import { AuditoriaService } from '../comun/auditoria.service';

export class LoginDto {
  @ApiProperty({ example: 'usuario.demo' })
  @IsString() @IsNotEmpty({ message: 'El usuario es obligatorio' })
  user: string;

  @ApiProperty({ example: 'clave-de-ejemplo' })
  @IsString() @IsNotEmpty({ message: 'La clave es obligatoria' })
  clave: string;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly auditoria: AuditoriaService,
  ) {}

  @Post('login')
  entrar(@Body() dto: LoginDto, @Ip() ip: string) {
    return this.auth.entrar(dto.user, dto.clave, ip);
  }

  /** Devuelve la sesion vigente; sirve para revalidar el token al recargar. */
  @ApiBearerAuth('bearer')
  @Get('sesion')
  @UseGuards(JwtAuthGuard)
  sesion(@Req() req: any) {
    return req.user;
  }

  @ApiBearerAuth('bearer')
  @Post('salir')
  @UseGuards(JwtAuthGuard)
  async salir(@Req() req: any, @Ip() ip: string) {
    await this.auditoria.anotar({
      usuario: req.user.login, tipo_accion: 'LOGOUT', IP: ip,
    });
    return { mensaje: 'Sesión cerrada' };
  }
}
