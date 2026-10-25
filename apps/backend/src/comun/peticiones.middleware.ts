/**
 * Registra cada peticion que entra. Es andamiaje de desarrollo: sirve para
 * distinguir "el navegador no pidio nada" de "pidio y fallo", que desde el
 * servidor no se puede diferenciar de otra forma.
 */
import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

import { entrarCorrelacion, idEntrante } from './correlacion';
import { registro } from './registro';

@Injectable()
export class PeticionesMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const inicio = Date.now();
    const id = idEntrante(req.header('x-request-id'));
    res.setHeader('x-request-id', id);
    entrarCorrelacion(id, () => {
      res.on('finish', () => {
        registro({
          nivel: 'info',
          evento: 'peticion',
          correlation_id: id,
          method: req.method,
          path: req.path,
          status: res.statusCode,
          duration_ms: Date.now() - inicio,
        });
      });
      next();
    });
  }
}
