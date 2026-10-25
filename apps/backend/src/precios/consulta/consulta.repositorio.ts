/**
 * Lecturas y escrituras que PreciosRepositorio aun no cubre y que la consulta necesita:
 * el material del ERP, la marca `cotizable` y la desactivacion de publicaciones.
 */
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { MaterialCotizable } from '../precios.entity';
import { Fuente } from '../fuentes/fuentes';

@Injectable()
export class ConsultaRepositorio {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  /**
   * cod_material no es unico en la replica (la clave es `id`). Se toma la fila de menor id,
   * la primera dada de alta, para que el nombre buscado sea estable entre consultas.
   */
  async material(codMaterial: string): Promise<{ nombre: string } | null> {
    const filas = await this.ds.query(
      `SELECT nombre FROM public.materiales WHERE cod_material = $1 ORDER BY id LIMIT 1`,
      [codMaterial],
    );
    return filas.length ? { nombre: filas[0].nombre ?? '' } : null;
  }

  cotizable(codMaterial: string): Promise<MaterialCotizable | null> {
    return this.ds.getRepository(MaterialCotizable).findOneBy({ cod_material: codMaterial });
  }

  /**
   * Tras una lectura completa, la publicacion que la busqueda ya no devuelve pasa a activa = false.
   * Solo las vinculadas a este material y a ningun otro: una publicacion compartida no se apaga
   * porque una sola busqueda no la vea.
   */
  async desactivaNoDevueltas(fuente: Fuente, codMaterial: string, idsExternos: string[]): Promise<void> {
    await this.ds.query(
      `UPDATE precios_externos.publicacion p SET activa = false
        WHERE p.fuente = $1 AND p.activa AND p.id_externo <> ALL($3::varchar[])
          AND EXISTS (SELECT 1 FROM precios_externos.vinculo_material v WHERE v.publicacion_id = p.id AND v.cod_material = $2)
          AND NOT EXISTS (SELECT 1 FROM precios_externos.vinculo_material v WHERE v.publicacion_id = p.id AND v.cod_material <> $2)`,
      [fuente, codMaterial, idsExternos],
    );
  }
}
