/**
 * Registra cada peticion que entra. Es andamiaje de desarrollo: sirve para
 * distinguir "el navegador no pidio nada" de "pidio y fallo", que desde el
 * servidor no se puede diferenciar de otra forma.
 */
import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

@Injectable()
export class PeticionesMiddleware implements NestMiddleware {
  private readonly log = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction): void {
    const inicio = Date.now();
    res.on('finish', () => {
      this.log.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - inicio}ms)`);
    });
    next();
  }
}
