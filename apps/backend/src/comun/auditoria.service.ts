/**
 * Registro contable de transacciones.
 *
 * El ERP exige que toda creacion, modificacion o eliminacion quede anotada en
 * la tabla `registro`. Esto es el equivalente de RegistroLOG() de DLL.php.
 *
 * Nunca debe tumbar la operacion que audita: si el insert falla, se traga el
 * error y se sigue. Perder una linea de bitacora es malo; perder la
 * transaccion del usuario es peor.
 */
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Registro } from '../entidades/acceso.entity';

export interface DatosAuditoria {
  usuario: string;
  tipo_accion: string;
  tabla_accion?: string;
  id_registro?: number;
  inf_1?: string;
  inf_2?: string;
  qstring?: string;
  IP?: string;
}

@Injectable()
export class AuditoriaService {
  private readonly log = new Logger(AuditoriaService.name);

  constructor(
    @InjectRepository(Registro) private readonly repo: Repository<Registro>,
  ) {}

  async anotar(d: DatosAuditoria): Promise<void> {
    try {
      await this.repo.insert({
        fecha: new Date(),
        usuario: d.usuario ?? '',
        tipo_accion: d.tipo_accion,
        tabla_accion: d.tabla_accion ?? '',
        id_registro: d.id_registro ?? 0,
        inf_1: d.inf_1 ?? '',
        inf_2: d.inf_2 ?? '',
        qstring: d.qstring ?? '',
        IP: d.IP ?? '',
      });
    } catch (e) {
      this.log.error(`No se pudo anotar en registro: ${(e as Error).message}`);
    }
  }
}
