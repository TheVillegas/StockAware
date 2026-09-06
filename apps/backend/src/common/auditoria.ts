/**
 * Bitácora de transacciones.
 *
 * Réplica de RegistroLOG() del ERP: toda creación, modificación o eliminación
 * hecha por un usuario deja una fila en `registro`. Es requisito contable, no
 * una conveniencia de depuración.
 *
 * Regla de diseño heredada del ERP: lo accesorio no debe poder tumbar una
 * operación. Si la escritura de la bitácora falla, se registra el problema en
 * el log del servicio y la transacción de negocio sigue adelante.
 */
import {
  Global,
  Injectable,
  Logger,
  Module,
  createParamDecorator,
  type ExecutionContext,
} from '@nestjs/common';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Registro } from '../entities/sistema.entity.js';
import { TipoAccion } from '../entities/tipos.js';
import type { UsuarioRequest } from '../auth/jwt.strategy.js';

export interface ContextoAuditoria {
  usuarioId?: number | null;
  ip?: string | null;
}

/**
 * Inyecta quién hizo la operación y desde dónde, para la bitácora.
 *
 *   crear(@Body() dto: X, @Ctx() ctx: ContextoAuditoria) { ... }
 */
export const Ctx = createParamDecorator(
  (_: unknown, ejecucion: ExecutionContext): ContextoAuditoria => {
    const req = ejecucion.switchToHttp().getRequest<{
      user?: UsuarioRequest;
      ip?: string;
    }>();

    // Express entrega ::ffff:127.0.0.1 para IPv4 sobre IPv6; la columna es inet
    // y lo acepta, pero guardarlo limpio hace la bitácora legible.
    const ip = req.ip?.replace(/^::ffff:/, '') ?? null;

    return { usuarioId: req.user?.id ?? null, ip };
  },
);

@Injectable()
export class AuditoriaService {
  private readonly log = new Logger(AuditoriaService.name);

  constructor(
    @InjectRepository(Registro)
    private readonly registros: Repository<Registro>,
  ) {}

  async anotar(
    accion: TipoAccion,
    tabla: string,
    idRegistro: number | null,
    ctx: ContextoAuditoria,
    inf1?: string,
    inf2?: string,
  ): Promise<void> {
    try {
      await this.registros.insert({
        tipoAccion: accion,
        tabla,
        idRegistro,
        usuarioId: ctx.usuarioId ?? null,
        ip: ctx.ip ?? null,
        inf1: inf1?.slice(0, 500) ?? null,
        inf2: inf2?.slice(0, 200) ?? null,
      });
    } catch (e) {
      this.log.error(
        `No se pudo escribir la bitácora (${accion} sobre ${tabla}#${idRegistro}): ` +
          (e instanceof Error ? e.message : String(e)),
      );
    }
  }
}

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Registro])],
  providers: [AuditoriaService],
  exports: [AuditoriaService],
})
export class AuditoriaModule {}
