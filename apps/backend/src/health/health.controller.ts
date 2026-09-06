import { Controller, Get, Redirect } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

interface Salud {
  estado: 'ok' | 'degradado';
  servicio: string;
  version: string;
  hora: string;
  base_datos: {
    conectada: boolean;
    latencia_ms: number | null;
    detalle?: string;
  };
}

@ApiTags('Sistema')
@Controller()
export class HealthController {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  /** Abrir el puerto en el navegador lleva a la documentación. */
  @Get('/')
  @Redirect('/docs', 302)
  @ApiExcludeEndpoint()
  raiz(): void {}

  @Get('health')
  @ApiOperation({
    summary: 'Estado del servicio y de su conexión a la base de datos',
  })
  async health(): Promise<Salud> {
    const inicio = Date.now();
    let conectada = false;
    let detalle: string | undefined;

    // La caída de la base no debe tumbar el endpoint: para eso existe.
    try {
      await this.ds.query('SELECT 1');
      conectada = true;
    } catch (e) {
      detalle = e instanceof Error ? e.message : String(e);
    }

    return {
      estado: conectada ? 'ok' : 'degradado',
      servicio: 'stockaware-backend',
      version: process.env.npm_package_version ?? '0.0.1',
      hora: new Date().toISOString(),
      base_datos: {
        conectada,
        latencia_ms: conectada ? Date.now() - inicio : null,
        ...(detalle ? { detalle } : {}),
      },
    };
  }
}
