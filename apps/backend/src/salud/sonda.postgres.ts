import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { SondaPostgres } from './sonda';

@Injectable()
export class SondaPostgresReal extends SondaPostgres {
  constructor(private readonly datos: DataSource) {
    super();
  }

  async comprobar(): Promise<boolean> {
    await this.datos.query('SELECT 1');
    return true;
  }
}
