import { Body, Controller, Get, Ip, Post, Req, UseGuards } from '@nestjs/common';
import { IsNotEmpty, IsString } from 'class-validator';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../comun/permisos.guard';
import { AuditoriaService } from '../comun/auditoria.service';

export class LoginDto {
  @IsString() @IsNotEmpty({ message: 'El usuario es obligatorio' })
  user: string;

  @IsString() @IsNotEmpty({ message: 'La clave es obligatoria' })
  clave: string;
}

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
  @Get('sesion')
  @UseGuards(JwtAuthGuard)
  sesion(@Req() req: any) {
    return req.user;
  }

  @Post('salir')
  @UseGuards(JwtAuthGuard)
  async salir(@Req() req: any, @Ip() ip: string) {
    await this.auditoria.anotar({
      usuario: req.user.login, tipo_accion: 'LOGOUT', IP: ip,
    });
    return { mensaje: 'Sesión cerrada' };
  }
}
