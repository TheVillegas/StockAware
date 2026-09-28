/**
 * Cliente HTTP real del hop Nest → FastAPI.
 *
 * No hay stub: si intelligence-service no responde, el ERP falla de forma
 * controlada (502) en vez de inventar un eco. El timeout corto evita que un
 * FastAPI colgado deje colgada la replica.
 */
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const TIMEOUT_MS = 3_000;

@Injectable()
export class IntelligenceService {
  constructor(private readonly config: ConfigService) {}

  salud() {
    return this.pedir('/health', { method: 'GET' });
  }

  eco(mensaje: string) {
    return this.pedir('/v1/echo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mensaje }),
    });
  }

  normalizar(descripcion: string) {
    return this.pedir('/v1/materiales/normalizar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ descripcion }),
    });
  }

  private base(): string {
    return (this.config.get<string>('INTELLIGENCE_SERVICE_URL') ?? '').replace(/\/$/, '');
  }

  private async pedir(ruta: string, init: RequestInit) {
    let respuesta: Response;
    try {
      respuesta = await fetch(`${this.base()}${ruta}`, {
        ...init,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw new HttpException(
        { error: 'intelligence_unreachable' },
        HttpStatus.BAD_GATEWAY,
      );
    }

    if (respuesta.status === 422) {
      throw new HttpException(
        { error: 'invalid_request' },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    if (!respuesta.ok) {
      throw new HttpException(
        { error: 'intelligence_error' },
        HttpStatus.BAD_GATEWAY,
      );
    }

    try {
      return await respuesta.json();
    } catch {
      throw new HttpException(
        { error: 'intelligence_error' },
        HttpStatus.BAD_GATEWAY,
      );
    }
  }
}
