/**
 * Traduce los errores de restricción de PostgreSQL a respuestas HTTP con
 * sentido.
 *
 * Sin esto, intentar crear un material con un código que ya existe devuelve un
 * 500 y el cliente no puede distinguir "te equivocaste" de "el servidor se
 * cayó". Las restricciones de la base son parte del contrato del modelo —el
 * UNIQUE que el ERP no tenía, los CHECK del avance, las llaves foráneas—, así
 * que violarlas es un error del que llama, no una falla.
 */
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { QueryFailedError } from 'typeorm';

/** Códigos SQLSTATE que nos interesa traducir. */
const CODIGOS: Record<string, { estado: number; mensaje: string }> = {
  '23505': {
    estado: HttpStatus.CONFLICT,
    mensaje: 'Ya existe un registro con ese valor único',
  },
  '23503': {
    estado: HttpStatus.BAD_REQUEST,
    mensaje: 'La referencia apunta a un registro que no existe',
  },
  '23514': {
    estado: HttpStatus.BAD_REQUEST,
    mensaje: 'Los datos no cumplen una restricción del modelo',
  },
  '23502': {
    estado: HttpStatus.BAD_REQUEST,
    mensaje: 'Falta un campo obligatorio',
  },
  '22P02': {
    estado: HttpStatus.BAD_REQUEST,
    mensaje: 'Un valor tiene un formato inválido para su tipo',
  },
};

interface ErrorPg {
  code?: string;
  detail?: string;
  constraint?: string;
}

@Catch(QueryFailedError)
export class ErroresBdFilter implements ExceptionFilter {
  private readonly log = new Logger(ErroresBdFilter.name);

  catch(excepcion: QueryFailedError, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const causa = excepcion.driverError as ErrorPg | undefined;
    const codigo = causa?.code;
    const conocido = codigo ? CODIGOS[codigo] : undefined;

    if (!conocido) {
      // No sabemos qué es: se trata como falla del servidor y se registra
      // completo, porque es un caso que hay que ir a mirar.
      this.log.error(`Error de base no contemplado: ${excepcion.message}`);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        error: 'Internal Server Error',
        message: 'Error al acceder a la base de datos',
      });
      return;
    }

    res.status(conocido.estado).json({
      statusCode: conocido.estado,
      error: conocido.estado === HttpStatus.CONFLICT ? 'Conflict' : 'Bad Request',
      message: conocido.mensaje,
      // `detail` de PostgreSQL dice exactamente qué colisionó
      // ("Key (cod_material)=(MC_001) already exists"), que es justo lo que el
      // usuario necesita para corregir.
      detalle: causa?.detail ?? undefined,
      restriccion: causa?.constraint ?? undefined,
    });
  }
}
