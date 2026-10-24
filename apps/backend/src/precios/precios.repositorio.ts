import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { CausaFalla, FallaConsulta, Fuente, ObservacionPrecio, Publicacion, VinculoMaterial } from './precios.entity';

/** Pausa de una fuente tras una falla (ADR 0002, "Indisponibilidad"). */
export const PAUSA_FALLA_MS = 30 * 60 * 1000;

export type DatosPublicacion = Pick<Publicacion, 'fuente' | 'id_externo' | 'url' | 'nombre' | 'marca' | 'ean' | 'categoria_fuente'>;
export type DatosObservacion = Pick<ObservacionPrecio, 'precio_normal' | 'precio_oferta' | 'disponible' | 'iva_incluido' | 'parcial'>;

@Injectable()
export class PreciosRepositorio {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  /**
   * Upsert de la publicacion por (fuente, id_externo) y de su observacion. Si precio y
   * stock no cambiaron solo se actualiza verificado_en; si cambiaron se agrega una fila
   * y el historial se conserva.
   */
  async guardaObservacion(pub: DatosPublicacion, obs: DatosObservacion, ahora = new Date()) {
    return this.ds.transaction(async (m) => {
      await m.upsert(Publicacion, { ...pub, activa: true }, ['fuente', 'id_externo']);
      const { id } = await m.findOneByOrFail(Publicacion, { fuente: pub.fuente, id_externo: pub.id_externo });
      const ultima = await m.findOne(ObservacionPrecio, { where: { publicacion_id: id }, order: { obtenido_en: 'DESC', id: 'DESC' } });
      const igual =
        ultima &&
        ultima.precio_normal === obs.precio_normal &&
        (ultima.precio_oferta ?? null) === (obs.precio_oferta ?? null) &&
        ultima.disponible === obs.disponible;
      if (igual) {
        // Nunca hacia atras: una hora anterior romperia ck_observacion_verificado.
        const verificado = new Date(Math.max(ahora.getTime(), new Date(ultima.verificado_en).getTime()));
        await m.update(ObservacionPrecio, ultima.id, { verificado_en: verificado });
        return { publicacionId: id, accion: 'verificada' as const };
      }
      await m.insert(ObservacionPrecio, { ...obs, publicacion_id: id, obtenido_en: ahora, verificado_en: ahora });
      return { publicacionId: id, accion: 'nueva' as const };
    });
  }

  /** Propone un vinculo; si ya existe (incluso rechazado) no lo toca. */
  async proponeVinculo(codMaterial: string, publicacionId: number, puntaje: number): Promise<void> {
    await this.ds.createQueryBuilder().insert().into(VinculoMaterial)
      .values({ cod_material: codMaterial, publicacion_id: publicacionId, puntaje }).orIgnore().execute();
  }

  /** Ultima observacion de cada publicacion activa vinculada al material, sin vinculos rechazados. */
  ultimasObservaciones(codMaterial: string): Promise<Array<Record<string, unknown>>> {
    return this.ds.query(
      `SELECT DISTINCT ON (p.id) p.id AS publicacion_id, p.fuente, p.nombre, p.url, v.estado, v.puntaje,
              o.precio_normal, o.precio_oferta, o.disponible, o.obtenido_en, o.verificado_en
         FROM precios_externos.vinculo_material v
         JOIN precios_externos.publicacion p ON p.id = v.publicacion_id AND p.activa
         JOIN precios_externos.observacion_precio o ON o.publicacion_id = p.id
        WHERE v.cod_material = $1 AND v.estado <> 'rechazado'
        ORDER BY p.id, o.obtenido_en DESC, o.id DESC`,
      [codMaterial],
    );
  }

  registraFalla(fuente: Fuente, url: string, causa: CausaFalla, ocurridaEn = new Date()) {
    return this.ds.getRepository(FallaConsulta).insert({ fuente, url, causa, ocurrida_en: ocurridaEn });
  }

  ultimaFalla(fuente: Fuente): Promise<FallaConsulta | null> {
    return this.ds.getRepository(FallaConsulta).findOne({ where: { fuente }, order: { ocurrida_en: 'DESC', id: 'DESC' } });
  }

  /** La pausa se deriva de la ultima falla; no hay tabla ni estado aparte. */
  async enPausa(fuente: Fuente, ahora = new Date()): Promise<boolean> {
    const falla = await this.ultimaFalla(fuente);
    return !!falla && ahora.getTime() - falla.ocurrida_en.getTime() < PAUSA_FALLA_MS;
  }
}
