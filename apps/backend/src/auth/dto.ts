import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin', description: 'Nombre de usuario' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  username: string;

  @ApiProperty({ example: 'stockaware', description: 'Contraseña' })
  @IsString()
  @IsNotEmpty()
  @MinLength(4)
  @MaxLength(128)
  password: string;
}

export class UsuarioAutenticadoDto {
  @ApiProperty() id: number;
  @ApiProperty() username: string;
  @ApiProperty() nombre: string;
  @ApiProperty() email: string;
  @ApiProperty({ description: 'Glosa del perfil asignado' }) perfil: string;
  @ApiProperty({
    type: [String],
    description: 'Glosas de las funciones sobre las que el perfil tiene permiso',
  })
  permisos: string[];
}

export class LoginRespuestaDto {
  @ApiProperty({ description: 'Token JWT, se envía como Bearer' })
  access_token: string;

  @ApiProperty({ type: UsuarioAutenticadoDto })
  usuario: UsuarioAutenticadoDto;
}
